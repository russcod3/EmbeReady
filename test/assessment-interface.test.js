'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {loadFrontend}=require('./frontend-helpers');
const {exports:copy}=loadFrontend('public/js/assessment-copy.js',['assessmentText','isPreparedAssessment']);
const {exports:strings}=loadFrontend('public/strings.js',['S','getStrings','getLanguage','setLanguage'],{
    localStorage:{getItem(){return null;},setItem(){}},window:{dispatchEvent(){}},CustomEvent:class {}
});

test('seeded factor prose is cleaned for display without changing stored results or Gemini prose',()=>{
    const fixtures=require('../server/data/demo-assessments.json');
    const original=JSON.stringify(fixtures);
    for(const fixture of Object.values(fixtures))for(const factor of Object.values(JSON.parse(fixture.result.assessment.factors_json))){
        const text=copy.assessmentText(factor.reason,true);
        assert.ok(text.trim());
        assert.doesNotMatch(text,/\b(mock|fictional|synthetic|demo)\b/i);
        assert.equal(copy.assessmentText(factor.reason,false),factor.reason);
    }
    assert.equal(JSON.stringify(fixtures),original);
    assert.equal(copy.isPreparedAssessment({engine:'mock'}),true);
    assert.equal(copy.isPreparedAssessment({engine:'llm',model_version:'gemini-2.5-flash-lite'}),false);
});

test('risk cards render in English and Tagalog and keep original observation wording',()=>{
    const {exports:cards}=loadFrontend('public/js/risk-cards.js',['riskCardsMarkup'],{S:strings.S,escapeHtml:value=>String(value||'')});
    const factors={ignition_sources:{score:3,max_score:20,reason:'Recorded observation'}};
    strings.setLanguage('en');
    assert.match(cards.riskCardsMarkup(factors),/Ignition/);
    strings.setLanguage('tl');
    const markup=cards.riskCardsMarkup(factors);
    assert.match(markup,/Pinagmumulan ng apoy/);
    assert.match(markup,/Susunod na salik/);
    assert.equal(factors.ignition_sources.reason,'Recorded observation');
    strings.setLanguage('en');
});

test('every declarative translation key exists in both languages',()=>{
    const files=['public/index.html','public/js/experience.js','public/js/ember.js'];
    for(const file of files){
        const source=fs.readFileSync(path.join(__dirname,'..',file),'utf8');
        for(const [,key] of source.matchAll(/data-i18n(?:-placeholder|-aria-label|-title)?="([^"]+)"/g)){
            for(const language of ['en','tl']){
                const value=key.split('.').reduce((object,part)=>object?.[part],strings.getStrings(language));
                assert.equal(typeof value,'string',`${language}: ${key}`);
            }
        }
    }
});

test('saved Tagalog preference loads safely and unavailable storage does not break the interface',()=>{
    const blocked=()=>{throw new Error('Storage is disabled');};
    const load=getItem=>loadFrontend('public/strings.js',['S','getLanguage','setLanguage'],{
        localStorage:{getItem,setItem:blocked},window:{dispatchEvent(){}},CustomEvent:class {}
    }).exports;
    const saved=load(()=> 'fil');
    assert.equal(saved.getLanguage(),'tl');
    assert.equal(saved.S.map.filterAll,'Lahat');
    assert.doesNotThrow(()=>saved.setLanguage('en'));
    assert.equal(saved.S.map.filterAll,'All');
    const unavailable=load(blocked);
    assert.equal(unavailable.getLanguage(),'en');
    assert.doesNotThrow(()=>unavailable.setLanguage('tl'));
    assert.equal(unavailable.S.map.filterAll,'Lahat');
});

test('success effect never starts before a confirmed, visible saved report',()=>{
    let creates=0;
    const {exports:effect}=loadFrontend('public/js/report-success.js',['playReportSuccess'],{document:{createElement(){creates++;throw new Error('Unexpected effect');}}});
    const dialog={open:true,querySelector(){return null;}};
    effect.playReportSuccess(dialog,{pending:true,ref_number:'sample'});
    effect.playReportSuccess(dialog,{});
    effect.playReportSuccess({...dialog,open:false},{ref_number:'sample'});
    assert.equal(creates,0);
});

test('responder contacts use the selected barangay hotline and skip legacy placeholders',()=>{
    const {exports:{responderContacts}}=loadFrontend('public/js/report-contacts.js',['responderContacts']);
    const contacts=[
        {agency_type:'Barangay',jurisdiction:'Bucal',facility_name:'Old barangay entry',phone_display:'REPLACE-ME',is_placeholder:1},
        {agency_type:'Barangay',jurisdiction:'Bucal',facility_name:'Demo barangay desk',phone_display:'(043) 965 1496',phone_dialable:null,is_placeholder:1},
        {agency_type:'Barangay',jurisdiction:'Bucal',facility_name:'Barangay Hall / Tanod — Bucal',phone_display:'0927 777 0253',phone_dialable:'09277770253',is_placeholder:0},
        {agency_type:'Barangay',jurisdiction:'Gulod Labac',facility_name:'Another barangay',phone_display:'(043) 783 4617',phone_dialable:'0437834617',is_placeholder:0}
    ];
    const barangay=responderContacts(contacts,'Bucal').find(contact=>contact.agency==='barangay');
    assert.equal(barangay.number,'0927 777 0253');
    assert.equal(barangay.jurisdiction,'Bucal');
    assert.equal(barangay.unavailable,false);
    assert.equal(barangay.mock,false);
});

test('the report panel displays all 105 saved barangay numbers, including 52 mock hotlines',()=>{
    const {exports:{responderContacts}}=loadFrontend('public/js/report-contacts.js',['responderContacts']);
    const catalogue=require('../server/contacts.json');
    const barangays=catalogue.filter(contact=>contact.agency_type==='Barangay');
    assert.equal(barangays.length,105);
    assert.equal(barangays.filter(contact=>contact.is_placeholder).length,52);
    for(const saved of barangays){
        const displayed=responderContacts(catalogue,saved.jurisdiction).find(contact=>contact.agency==='barangay');
        assert.equal(displayed.number,saved.phone_display,saved.jurisdiction);
        assert.equal(displayed.unavailable,false,saved.jurisdiction);
        assert.equal(displayed.mock,saved.is_placeholder,saved.jurisdiction);
        if(displayed.mock){
            assert.match(displayed.number,/^\(043\) [7-9]\d{2} \d{4}$/);
            assert.equal(saved.phone_dialable,null);
        }
    }
});

test('unavailable hotlines never receive invented fallback numbers',()=>{
    const {exports:{responderContacts}}=loadFrontend('public/js/report-contacts.js',['responderContacts']);
    for(const contacts of [[],[
        {agency_type:'Barangay',jurisdiction:'Conde Labac',facility_name:'Barangay Hall / Tanod — Conde Labac',phone_display:'N/A',phone_dialable:null,is_placeholder:1},
        {agency_type:'Barangay',jurisdiction:'Cuta',facility_name:'Other barangay',phone_display:'(043) 723 3470',phone_dialable:'0437233470',is_placeholder:0}
    ]]){
        for(const contact of responderContacts(contacts,'Conde Labac')){
            assert.equal(contact.unavailable,true);
            assert.equal(contact.number,'');
        }
    }
});
