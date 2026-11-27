'use strict';
const test=require('node:test');
const {before,after}=test;
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const express=require('express');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'embeready-admin-tests-'));
process.env.DB_PATH=path.join(directory,'admin.db');
process.env.ADMIN_USERNAME='admin';process.env.ADMIN_PASSWORD='admin1234';process.env.GEMINI_API_KEY='';
const db=require('./db');
const detector=require('./photo-authenticity');
let server,base,cookie,counter=0;
const files=[];
function fixture({demo=false,photo=null}={}) {
    const n=++counter;
    const id=Number(db.prepare(`INSERT INTO hazards(ref_code,title,barangay_id,category,risk_level,status,lat,lng,description,photo_url,is_demo) VALUES(?,?,1,'faulty_wiring','moderate','potential',13.75,121.05,?,?,?)`).run('QA-HZ-'+n,'Local review fixture '+n,'Submitted conditions for isolated testing.',photo,Number(demo)).lastInsertRowid);
    if(!demo)db.prepare('INSERT INTO reports(ref_number,hazard_id,reported_level) VALUES(?,?,?)').run('QA-REPORT-'+n,id,'moderate');
    return {id,ref:'QA-REPORT-'+n,code:'QA-HZ-'+n};
}
async function call(route,method='GET',body,authenticated=true) {
    const response=await fetch(base+route,{method,headers:{...(authenticated&&cookie?{Cookie:cookie}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:response.status,body:await response.json(),response};
}
before(async()=>{
    db.prepare("INSERT INTO barangays(id,name,center_lat,center_lng) VALUES(1,'Test barangay',13.75,121.05)").run();
    const app=express();app.use(express.json());app.use('/api/admin',require('./routes/admin'));app.use('/api/hazards',require('./routes/hazards'));
    server=await new Promise(resolve=>{const running=app.listen(0,'127.0.0.1',()=>resolve(running));});
    base='http://127.0.0.1:'+server.address().port;
});
after(async()=>{
    await new Promise(resolve=>server.close(resolve));db.close();
    for(const file of files)if(fs.existsSync(file))fs.unlinkSync(file);
    const target=path.resolve(directory),root=path.resolve(os.tmpdir())+path.sep;
    assert.ok(target.startsWith(root)&&path.basename(target).startsWith('embeready-admin-tests-'));
    fs.rmSync(target,{recursive:true,force:true});
});
test('admin username and password authenticate with an HTTP-only session',async()=>{
    assert.equal((await call('/api/admin/dashboard','GET',undefined,false)).status,401);
    assert.equal((await call('/api/admin/login','POST',{username:'wrong',password:'admin1234'},false)).status,401);
    assert.equal((await call('/api/admin/login','POST',{username:'admin',password:'wrong'},false)).status,401);
    const login=await call('/api/admin/login','POST',{username:'admin',password:'admin1234'},false);
    assert.equal(login.status,200);assert.equal(login.body.reviewer.username,'admin');assert.equal(login.body.reviewer.owner,true);
    const header=login.response.headers.get('set-cookie');assert.match(header,/HttpOnly/);assert.match(header,/SameSite=Strict/);cookie=header.split(';')[0];
    assert.equal((await call('/api/admin/session')).body.reviewer.username,'admin');
});
test('the primary dashboard contains submitted reports and excludes example hazards',async()=>{
    const example=fixture({demo:true}),submitted=fixture();
    const inbox=await call('/api/admin/dashboard');assert.equal(inbox.status,200);
    assert.ok(inbox.body.data.some(row=>row.id===submitted.id&&row.description&&row.reported_level==='moderate'));
    assert.ok(!inbox.body.data.some(row=>row.id===example.id));assert.equal(inbox.body.counts.all,1);
    const all=await call('/api/admin/hazards');assert.ok(all.body.data.some(row=>row.id===example.id));assert.equal(all.body.total,2);
    const examples=await call('/api/admin/hazards?status=pending');assert.ok(!examples.body.data.some(row=>row.is_demo));
});
test('verification reaches the public map and marking a report fake hides its public details',async()=>{
    const item=fixture();
    const saved=await call('/api/admin/reports/'+item.ref,'PUT',{decision:'validated',evaluated_level:null,notes:'Confirmed with residents.',version:0,reason:null});
    assert.equal(saved.status,200);
    assert.equal((await call('/api/hazards/'+item.id)).body.data.hazard.verification_status,'verified');
    const stale=await call('/api/admin/reports/'+item.ref,'PUT',{decision:'dismissed',evaluated_level:null,notes:'Confirmed false.',version:0,reason:null});assert.equal(stale.status,409);
    assert.equal((await call('/api/admin/reports/'+item.ref,'PUT',{decision:'dismissed',evaluated_level:null,notes:'Residents confirmed this report is false.',version:1,reason:null})).status,200);
    assert.ok(!(await call('/api/hazards')).body.data.some(row=>row.id===item.id));
    assert.equal((await call('/api/hazards/'+item.id)).status,404);
    assert.ok((await call('/api/admin/dashboard?status=fake')).body.data.some(row=>row.id===item.id));
});
test('photo scores use a strict above-50-percent threshold and reject invalid values',()=>{
    assert.equal(detector.signal(.5).flagged,false);assert.equal(detector.signal(.50001).flagged,true);assert.equal(detector.signal(.49).flagged,false);
    for(const value of [NaN,Infinity,-.1,1.1,'0.8'])assert.throws(()=>detector.signal(value));
    assert.equal(detector.photoFile('/uploads/user/../../favicon.svg'),null);
});
test('scans are cached by photo hash and model revision and do not call Gemini',async()=>{
    const name='qa-local-scan-'+randomUUID()+'.png',file=path.resolve(__dirname,'../public/uploads/user',name);fs.mkdirSync(path.dirname(file),{recursive:true});files.push(file);
    fs.copyFileSync(path.resolve(__dirname,'../public/images/ember-icon.png'),file);
    const item=fixture({photo:'/uploads/user/'+name});let calls=0;
    const infer=async()=>{calls++;return {ai_score:.84};};
    const first=await detector.scan(db,item.id,infer);assert.equal(first.flagged,true);assert.equal(first.cached,false);
    const second=await detector.scan(db,item.id,infer);assert.equal(second.cached,true);assert.equal(calls,1);
    assert.equal((await call('/api/admin/hazards/'+item.id)).body.data.photo_scan.ai_score,.84);
    fs.appendFileSync(file,'changed photo bytes');await detector.scan(db,item.id,infer);assert.equal(calls,2);
    const noPhoto=fixture();assert.equal((await call('/api/admin/hazards/'+noPhoto.id+'/photo-scan','POST',{})).status,400);
});
test('a report deleted during a scan cannot be recreated by the result',async()=>{
    const name='qa-scan-race-'+randomUUID()+'.png',file=path.resolve(__dirname,'../public/uploads/user',name);files.push(file);fs.copyFileSync(path.resolve(__dirname,'../public/images/ember-icon.png'),file);
    const item=fixture({photo:'/uploads/user/'+name});
    await assert.rejects(detector.scan(db,item.id,async()=>{db.prepare('DELETE FROM reports WHERE hazard_id=?').run(item.id);db.prepare('DELETE FROM hazards WHERE id=?').run(item.id);return {ai_score:.7};}),error=>error.code==='PHOTO_CHANGED');
    assert.equal(db.prepare('SELECT 1 FROM photo_authenticity_scans WHERE hazard_id=?').get(item.id),undefined);
});
test('deletion requires confirmation and removes only the chosen report, pin, scan and photo',async()=>{
    const name='qa-delete-'+randomUUID()+'.png',file=path.resolve(__dirname,'../public/uploads/user',name);files.push(file);fs.copyFileSync(path.resolve(__dirname,'../public/images/ember-icon.png'),file);
    const item=fixture({photo:'/uploads/user/'+name}),unrelated=fixture();
    await detector.scan(db,item.id,async()=>({ai_score:.9}));
    db.prepare("INSERT INTO hazard_observations(hazard_id,data_json) VALUES(?,'{}')").run(item.id);
    db.prepare("INSERT INTO preparedness_plans(hazard_id) VALUES(?)").run(item.id);
    const run=db.prepare("INSERT INTO assessment_runs(hazard_id,input_hash,input_json,result_json,model_version,rubric_version) VALUES(?,'test','{}','{}','test','test')").run(item.id);
    db.prepare("INSERT INTO assessment_jobs(hazard_id,state,input_hash,run_id) VALUES(?,'completed','test',?)").run(item.id,run.lastInsertRowid);
    const root='/api/admin/hazards/'+item.id;
    assert.equal((await call(root,'DELETE',{ref_code:item.code,reason:'fake_report'})).status,400);
    assert.equal((await call(root,'DELETE',{confirm:true,ref_code:'different',reason:'fake_report'})).status,409);
    assert.ok(db.prepare('SELECT 1 FROM hazards WHERE id=?').get(item.id));
    const result=await call(root,'DELETE',{confirm:true,ref_code:item.code,reason:'fake_report'});
    assert.equal(result.status,200);assert.equal(result.body.data.photo_deleted,true);assert.equal(fs.existsSync(file),false);
    for(const table of ['hazards','reports','hazard_observations','preparedness_plans','assessment_runs','assessment_jobs','photo_authenticity_scans']){
        const key=table==='hazards'?'id':'hazard_id';assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM ${table} WHERE ${key}=?`).get(item.id).n,0,table);
    }
    assert.ok(db.prepare('SELECT 1 FROM hazards WHERE id=?').get(unrelated.id));
    assert.equal(db.prepare('SELECT reviewer FROM hazard_deletions WHERE hazard_id=?').get(item.id).reviewer,'admin');
    assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);
});
