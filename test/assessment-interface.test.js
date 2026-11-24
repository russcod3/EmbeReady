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
