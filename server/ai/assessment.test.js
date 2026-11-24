'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
process.env.GEMINI_API_KEY='test-only-key';
process.env.GEMINI_MODEL='gemini-3.8-flash';
delete process.env.GEMINI_API_MODE;
const ai=require('./index');
const {FACTORS}=require('./contract');
const context={title:'Sparking wires beside a house',category:'faulty_wiring',status:'potential',evidence:[{id:'report.description',text:'Observed sparking.',source:'community_report'}]};
const assessment=()=>({overall_score:100,assessed_level:'heavy',confidence_level:'medium',action_priority:'immediate',missing_information:[],reasoning_summary:'Reported ignition and exposure conditions.',factors_json:Object.fromEntries(Object.entries(FACTORS).map(([key,f])=>[key,{score:f.max,max_score:f.max,reason:'Condition documented in the supplied evidence.',evidence_refs:['report.description']}]))});
const plan=()=>Object.fromEntries([...['before_steps','during_steps','after_steps','evacuation_tips','prohibited_actions'].map(k=>[k,['Keep clear of the hazard.','Contact qualified responders.']]),['local_context_notes','Based on supplied observations.']]);
const response=value=>({ok:true,json:async()=>({status:'completed',steps:[{type:'model_output',content:[{type:'text',text:JSON.stringify(value)}]}]})});
test('one schema-constrained request produces assessment and matched precautions',async t=>{
 const original=global.fetch;t.after(()=>global.fetch=original);let calls=0;
 global.fetch=async(url,options)=>{calls++;assert.ok(!url.includes('test-only-key'));assert.equal(options.headers['x-goog-api-key'],'test-only-key');const body=JSON.parse(options.body);assert.match(url,/v1beta\/interactions$/);assert.equal(options.headers['Api-Revision'],'2026-05-20');assert.match(body.input[0].text,/untrusted/);assert.ok(body.response_format.schema);assert.equal(body.store,false);assert.equal(body.generation_config.temperature,undefined);assert.equal(body.generation_config.thinking_level,'low');return response({assessment:assessment(),plan:plan()});};
 const result=await ai.assessReport(context,{name:'Test barangay'});assert.equal(calls,1);assert.equal(result.assessment.overall_score,100);assert.equal(result.assessment.engine,'llm');assert.equal(result.assessment.evidence_coverage,100);assert.equal(JSON.parse(result.plan.before_steps_json).length,2);
});
test('invalid totals, fabricated evidence references and inconsistent classifications are rejected',()=>{
 for(const mutate of [a=>a.overall_score=1,a=>a.assessed_level='low',a=>a.factors_json.ignition_sources.evidence_refs=['invented'],a=>a.factors_json.ignition_sources.evidence_refs=[]]){const a=assessment();mutate(a);assert.throws(()=>ai.validateAssessment(a,new Set(['report.description'])),/Gemini/);}
});
test('unknown evidence produces a range, never a zero-risk substitution',()=>{
 const a=assessment();a.factors_json.weather_seasonal.score=null;a.overall_score=null;const result=ai.validateAssessment(a);assert.deepEqual(result.score_range,{min:95,max:100});assert.equal(result.overall_score,null);assert.equal(result.assessed_level,'heavy');assert.equal(result.evidence_coverage,95);
 const empty=assessment();empty.overall_score=null;empty.assessed_level=null;empty.confidence_level='low';for(const f of Object.values(empty.factors_json)){f.score=null;f.evidence_refs=[];}assert.deepEqual(ai.validateAssessment(empty).score_range,{min:0,max:100});
 empty.confidence_level='high';assert.throws(()=>ai.validateAssessment(empty),/confidence/);
});
test('network failure does not fabricate a substitute assessment',async t=>{const original=global.fetch;t.after(()=>global.fetch=original);global.fetch=async()=>{throw new Error('Network unavailable');};await assert.rejects(ai.assessReport(context),{code:'AI_NETWORK'});});
test('missing key sends no request',async t=>{const key=process.env.GEMINI_API_KEY,original=global.fetch;t.after(()=>{process.env.GEMINI_API_KEY=key;global.fetch=original;});delete process.env.GEMINI_API_KEY;global.fetch=async()=>assert.fail('No key');await assert.rejects(ai.assessReport(context),{code:'AI_NOT_CONFIGURED'});});
test('quota and authentication errors are not repeatedly retried',async t=>{const original=global.fetch;t.after(()=>global.fetch=original);for(const status of [403,429]){let calls=0;global.fetch=async()=>{calls++;return{ok:false,status,json:async()=>({error:{message:'Gemini API test error'}})};};await assert.rejects(ai.assessReport(context),/Gemini API/);assert.equal(calls,1);}});
test('an actual supplied photo is included as image evidence',async t=>{const original=global.fetch;t.after(()=>global.fetch=original);global.fetch=async(url,options)=>{assert.deepEqual(JSON.parse(options.body).input[1],{type:'image',mime_type:'image/png',data:'aW1hZ2U='});return response({assessment:assessment(),plan:plan()});};await ai.assessReport({...context,image:{mimeType:'image/png',data:'aW1hZ2U='}});});

test('read-only DOM timeout errors become a stable network failure',async t=>{
 const original=global.fetch;t.after(()=>global.fetch=original);
 for(const error of [new DOMException('Timed out','TimeoutError'),new TypeError('fetch failed')]){
  global.fetch=async()=>{throw error;};await assert.rejects(ai.assessReport(context),{code:'AI_NETWORK'});
 }
});

test('provider status is preserved and secret values are redacted from errors',async t=>{
 const original=global.fetch;t.after(()=>global.fetch=original);
 global.fetch=async()=>({ok:false,status:400,json:async()=>({error:{message:'API rejected test-only-key'}})});
 await assert.rejects(ai.assessReport(context),error=>error.code==='AI_HTTP_400'&&error.status===400&&!error.message.includes('test-only-key')&&error.message.includes('[redacted]'));
});
test('a validation failure is repaired using the original evidence',async t=>{
 const original=global.fetch;t.after(()=>global.fetch=original);let calls=0;
 global.fetch=async(url,options)=>{calls++;if(calls===1)return response({assessment:{...assessment(),overall_score:1},plan:plan()});assert.match(JSON.parse(options.body).input[0].text,/previous output failed validation/i);return response({assessment:assessment(),plan:plan()});};
 const result=await ai.assessReport(context);assert.equal(calls,2);assert.equal(result.assessment.overall_score,100);
});
test('older integrations can explicitly use generateContent without deprecated sampling settings',async t=>{
 const original=global.fetch;t.after(()=>{global.fetch=original;delete process.env.GEMINI_API_MODE;});process.env.GEMINI_API_MODE='generate_content';
 global.fetch=async(url,options)=>{assert.match(url,/:generateContent$/);const body=JSON.parse(options.body);assert.equal(body.generationConfig.temperature,undefined);assert.ok(body.generationConfig.responseJsonSchema);return{ok:true,json:async()=>({candidates:[{content:{parts:[{text:JSON.stringify({assessment:assessment(),plan:plan()})}]}}]})};};
 assert.equal((await ai.assessReport(context)).assessment.overall_score,100);
});
