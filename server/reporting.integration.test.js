'use strict';
const {test,before,after}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const express=require('express');
const testDir=fs.mkdtempSync(path.join(os.tmpdir(),'embeready-report-tests-'));process.env.DB_PATH=path.join(testDir,'reports.db');process.env.RATE_LIMIT_MAX='100';process.env.GEMINI_API_KEY='test-only-key';process.env.GEMINI_MODEL='gemini-test';process.env.ADMIN_PASSWORD='test-8pw';
const db=require('./db'),ai=require('./ai'),service=require('./assessment-service');let server,base;
const result=()=>({assessment:{overall_score:75,assessed_level:'heavy',factors_json:'{}',confidence_level:'medium',reasoning_summary:'Test assessment.',engine:'llm',model_version:'gemini-test',score_range:{min:75,max:75},missing_information:[],action_priority:'prompt',evidence_coverage:100},plan:{...Object.fromEntries(['before_steps','during_steps','after_steps','evacuation_tips','prohibited_actions'].map(k=>[k+'_json','["Stay clear.","Contact responders."]'])),local_context_notes:'Test only.'}});
before(async()=>{db.prepare('INSERT INTO barangays(id,name,classification,center_lat,center_lng) VALUES(1,?,?,?,?)').run('Test barangay','urban',13.7565,121.0583);const app=express();app.use(express.json());app.use('/api/reports',require('./routes/reports'));app.use('/api/hazards',require('./routes/hazards'));app.use('/api/assessments',require('./routes/assessments'));app.use('/api/admin',require('./routes/admin'));app.use('/api/report-follow-up',require('./reporter-followups').publicRouter);server=await new Promise(resolve=>{const running=app.listen(0,'127.0.0.1',()=>resolve(running));});base=`http://127.0.0.1:${server.address().port}`;});
after(async()=>{await service.waitForIdle();await new Promise(resolve=>server.close(resolve));db.close();assert.equal(path.dirname(path.resolve(testDir)),path.resolve(os.tmpdir()));assert.ok(path.basename(testDir).startsWith('embeready-report-tests-'));fs.rmSync(testDir,{recursive:true,force:true});});
const post=async(body,route='/api/reports')=>{const r=await fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return{status:r.status,body:await r.json()};};
const get=async route=>(await(await fetch(base+route)).json()).data;
const report=patch=>({reported_level:'low',category:'faulty_wiring',title:'Sparking wires near a house',lat:13.756512345,lng:121.058312345,...patch});
test('live fire saves from a pin and never invokes Gemini',async()=>{let calls=0;ai.assessReport=async()=>{calls++;return result();};const r=await post({report_type:'live_fire',lat:13.7566,lng:121.0584});assert.equal(r.status,201);assert.equal(r.body.ai_status,'not_requested');assert.equal(calls,0);const detail=await get('/api/hazards/'+r.body.hazard_id);assert.equal(detail.hazard.status,'active');assert.equal(detail.hazard.description,'');assert.equal(detail.hazard.photo_url,null);});
test('report saves before slow Gemini finishes and keeps reporter severity distinct',async()=>{let resolve;ai.assessReport=()=>new Promise(r=>resolve=r);const r=await post(report());assert.equal(r.status,201);let detail=await get('/api/hazards/'+r.body.hazard_id);assert.equal(detail.hazard.reported_level,'low');assert.equal(detail.hazard.risk_level,'low');assert.equal(detail.assessment,null);resolve(result());await service.waitForIdle();detail=await get('/api/hazards/'+r.body.hazard_id);assert.equal(detail.hazard.risk_level,'heavy');assert.equal(detail.hazard.reported_level,'low');assert.equal(detail.assessment.overall_score,75);assert.equal(detail.plan.before_steps.length,2);assert.equal(detail.hazard.lat,13.756512345);assert.equal(detail.hazard.lng,121.058312345);});
test('Gemini failure preserves the report without a generated score',async()=>{ai.assessReport=async()=>{throw new Error('Test unavailable');};const r=await post(report());await service.waitForIdle();const detail=await get('/api/hazards/'+r.body.hazard_id);assert.equal(detail.assessment,null);assert.equal(detail.plan,null);assert.equal(detail.hazard.risk_level,'low');assert.equal(detail.hazard.ai_status,'unavailable');});
test('legacy rule assessments remain archived and do not impersonate Gemini',async()=>{const h=db.prepare('SELECT id FROM hazards ORDER BY id DESC LIMIT 1').get();db.prepare('INSERT INTO risk_assessments(hazard_id,overall_score,assessed_level,engine,model_version) VALUES(?,90,?,?,?)').run(h.id,'heavy','rule_based','rules-v1.0');const detail=await get('/api/hazards/'+h.id);assert.equal(detail.assessment,null);assert.equal(detail.hazard.risk_level,'low');});
test('website loading shows saved demo cards without any Gemini calls and preserves every pin',async()=>{
 const insert=db.prepare('INSERT INTO hazards(ref_code,title,barangay_id,category,risk_level,status,lat,lng,is_demo) VALUES(?,?,1,?,?,?,?,?,1)');
 insert.run('HZ-0003','Mock housing','informal_settlement','heavy','potential',13.7546,121.0578);insert.run('HZ-0015','Mock live fire','other','heavy','active',13.753,121.045);
 const pins=db.prepare('SELECT id,lat,lng,photo_url,status FROM hazards ORDER BY id').all();let calls=0;ai.assessReport=async()=>{calls++;return result();};
 await post({},'/api/assessments/start');await service.waitForIdle();assert.equal(calls,0);
 const runs=db.prepare('SELECT COUNT(*) AS n FROM assessment_runs').get().n;await post({},'/api/assessments/start');assert.equal(db.prepare('SELECT COUNT(*) AS n FROM assessment_runs').get().n,runs);
 assert.deepEqual(db.prepare('SELECT id,lat,lng,photo_url,status FROM hazards ORDER BY id').all(),pins);
 const hazard=db.prepare("SELECT id FROM hazards WHERE ref_code='HZ-0003'").get();const detail=await get('/api/hazards/'+hazard.id);assert.equal(detail.assessment.engine,'mock');assert.equal(detail.assessment.overall_score,87);assert.equal(Object.keys(detail.assessment.factors).length,10);assert.equal(detail.plan.before_steps.length,3);
});
test('real reports never consume fictional local history',()=>{db.prepare('INSERT INTO fire_history(barangay_id,incident_name,incident_year,is_demo) VALUES(1,?,2023,1)').run('Fictional incident');const real=db.prepare('SELECT id FROM hazards WHERE is_demo=0 LIMIT 1').get(),mock=db.prepare('SELECT id FROM hazards WHERE is_demo=1 LIMIT 1').get();assert.ok(!service.buildInput(real.id).context.evidence.some(e=>e.id.startsWith('history.')));assert.ok(service.buildInput(mock.id).context.evidence.some(e=>e.source==='mock'&&e.id.startsWith('history.')));});
test('changed community evidence can be assessed without touching saved demo results',async()=>{const h=db.prepare("SELECT id FROM hazards WHERE is_demo=0 AND status<>'active' ORDER BY id LIMIT 1").get();let calls=0;ai.assessReport=async()=>{calls++;return result();};db.prepare('UPDATE hazard_observations SET data_json=? WHERE hazard_id=?').run(JSON.stringify({source:'mock',fields:{escape_routes:'Updated fictional obstruction'}}),h.id);service.enqueue(h.id);await service.waitForIdle();assert.equal(calls,1);});
test('the assessment and precautions publish atomically',async()=>{ai.assessReport=async()=>result();db.exec("CREATE TRIGGER reject_result BEFORE INSERT ON assessment_runs BEGIN SELECT RAISE(ABORT,'test write failure'); END");try{const r=await post(report());await service.waitForIdle();const detail=await get('/api/hazards/'+r.body.hazard_id);assert.equal(detail.assessment,null);assert.equal(detail.plan,null);assert.equal(detail.hazard.ai_status,'unavailable');}finally{db.exec('DROP TRIGGER reject_result');}});
test('invalid reports never insert a pin',async()=>{const count=db.prepare('SELECT COUNT(*) AS n FROM hazards').get().n;assert.equal((await post({report_type:'live_fire'})).status,400);assert.equal((await post(report({reported_level:''}))).status,400);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM hazards').get().n,count);});

test('a shared Gemini outage stops the batch instead of leaving queued pins spinning',async()=>{
 let calls=0;ai.assessReport=async()=>{calls++;const error=new Error('Test Gemini service outage');error.status=503;throw error;};
 const pins=db.prepare('SELECT id,lat,lng FROM hazards ORDER BY id').all();
 service.startAll({retry:true});await service.waitForIdle();
 const state=service.status();assert.ok(calls<=2);assert.equal(state.queued,0);assert.equal(state.processing,0);assert.ok(state.unavailable>0);
 assert.deepEqual(db.prepare('SELECT id,lat,lng FROM hazards ORDER BY id').all(),pins);
});

test('prepared mock records never spend quota even when enqueue is called explicitly',async()=>{
 let calls=0;ai.assessReport=async()=>{calls++;return result();};const hazard=db.prepare("SELECT id FROM hazards WHERE ref_code='HZ-0003'").get();
 service.enqueue(hazard.id,{force:true});await service.waitForIdle();assert.equal(calls,0);assert.equal(service.detail(hazard.id).assessment.engine,'mock');
});
test('successful historical Gemini assessment and precautions remain exactly preserved',async()=>{
 const hazard=db.prepare("INSERT INTO hazards(ref_code,title,barangay_id,category,risk_level,status,lat,lng) VALUES('PRESERVED-GEMINI','Saved bamboo report',1,'other','moderate','potential',13.75,121.05)").run();const id=Number(hazard.lastInsertRowid);
 const factors=JSON.stringify({ignition_sources:{score:20,max_score:50,reason:'Original reasoning A.'},fuel_combustibles:{score:20,max_score:50,reason:'Original reasoning B.'}});
 db.prepare("INSERT INTO risk_assessments(hazard_id,overall_score,assessed_level,factors_json,confidence_level,reasoning_summary,engine,model_version,created_at) VALUES(?,40,'moderate',?,'high','Original Gemini summary.','llm','gemini-2.5-flash-lite','2026-11-07 10:33:41')").run(id,factors);
 const steps='["Original safety step.","Original follow-up step."]';db.prepare("INSERT INTO preparedness_plans(hazard_id,before_steps_json,during_steps_json,after_steps_json,evacuation_tips_json,prohibited_actions_json,local_context_notes,created_at) VALUES(?,?,?,?,?,?,?,'2026-11-07 10:33:41')").run(id,steps,steps,steps,steps,steps,'[AI-generated guidance] Original context.');
 const original=db.prepare('SELECT * FROM risk_assessments WHERE hazard_id=?').get(id);let calls=0;ai.assessReport=async()=>{calls++;return result();};
 await post({},'/api/assessments/start');service.enqueue(id,{force:true});await service.waitForIdle();const detail=await get('/api/hazards/'+id);
 assert.equal(calls,0);assert.equal(detail.assessment.overall_score,40);assert.equal(detail.assessment.factors_json,factors);assert.equal(detail.assessment.reasoning_summary,'Original Gemini summary.');assert.equal(detail.assessment.model_version,'gemini-2.5-flash-lite');assert.deepEqual(detail.plan.before_steps,JSON.parse(steps));assert.deepEqual(db.prepare('SELECT * FROM risk_assessments WHERE hazard_id=?').get(id),original);
});

test('admin review accepts an 8-character password, persists evaluations, and rejects stale updates', async () => {
    const root = '/api/admin';
    const queue = root + '/reports';
    const admin = (route, method = 'GET', cookie, body) => fetch(base + route, {
        method,
        headers: {
            ...(cookie ? { Cookie: cookie } : {}),
            ...(body ? { 'Content-Type': 'application/json' } : {})
        },
        body: body ? JSON.stringify(body) : undefined
    });

    assert.equal((await admin(queue)).status, 401);
    assert.equal((await admin(root + '/login', 'POST', null, { password: 'incorrect' })).status, 401);
    const login = await admin(root + '/login', 'POST', null, { password: process.env.ADMIN_PASSWORD });
    assert.equal(login.status, 200);
    const session = login.headers.get('set-cookie');
    assert.match(session, /HttpOnly/i);
    assert.match(session, /SameSite=Strict/i);
    const cookie = session.split(';')[0];

    const credentials = { username: 'reviewer-one', password: 'named-reviewer-test' };
    assert.equal((await admin(root + '/reviewers', 'POST', null, credentials)).status, 401);
    assert.equal((await admin(root + '/reviewers', 'POST', cookie, credentials)).status, 201);
    assert.equal((await admin(root + '/reviewers', 'POST', cookie, credentials)).status, 409);
    const namedLogin = await admin(root + '/login', 'POST', null, credentials);
    assert.equal(namedLogin.status, 200);
    const namedCookie = namedLogin.headers.get('set-cookie').split(';')[0];
    assert.equal((await admin(root + '/reviewers', 'GET', namedCookie)).status, 403);

    ai.assessReport = async () => result();
    const submitted = await post(report({ description: 'Visible sparks', observation_truck_access: 'Narrow lane' }));
    await service.waitForIdle();
    const { ref_number: ref, hazard_id: hazardId } = submitted.body;
    const route = queue + '/' + ref;
    const filtered = await (await admin(queue + '?decision=pending&q=' + ref, 'GET', cookie)).json();
    assert.equal(filtered.total, 1);
    assert.equal(filtered.data[0].ref_number, ref);
    const initial = (await (await admin(route, 'GET', cookie)).json()).data;
    assert.equal(initial.version, 0);
    assert.equal(initial.description, 'Visible sparks');
    assert.equal(initial.observations.truck_access, 'Narrow lane');
    assert.equal(initial.assessment.overall_score, 75);
    assert.equal('reporter_ip_hash' in initial, false);
    assert.ok(initial.nearby.some(item => item.incident_status === 'active' && item.distance < 100));
    assert.ok(initial.nearby.every(item => item.ref_number !== ref && item.distance <= 500));
    assert.deepEqual(initial.history, []);
    const beforeReview = await get('/api/hazards/' + hazardId);
    assert.equal(beforeReview.hazard.verification_status, 'unverified');

    const review = { decision: 'dismissed', evaluated_level: 'moderate', notes: 'Duplicate incident.', version: 0 };
    assert.equal((await admin(route, 'PUT', null, review)).status, 401);
    assert.equal((await admin(route, 'PUT', cookie, { ...review, notes: '' })).status, 400);
    assert.equal((await admin(route, 'PUT', cookie, { ...review, version: 1 })).status, 409);
    const saved = (await (await admin(route, 'PUT', cookie, review)).json()).data;
    assert.equal(saved.version, 1);
    assert.equal((await admin(route, 'PUT', cookie, review)).status, 409);
    const moderated = (await (await admin(route, 'GET', cookie)).json()).data;
    assert.equal(moderated.decision, 'dismissed');
    assert.equal(moderated.evaluated_level, 'moderate');
    assert.equal(moderated.notes, 'Duplicate incident.');
    const followUp = { ...review, decision: 'needs_verification', version: 1 };
    assert.equal((await admin(route, 'PUT', namedCookie, followUp)).status, 400);
    assert.equal((await admin(route, 'PUT', namedCookie, { ...followUp, reason: 'possible_duplicate' })).status, 403);
    assert.equal((await admin(root + '/reviewers/' + credentials.username, 'PUT', cookie, { role: 'supervisor' })).status, 200);
    assert.equal((await admin(route, 'PUT', namedCookie, { ...followUp, reason: 'possible_duplicate' })).status, 400);
    const followUpSaved = (await (await admin(route, 'PUT', namedCookie, {
        ...followUp, reason: 'possible_duplicate', correction_reason: 'Location differs from the original.'
    })).json()).data;
    assert.equal(followUpSaved.history[0].correction_reason, 'Location differs from the original.');
    assert.equal(followUpSaved.history[0].reviewer, credentials.username);
    assert.equal(followUpSaved.history[0].reason, 'possible_duplicate');
    assert.equal(followUpSaved.history[1].reviewer, 'Shared admin');
    const matching = (await (await admin(queue + '?reason=possible_duplicate', 'GET', cookie)).json()).data;
    assert.deepEqual(matching.map(row => row.ref_number), [ref]);
    const changed = (await (await admin(route, 'PUT', namedCookie, {
        ...review, decision: 'validated', version: 2
    })).json()).data;
    assert.equal(changed.version, 3);
    assert.equal(changed.decision, 'validated');
    assert.equal(changed.reason, null);
    assert.equal(changed.history.length, 3);
    const publicHazard = await get('/api/hazards/' + hazardId);
    assert.equal(publicHazard.hazard.risk_level, 'heavy');
    assert.equal(publicHazard.hazard.status, 'potential');
    assert.equal('notes' in publicHazard.hazard, false);
    assert.equal('reviewer' in publicHazard.hazard, false);
    assert.equal(publicHazard.hazard.verification_status, 'verified');
    const publicList = await get('/api/hazards');
    assert.equal(publicList.find(row => row.id === hazardId).verification_status, 'verified');
    assert.ok(publicList.some(row => row.status === 'active' && row.verification_status === 'unverified'));
    assert.ok(publicList.filter(row => row.is_demo).every(row => row.verification_status === null));

    const accountRoute = root + '/reviewers/' + credentials.username;
    assert.equal((await admin(accountRoute, 'PUT', cookie, { enabled: false })).status, 200);
    assert.equal((await admin(route, 'GET', namedCookie)).status, 401);
    assert.equal((await admin(root + '/login', 'POST', null, credentials)).status, 401);
    assert.equal((await admin(accountRoute, 'PUT', cookie, { enabled: true })).status, 200);
    assert.equal((await admin(root + '/login', 'POST', null, credentials)).status, 200);

    assert.equal((await admin(root + '/logout', 'POST', cookie, {})).status, 200);
    assert.equal((await admin(route, 'GET', cookie)).status, 401);
});

test('workflow keeps follow-ups, duplicates, incident status and practice reports consistent', async () => {
    const adminRoot = '/api/admin';
    const send = (route, method = 'GET', body, cookie) => fetch(base + adminRoot + route, {
        method,
        headers: {
            ...(cookie ? { Cookie: cookie } : {}),
            ...(body ? { 'Content-Type': 'application/json' } : {})
        },
        body: body ? JSON.stringify(body) : undefined
    });
    const login = await send('/login', 'POST', { password: process.env.ADMIN_PASSWORD });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const adminGet = async route => (await (await send(route, 'GET', undefined, cookie)).json()).data;

    const first = (await post({ report_type: 'live_fire', lat: 13.7566, lng: 121.0584 })).body;
    const second = (await post({ report_type: 'live_fire', lat: 13.7567, lng: 121.0585 })).body;
    const original = first.ref_number;
    const duplicate = second.ref_number;
    const save = (ref, body) => send('/reports/' + ref + '/workflow', 'PUT', body, cookie);
    const fields = {
        workflow_version: 0, assignee: 'Shared admin', due_on: '2000-01-01',
        duplicate_ref: original, incident_status: 'contained'
    };

    assert.equal((await save(duplicate, { ...fields, due_on: '2026-02-30' })).status, 400);
    assert.equal((await save(duplicate, { ...fields, duplicate_ref: duplicate })).status, 400);
    assert.equal((await save(duplicate, { ...fields, assignee: 'missing-reviewer' })).status, 400);
    const saved = (await (await save(duplicate, fields)).json()).data;
    assert.equal(saved.workflow_version, 1);
    assert.equal(saved.incident_status, 'contained');
    assert.equal(saved.duplicate_ref, original);
    assert.equal(saved.workflow_history[0].reviewer, 'Shared admin');
    assert.equal(saved.workflow_history[0].changes.length, 4);
    assert.equal((await save(duplicate, fields)).status, 409);
    const unchanged = (await (await save(duplicate, { ...fields, workflow_version: 1 })).json()).data;
    assert.equal(unchanged.workflow_version, 1);
    assert.equal(unchanged.workflow_history.length, 1);
    assert.equal((await save(original, { ...fields, duplicate_ref: duplicate })).status, 400);
    assert.ok((await adminGet('/reports?followup=mine')).some(row => row.ref_number === duplicate));
    assert.ok((await adminGet('/reports?followup=overdue')).some(row => row.ref_number === duplicate));
    const publicDetail = await get('/api/hazards/' + second.hazard_id);
    assert.equal(publicDetail.hazard.status, 'contained');
    assert.equal(publicDetail.hazard.ai_status, 'not_requested');
    assert.equal('duplicate_ref' in publicDetail.hazard, false);
    assert.ok(!(await get('/api/hazards?active_only=1')).some(row => row.id === second.hazard_id));

    assert.equal((await save(duplicate, {
        ...fields, workflow_version: 1, previous_incident_status: 'active', incident_status: 'resolved'
    })).status, 409);
    const resolved = (await (await save(duplicate, {
        ...fields, workflow_version: 1, duplicate_ref: null, incident_status: 'resolved'
    })).json()).data;
    assert.equal(resolved.incident_status, 'resolved');
    assert.equal(resolved.duplicate_ref, null);
    assert.ok(!(await adminGet('/reports?followup=overdue')).some(row => row.ref_number === duplicate));

    assert.equal((await send('/demo', 'POST', {})).status, 401);
    let assessmentCalls = 0;
    ai.assessReport = async () => { assessmentCalls++; return result(); };
    assert.equal((await send('/demo', 'POST', {}, cookie)).status, 200);
    assert.equal((await send('/demo', 'POST', {}, cookie)).status, 200);
    const demo = await adminGet('/reports?source=demo');
    assert.equal(demo.length, 4);
    assert.equal(assessmentCalls, 0);
    assert.ok(demo.every(row => row.is_training === 1));
    const next = await (await send('/reports?source=demo&next_after=' + demo[0].ref_number, 'GET', undefined, cookie)).json();
    assert.equal(next.next_ref, demo[1].ref_number);
    const trainingDetail = await adminGet('/reports/DEMO-REVIEW-101');
    assert.ok(trainingDetail.nearby.some(row => row.ref_number === 'DEMO-REVIEW-102'));
    assert.ok(trainingDetail.nearby.every(row => row.is_training === 1));
    assert.equal((await save(duplicate, { ...fields, workflow_version: 2, duplicate_ref: demo[0].ref_number })).status, 400);
    const trainingHazard = db.prepare('SELECT id FROM hazards WHERE ref_code = ?').get(demo[0].ref_number);
    assert.equal((await fetch(base + '/api/hazards/' + trainingHazard.id)).status, 404);
    assert.equal((await fetch(base + '/api/reports/' + demo[0].ref_number)).status, 404);
    assert.ok(!(await get('/api/hazards')).some(row => row.ref_code.startsWith('DEMO-REVIEW-')));
    assert.ok(!(await adminGet('/reports')).some(row => row.is_training));
});

test('private reporter links, attention queue, pin audit and operations summary work together', async () => {
    const adminRoot = '/api/admin';
    const send = (route, method = 'GET', body, cookie) => fetch(base + adminRoot + route, {
        method,
        headers: {
            ...(cookie ? { Cookie: cookie } : {}),
            ...(body ? { 'Content-Type': 'application/json' } : {})
        },
        body: body ? JSON.stringify(body) : undefined
    });
    const login = await send('/login', 'POST', { password: process.env.ADMIN_PASSWORD });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const adminGet = async route => (await (await send(route, 'GET', undefined, cookie)).json()).data;
    const originalPin = { lat: 13.7567, lng: 121.0583 };
    ai.assessReport = async () => result();
    const formerAddress = 'Original address';
    const submission = (await post(report({ ...originalPin, address: formerAddress }))).body;
    await service.waitForIdle();
    const route = '/reports/' + submission.ref_number;
    const newBarangay = 'Corrected barangay';
    const { lastInsertRowid } = db.prepare('INSERT INTO barangays (name, center_lat, center_lng) VALUES (?, ?, ?)')
        .run(newBarangay, 13.757, 121.0583);
    db.prepare(`
        INSERT INTO emergency_contacts (jurisdiction, agency_type, facility_name, phone_display)
        VALUES (?, 'Barangay', 'Corrected response desk', '0000')
    `).run(newBarangay);
    const pin = {
        ...originalPin, lat: 13.757, pin_revision: 0, barangay_id: Number(lastInsertRowid),
        address: 'West entrance', reason: 'Confirmed the building entrance.'
    };
    const lookup = await get('/api/reports/' + submission.ref_number);
    assert.equal(lookup.ref_number, submission.ref_number);
    assert.equal(lookup.hazard_id, submission.hazard_id);
    assert.equal('reporter_ip_hash' in lookup, false);
    assert.equal('honeypot_triggered' in lookup, false);
    assert.equal((await send(route + '/pin', 'PUT', pin)).status, 401);
    assert.equal((await send(route + '/pin', 'PUT', { ...pin, lat: 0 }, cookie)).status, 400);

    const question = { question: 'Which building entrance is nearest? <b>test</b>' };
    assert.equal((await send(route + '/reporter-requests', 'POST', question)).status, 401);
    const link = async () => (await (await send(route + '/reporter-requests', 'POST', question, cookie)).json()).path.split('#')[1];
    const token1 = await link();
    const token2 = await link();
    const respond = (token, body) => fetch(base + '/api/report-follow-up', {
        headers: { Authorization: 'Bearer ' + token }, method: body ? 'POST' : 'GET', body
    });
    assert.equal((await respond(token1)).status, 404);
    const probe = await respond(token2);
    assert.equal(probe.status, 200);
    const context = (await probe.json()).data;
    assert.equal(context.question, question.question);
    assert.equal('report_id' in context, false);

    const form = new FormData();
    form.set('reply', 'The entrance near the blue gate.');
    form.set('lat', String(pin.lat));
    assert.equal((await respond(token2, form)).status, 400);
    form.set('lng', String(pin.lng));
    form.set('photo', new Blob(['invalid'], { type: 'image/png' }), 'photo.png');
    assert.equal((await respond(token2, form)).status, 400);
    const photo = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVQImWNgAAIAAAUAAeImBZsAAAAASUVORK5CYII=', 'base64');
    form.set('photo', new Blob([photo], { type: 'image/png' }), 'photo.png');
    assert.equal((await respond(token2, form)).status, 201);
    assert.equal((await respond(token2, form)).status, 409);

    let queue = await adminGet('/reports?followup=attention');
    const attention = queue.find(row => row.ref_number === submission.ref_number);
    assert.equal(attention.attention_priority, 1);
    assert.ok(attention.unread_at);
    assert.ok((await adminGet('/operations')).needs_attention >= 1);
    assert.ok((await adminGet('/operations')).submitted >= 1);
    const detail = await adminGet(route);
    const entry = detail.reporter_requests[0];
    assert.equal(entry.reply_lat, pin.lat);
    assert.equal(entry.has_photo, 1);
    const photoRoute = route + '/reporter-requests/' + entry.id + '/photo';
    assert.equal((await send(photoRoute)).status, 401);
    const privatePhoto = await send(photoRoute, 'GET', undefined, cookie);
    assert.match(privatePhoto.headers.get('content-type'), /^image\/png/);
    assert.deepEqual(Buffer.from(await privatePhoto.arrayBuffer()), photo);

    const saved = (await (await send(route + '/pin', 'PUT', pin, cookie)).json()).data;
    assert.equal(saved.lat, pin.lat);
    assert.equal(saved.pin_history[0].previous_lat, originalPin.lat);
    assert.equal(saved.pin_history[0].reviewer, 'Shared admin');
    assert.equal(saved.pin_history[0].previous_address, formerAddress);
    assert.equal(saved.pin_history[0].barangay, newBarangay);
    assert.equal(saved.pin_history[0].address, pin.address);
    assert.equal((await send(route + '/pin', 'PUT', pin, cookie)).status, 409);
    const publicDetail = await get('/api/hazards/' + submission.hazard_id);
    assert.equal(publicDetail.hazard.lat, pin.lat);
    assert.equal(publicDetail.hazard.barangay_name, newBarangay);
    assert.equal(publicDetail.hazard.address, pin.address);
    assert.ok(publicDetail.contacts.some(contact => contact.facility_name === 'Corrected response desk'));
    assert.equal('reporter_requests' in publicDetail.hazard, false);
    assert.equal('pin_history' in publicDetail.hazard, false);
    assert.equal((await send(route + '/reporter-requests/' + entry.id, 'PUT', {}, cookie)).status, 200);
    queue = await adminGet('/reports?followup=attention');
    assert.ok(!queue.some(row => row.ref_number === submission.ref_number));

    const expired = await link();
    db.prepare("UPDATE reporter_followups SET expires_at = datetime('now', '-1 minute') WHERE report_id = (SELECT id FROM reports WHERE ref_number = ?) AND replied_at IS NULL").run(submission.ref_number);
    assert.equal((await respond(expired)).status, 404);
});

test('Needs attention uses the oldest due date and retains the cursor after a review', async () => {
    const headers = { 'Content-Type': 'application/json' };
    const send = (route, method = 'GET', body) => fetch(base + '/api/admin' + route, {
        method, headers, body: body ? JSON.stringify(body) : undefined
    });
    const login = await send('/login', 'POST', { password: process.env.ADMIN_PASSWORD });
    headers.Cookie = login.headers.get('set-cookie').split(';')[0];
    const search = '/reports?followup=attention&q=Oldest%20attention';
    const refs = [];
    for (const [index, due] of ['2000-03-10', '2000-01-10', '2000-02-10'].entries()) {
        const submitted = (await post(report({ title: 'Oldest attention report ' + index }))).body;
        refs.push(submitted.ref_number);
        const saved = await send('/reports/' + submitted.ref_number + '/workflow', 'PUT', {
            assignee: null, due_on: due, duplicate_ref: null, workflow_version: 0
        });
        assert.equal(saved.status, 200);
    }
    const list = await (await send(search)).json();
    assert.deepEqual(list.data.map(row => row.ref_number), [refs[1], refs[2], refs[0]]);
    assert.equal((await send('/reports/' + refs[1], 'PUT', {
        decision: 'validated', evaluated_level: null, notes: '', version: 0
    })).status, 200);
    const advanced = await (await send(search + '&next_after=' + refs[1] + '&next_priority=2&next_since=2000-01-10')).json();
    assert.equal(advanced.next_ref, refs[2]);
});
