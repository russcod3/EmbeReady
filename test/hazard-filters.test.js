'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { loadFrontend, element } = require('./frontend-helpers');
const { exports: rules } = loadFrontend('public/js/hazard-filters.js', ['HAZARD_LEVELS', 'createActiveLevels', 'isLevelActive', 'toggleLevel', 'resetLevels', 'hazardLevel', 'filterHazards']);
const levels = ['live', 'high', 'moderate', 'low'];
const hazards = [
    { id: 1, status:'active', risk_level:'low', barangay_id:1, category:'faulty_wiring' },
    { id: 2, status:'potential', risk_level:'heavy', barangay_id:1, category:'faulty_wiring' },
    { id: 3, status:'contained', risk_level:'moderate', barangay_id:2, category:'faulty_wiring' },
    { id: 4, status:'potential', risk_level:'low', barangay_id:1, category:'dry_grass' }
];

function controls(storage = new Map()) {
    const chips = ['all', ...levels].map(level => element({ filter:level }));
    const removes=levels.map(level=>element({removeLevel:level}));
    const nodes = Object.fromEntries(['filter-barangay-select','filter-category-select','filter-reset-btn','filter-hint','filter-hint-dismiss','filter-tip','filter-tip-dismiss','hazard-empty-state','map-empty-state','live-fire-counter','live-counter-text'].map(id => [id,element()]));
    const rendered = [];
    let fetchSnapshot = async () => hazards;
    const { context } = loadFrontend('public/js/app.js', [], {
        ...rules, S: { map: { hideAll:'Hide all', showAll:'Show all', liveCount:n=>`${n} Live` }, errors:{loadFailed:'Failed'} },
        document: { addEventListener() {}, querySelector(){return null;}, querySelectorAll:selector => selector === '.filter-bar .filter-chip' ? chips : selector === '[data-remove-level]' ? removes : [], getElementById:id => nodes[id] },
        localStorage: {getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},
        window:{dispatchEvent(){}},Event:class {},
        renderHazards:visible => rendered.push([...visible]), closeDrawer() {},
        fetchHazards:() => fetchSnapshot(),
        fetch:() => { throw new Error('Network requests are forbidden in frontend tests'); }
    });
    const app = vm.runInContext(`({ setupFilters, loadHazards, install(hazards) { _allHazards=hazards; _hazardsLoaded=true; }, active() { return [..._activeLevels]; } })`, context);
    app.install(hazards);
    app.setupFilters();
    return { chips, removes, nodes, app, storage, visible:()=>rendered.at(-1).map(h=>h.id), fetchFrom:fn=>{fetchSnapshot=fn;} };
}

function expectView(ui, active, ids) {
    assert.deepEqual([...ui.app.active()].sort(), [...active].sort());
    for (const chip of ui.chips) {
        const on = chip.dataset.filter === 'all' ? active.length === 4 : active.includes(chip.dataset.filter);
        assert.equal(chip.getAttribute('aria-pressed'), String(on), chip.dataset.filter);
        assert.equal(chip.classList.contains('is-active'), on, chip.dataset.filter);
    }
    assert.deepEqual(ui.visible(), ids);
    assert.equal(ui.nodes['hazard-empty-state'].hidden, ids.length > 0);
    assert.equal(ui.nodes['map-empty-state'].hidden, ids.length > 0);
}

test('requested seven-step walkthrough keeps markers, highlights and pressed states aligned', () => {
    const ui = controls(), click=level=>ui.chips.find(chip=>chip.dataset.filter===level).click();
    expectView(ui, levels, [1,2,3,4]);
    click('all'); expectView(ui, [], []);
    click('low'); click('high'); expectView(ui, ['low','high'], [2,4]);
    click('low'); expectView(ui, ['high'], [2]);
    click('all'); expectView(ui, levels, [1,2,3,4]);
    click('moderate'); expectView(ui, ['live','high','low'], [1,2,4]);
    click('moderate'); expectView(ui, levels, [1,2,3,4]);
});

