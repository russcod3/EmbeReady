'use strict';
const crypto=require('node:crypto');
const fixtures=require('./data/demo-assessments.json');
const {FACTORS,levelFor}=require('./ai/contract');
const fingerprint=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');

function validateFixture(result){
 const assessment=result.assessment;
 if(assessment.engine!=='mock')throw new Error('Prepared demo results must be identified as mock data.');
 const factors=JSON.parse(assessment.factors_json);let total=0;
 if(Object.keys(factors).length!==Object.keys(FACTORS).length)throw new Error('Incomplete demo factors.');
 for(const [key,definition]of Object.entries(FACTORS)){
  const factor=factors[key];
  if(!factor||!Number.isInteger(factor.score)||factor.score<0||factor.score>definition.max||factor.max_score!==definition.max||!factor.reason?.trim())throw new Error('Invalid demo factor '+key);
  total+=factor.score;
 }
 if(total!==assessment.overall_score||levelFor(total)!==assessment.assessed_level)throw new Error('Inconsistent demo assessment.');
 for(const key of ['before_steps','during_steps','after_steps','evacuation_tips','prohibited_actions']){
  const steps=JSON.parse(result.plan[key+'_json']);
  if(!Array.isArray(steps)||steps.length<2||!steps.every(step=>typeof step==='string'&&step.trim()))throw new Error('Incomplete demo guidance.');
 }
}

module.exports=function installSavedAssessments(db,{activeHazardIds=new Set()}={}){
 const summary={mock:0,gemini:0};
 const activate=db.prepare("INSERT INTO assessment_jobs(hazard_id,state,input_hash,run_id,error_code) VALUES(?,'completed',?,?,NULL) ON CONFLICT(hazard_id) DO UPDATE SET state='completed',input_hash=excluded.input_hash,run_id=excluded.run_id,error_code=NULL,updated_at=datetime('now') WHERE assessment_jobs.state<>'completed' OR assessment_jobs.run_id<>excluded.run_id OR assessment_jobs.run_id IS NULL");
 const insert=db.prepare('INSERT INTO assessment_runs(hazard_id,input_hash,input_json,result_json,model_version,rubric_version) VALUES(?,?,?,?,?,?)');
 db.runTransaction(()=>{
  for(const hazard of db.prepare('SELECT * FROM hazards ORDER BY id').all()){
   if(activeHazardIds.has(hazard.id))continue;
   // A genuine successful Gemini result always takes precedence over a demo fixture.
   const genuine=db.prepare("SELECT * FROM assessment_runs WHERE hazard_id=? AND json_extract(result_json,'$.assessment.engine')='llm' AND model_version LIKE 'gemini%' ORDER BY id DESC LIMIT 1").get(hazard.id);
   if(genuine){activate.run(hazard.id,genuine.input_hash,genuine.id);summary.gemini++;continue;}
   const legacy=db.prepare("SELECT * FROM risk_assessments WHERE hazard_id=? AND engine='llm' AND model_version LIKE 'gemini%' ORDER BY id DESC LIMIT 1").get(hazard.id);
   if(legacy){
    const oldPlan=db.prepare("SELECT * FROM preparedness_plans WHERE hazard_id=? AND local_context_notes LIKE '[AI-generated guidance]%' AND (created_at=? OR id=?) ORDER BY id DESC LIMIT 1").get(hazard.id,legacy.created_at,legacy.id)||null;
    const assessment={...legacy,score_range:{min:legacy.overall_score,max:legacy.overall_score},evidence_coverage:null,missing_information:[],action_priority:null,rubric_version:'legacy-gemini',source_created_at:legacy.created_at};
    const plan=oldPlan?Object.fromEntries(['before_steps_json','during_steps_json','after_steps_json','evacuation_tips_json','prohibited_actions_json','local_context_notes'].map(key=>[key,oldPlan[key]])):null;
    const input={origin:'legacy_gemini',legacy_assessment_id:legacy.id,legacy_plan_id:oldPlan?.id||null};
    const hash=fingerprint(input),existing=db.prepare('SELECT id FROM assessment_runs WHERE hazard_id=? AND input_hash=? ORDER BY id DESC LIMIT 1').get(hazard.id,hash);
    const runId=existing?.id||insert.run(hazard.id,hash,JSON.stringify(input),JSON.stringify({assessment,plan}),legacy.model_version,'legacy-gemini').lastInsertRowid;
    activate.run(hazard.id,hash,runId);summary.gemini++;continue;
   }
   const fixture=fixtures[hazard.ref_code];if(!fixture)continue;
   validateFixture(fixture.result);
   const input={origin:'prepared_mock',version:fixture.version,ref_code:hazard.ref_code,observations:fixture.observations,result:fixture.result,content_update:fixture.content_update};
   const hash=fingerprint(input),existing=db.prepare('SELECT id FROM assessment_runs WHERE hazard_id=? AND input_hash=? ORDER BY id DESC LIMIT 1').get(hazard.id,hash);
   let runId=existing?.id;
   if(!runId){
    db.prepare("INSERT INTO hazard_observations(hazard_id,data_json) VALUES(?,?) ON CONFLICT(hazard_id) DO UPDATE SET data_json=excluded.data_json,updated_at=datetime('now')").run(hazard.id,JSON.stringify(fixture.observations));
    const content=fixture.content_update||{};
    // Only report content and severity change. Identity, coordinates, photos and status are untouched.
    db.prepare('UPDATE hazards SET title=?,description=?,category=?,risk_level=? WHERE id=?').run(content.title||hazard.title,content.description||hazard.description,content.category||hazard.category,fixture.result.assessment.assessed_level,hazard.id);
    runId=insert.run(hazard.id,hash,JSON.stringify(input),JSON.stringify(fixture.result),'prepared-demo-v1','evidence-v2').lastInsertRowid;
   }
   activate.run(hazard.id,hash,runId);summary.mock++;
  }
 });
 return summary;
};
module.exports.isPreparedMock=ref=>Object.hasOwn(fixtures,ref);
