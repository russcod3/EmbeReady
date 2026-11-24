'use strict';
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const db=require('./db');
const ai=require('./ai');
const {VERSION}=require('./ai/contract');
const installSaved=require('./install-saved-assessments');
const pending=[];
const inFlight=new Set();
let working=0;
const concurrency=2;

function buildInput(id) {
 const hazard=db.prepare('SELECT h.*,b.name AS barangay_name FROM hazards h JOIN barangays b ON b.id=h.barangay_id WHERE h.id=?').get(id);
 if(!hazard)throw new Error('Unknown hazard');
 let observations={};
 try{observations=JSON.parse(db.prepare('SELECT data_json FROM hazard_observations WHERE hazard_id=?').get(id)?.data_json||'{}');}catch{}
 const evidence=[{id:'report.description',source:hazard.is_demo?'mock':'community_report',text:hazard.description||'No observations supplied.'}];
 for(const [key,text]of Object.entries(observations.fields||{}))if(text)evidence.push({id:'site.'+key,source:observations.source||'community_report',observed_at:observations.observed_at||null,text});
 const history=db.prepare('SELECT * FROM fire_history WHERE (hazard_id=? OR barangay_id=?) AND is_demo=? ORDER BY incident_year DESC,id DESC LIMIT 20').all(id,hazard.barangay_id,hazard.is_demo?1:0);
 for(const item of history)evidence.push({id:'history.'+item.id,source:item.is_demo?'mock':'recorded_history',relationship:item.hazard_id===id?'same_site':'same_barangay',year:item.incident_year,severity:item.severity,text:item.incident_name+'. '+(item.damage_notes||'')});
 const context={title:hazard.title,category:hazard.category,status:hazard.status,scenario:hazard.is_demo?'fictional_demo':'community_report',evidence};
 // Only actual uploaded files become visual evidence; placeholder URLs are never images.
 let imageHash=null;
 if(hazard.photo_url?.startsWith('/uploads/user/')){
  const root=path.resolve(__dirname,'../public/uploads/user');
  const file=path.resolve(__dirname,'../public','.'+hazard.photo_url);
  if(file.startsWith(root+path.sep)&&fs.existsSync(file)&&fs.statSync(file).size<=5*1024*1024){
   const bytes=fs.readFileSync(file),ext=path.extname(file).toLowerCase(),mime={'.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.webp':'image/webp'}[ext];
   if(mime){context.image={mimeType:mime,data:bytes.toString('base64')};imageHash=crypto.createHash('sha256').update(bytes).digest('hex');context.evidence.push({id:'report.photo',source:'community_photo',text:'The attached image is available for visual assessment. Hidden conditions remain unknown.'});}
  }
 }
 const snapshot={...context,image:undefined,image_hash:imageHash,barangay:hazard.barangay_name,lat:hazard.lat,lng:hazard.lng,rubric:VERSION,model:ai.modelName(),api:ai.transportName()};
 const hash=crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
 return{hazard,context,barangay:{name:hazard.barangay_name},snapshot,hash};
}
function saveResult(input,result){
 // Both assessment and precautions are published as one immutable result.
 db.runTransaction(()=>{
  const run=db.prepare('INSERT INTO assessment_runs (hazard_id,input_hash,input_json,result_json,model_version,rubric_version) VALUES (?,?,?,?,?,?)').run(input.hazard.id,input.hash,JSON.stringify(input.snapshot),JSON.stringify(result),ai.modelName(),VERSION);
  db.prepare("UPDATE assessment_jobs SET state='completed',run_id=?,error_code=NULL,updated_at=datetime('now') WHERE hazard_id=? AND input_hash=?").run(run.lastInsertRowid,input.hazard.id,input.hash);
 });
}
async function processOne(input){
 db.prepare("UPDATE assessment_jobs SET state='processing',updated_at=datetime('now') WHERE hazard_id=?").run(input.hazard.id);
 try{saveResult(input,await ai.assessReport(input.context,input.barangay));}
 catch(error){
  const code=error.code||('AI_HTTP_'+(error.status||'ERROR'));
  db.prepare("UPDATE assessment_jobs SET state='unavailable',run_id=NULL,error_code=?,updated_at=datetime('now') WHERE hazard_id=?").run(code,input.hazard.id);
  console.warn('[assessment]',input.hazard.ref_code,code,error.message);
  // A shared authentication/model/quota failure must not fan out to every record.
  if([400,401,403,404,429,500,502,503,504].includes(error.status)||['AI_NOT_CONFIGURED','AI_NETWORK'].includes(code)){
   for(const queued of pending.splice(0)){db.prepare("UPDATE assessment_jobs SET state='unavailable',error_code=?,updated_at=datetime('now') WHERE hazard_id=?").run(code,queued.hazard.id);inFlight.delete(queued.hazard.id);}
  }
 }
}
function drain(){
 while(working<concurrency&&pending.length){const input=pending.shift();working++;processOne(input).finally(()=>{working--;inFlight.delete(input.hazard.id);drain();});}
}
function enqueue(id,{force=false,priority=true}={}){
 id=Number(id);if(inFlight.has(id))return;
 const input=buildInput(id);
 if(installSaved.isPreparedMock(input.hazard.ref_code)){installSaved(db,{activeHazardIds:inFlight});return;}
 const preserved=db.prepare("SELECT r.input_json FROM assessment_jobs j JOIN assessment_runs r ON r.id=j.run_id WHERE j.hazard_id=? AND j.state='completed'").get(id);
 if(preserved&&JSON.parse(preserved.input_json).origin==='legacy_gemini')return;
 if(input.hazard.status==='active'&&!input.hazard.is_demo)return;
 const existing=db.prepare('SELECT * FROM assessment_jobs WHERE hazard_id=?').get(id);
 if(!force&&existing?.input_hash===input.hash&&existing.state==='completed')return;
 // Failed jobs have a cooldown across reloads; explicit retry bypasses it.
 if(!force&&existing?.input_hash===input.hash&&existing.state==='unavailable'&&Date.now()-Date.parse(existing.updated_at+'Z')<60000)return;
 const state=ai.configured()?'queued':'unavailable';
 db.prepare("INSERT INTO assessment_jobs(hazard_id,state,input_hash,error_code) VALUES(?,?,?,?) ON CONFLICT(hazard_id) DO UPDATE SET state=excluded.state,input_hash=excluded.input_hash,run_id=NULL,error_code=excluded.error_code,updated_at=datetime('now')").run(id,state,input.hash,state==='unavailable'?'AI_NOT_CONFIGURED':null);
 if(state==='queued'){inFlight.add(id);if(priority)pending.unshift(input);else pending.push(input);queueMicrotask(drain);}
}
function startAll({retry=false}={}){
 installSaved(db,{activeHazardIds:inFlight});
 // Page loading reads saved results. Only explicit retries can invoke Gemini here.
 if(retry){
  const hazards=db.prepare("SELECT h.id FROM hazards h JOIN assessment_jobs j ON j.hazard_id=h.id WHERE h.status<>'active' AND j.state='unavailable' ORDER BY h.id").all();
  for(const {id}of hazards)enqueue(id,{force:true,priority:false});
 }
 return status();
}
function status(){
 const totals={queued:0,processing:0,completed:0,unavailable:0,total:0};
 const rows=db.prepare('SELECT state,COUNT(*) AS n FROM assessment_jobs GROUP BY state').all();
 for(const row of rows){totals[row.state]=row.n;totals.total+=row.n;}
 const errors=db.prepare("SELECT DISTINCT error_code FROM assessment_jobs WHERE state='unavailable'").all().map(x=>x.error_code);
 return{...totals,errors,configured:ai.configured()};
}
function detail(id){
 const row=db.prepare('SELECT j.state,j.error_code,r.id AS run_id,r.result_json,r.created_at FROM assessment_jobs j LEFT JOIN assessment_runs r ON r.id=j.run_id WHERE j.hazard_id=?').get(id);
 if(!row||row.state!=='completed'||!row.result_json)return{assessment:null,plan:null,ai_status:row?.state||'not_started',ai_error:row?.error_code||null};
 const result=JSON.parse(row.result_json),assessment={...result.assessment,id:row.run_id,created_at:row.created_at};
 assessment.factors=JSON.parse(assessment.factors_json);
 const plan=result.plan?{...result.plan}:null;if(plan)for(const key of ['before_steps','during_steps','after_steps','evacuation_tips','prohibited_actions'])plan[key]=JSON.parse(plan[key+'_json']);
 return{assessment,plan,ai_status:'completed',ai_error:null};
}
const waitForIdle=async()=>{while(working||pending.length)await new Promise(resolve=>setTimeout(resolve,10));};
module.exports={buildInput,enqueue,startAll,status,detail,waitForIdle};