test('all 16 combinations use independent switches; live fires are not included by their risk band', () => {
    for(let mask=0;mask<16;mask++) {
        const active = rules.createActiveLevels();
        for(let index=0;index<4;index++) if(!(mask & (1<<index)))rules.toggleLevel(active,levels[index]);
        assert.equal(rules.isLevelActive(active,'all'),mask===15);
        const visible=rules.filterHazards(hazards,active);
        assert.deepEqual([...visible].map(h=>h.id),hazards.filter((h,index)=>mask&(1<<index)).map(h=>h.id));
        const sameSet=rules.toggleLevel(active,'all');
        assert.equal(sameSet,active);
        assert.deepEqual([...active].sort(),mask===15?[]:[...levels].sort());
    }
});

test('barangay and category selections combine with the Set; Clear filters resets everything', () => {
    const ui=controls();
    ui.chips.find(chip=>chip.dataset.filter==='moderate').click();
    ui.nodes['filter-barangay-select'].change('1');
    ui.nodes['filter-category-select'].change('faulty_wiring');
    expectView(ui,['live','high','low'],[1,2]);
    ui.nodes['filter-category-select'].change('blocked_exit');
    expectView(ui,['live','high','low'],[]);
    ui.nodes['filter-reset-btn'].click();
    expectView(ui,levels,[1,2,3,4]);
    assert.equal(ui.nodes['filter-barangay-select'].value,'');
    assert.equal(ui.nodes['filter-category-select'].value,'');
});

test('an in-flight refresh respects toggles made before its response, including All off', async () => {
    const ui=controls();let resolve;
    ui.fetchFrom(()=>new Promise(done=>{resolve=done;}));
    const pending=ui.app.loadHazards();
    ui.chips[0].click();
    resolve(hazards);await pending;
    expectView(ui,[],[]);
});

test('late older responses cannot replace a newer snapshot', async () => {
    const ui=controls();let resolveOld;
    ui.fetchFrom(()=>new Promise(done=>{resolveOld=done;}));
    const old=ui.app.loadHazards();
    ui.fetchFrom(async()=>[hazards[3]]);
    await ui.app.loadHazards();
    resolveOld(hazards);await old;
    expectView(ui,levels,[4]);
});

test('the first-time tip can be dismissed and stays dismissed on a later visit', () => {
    const ui=controls();assert.equal(ui.nodes['filter-tip'].hidden,false);
    ui.nodes['filter-tip-dismiss'].click();assert.equal(ui.nodes['filter-tip'].hidden,true);
    const returning=controls(ui.storage);assert.equal(returning.nodes['filter-tip'].hidden,true);
});

test('stored heavy and reporter-selected levels use the correct switch without assigning unknown scores', () => {
    assert.equal(rules.hazardLevel({risk_level:'heavy'}),'high');
    assert.equal(rules.hazardLevel({reported_level:'low',risk_level:null}),'low');
    assert.equal(rules.hazardLevel({status:'active',risk_level:'heavy'}),'live');
    const unknown={id:5,risk_level:null};
    assert.equal(rules.filterHazards([unknown],rules.createActiveLevels()).length,1);
    assert.equal(rules.filterHazards([unknown],new Set(['low'])).length,0);
});

 test('corner remove disables only its own level and keeps Clear filters aligned',()=>{
    const ui=controls();
    ui.removes.find(button=>button.dataset.removeLevel==='high').click();
    expectView(ui,['live','moderate','low'],[1,3,4]);
    assert.equal(ui.removes.find(button=>button.dataset.removeLevel==='high').hidden,true);
    ui.chips.find(button=>button.dataset.filter==='high').click();
    expectView(ui,levels,[1,2,3,4]);
    assert.equal(ui.removes.find(button=>button.dataset.removeLevel==='high').hidden,false);
    ui.nodes['filter-reset-btn'].click();expectView(ui,levels,[1,2,3,4]);
});

test('Got it dismisses the filter explanation and remembers the dismissal',()=>{
    const ui=controls();
    assert.equal(ui.nodes['filter-hint'].hidden,false);
    ui.nodes['filter-hint-dismiss'].click();
    assert.equal(ui.nodes['filter-hint'].hidden,true);
    assert.equal(controls(ui.storage).nodes['filter-hint'].hidden,true);
    assert.equal(ui.nodes['filter-tip'].hidden,false);
});
