'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const filters = import('../public/js/hazard-filters.mjs');
const hazards = [
    { id: 1, status: 'active', risk_level: 'heavy', barangay_id: 1, category: 'other' },
    { id: 2, status: 'potential', risk_level: 'heavy', barangay_id: 1, category: 'faulty_wiring' },
    { id: 3, status: 'potential', risk_level: 'moderate', barangay_id: 2, category: 'other' },
    { id: 4, status: 'resolved', risk_level: 'low', barangay_id: 1, category: 'other' }
];

test('seven-step level toggle walkthrough keeps derived All and markers in sync', async () => {
    const { HAZARD_LEVELS, allLevelsActive, toggleLevel, filterHazards } = await filters;
    let active = new Set(HAZARD_LEVELS);
    const check = (levels, ids, all) => {
        assert.deepEqual([...active].sort(), [...levels].sort());
        assert.equal(allLevelsActive(active), all);
        assert.deepEqual(filterHazards(hazards, active).map(h => h.id), ids);
    };
    check(HAZARD_LEVELS, [1, 2, 3, 4], true);
    active = toggleLevel(active, 'all');
    check([], [], false);
    active = toggleLevel(active, 'low');
    check(['low'], [4], false);
    active = toggleLevel(active, 'high');
    check(['low', 'high'], [2, 4], false);
    active = toggleLevel(active, 'low');
    check(['high'], [2], false);
    active = toggleLevel(active, 'all');
    check(HAZARD_LEVELS, [1, 2, 3, 4], true);
    active = toggleLevel(active, 'moderate');
    check(['live', 'high', 'low'], [1, 2, 4], false);
    active = toggleLevel(active, 'moderate');
    check(HAZARD_LEVELS, [1, 2, 3, 4], true);
});

test('all sixteen level combinations obey independent switches and All semantics', async () => {
    const { HAZARD_LEVELS, allLevelsActive, toggleLevel } = await filters;
    for (let mask = 0; mask < 16; mask++) {
        const active = new Set(HAZARD_LEVELS.filter((_, index) => mask & (1 << index)));
        assert.equal(allLevelsActive(active), mask === 15);
        assert.deepEqual([...toggleLevel(active, 'all')], mask === 15 ? [] : HAZARD_LEVELS);
        for (const level of HAZARD_LEVELS) {
            const next = toggleLevel(active, level);
            assert.notEqual(next.has(level), active.has(level));
            for (const other of HAZARD_LEVELS.filter(item => item !== level)) {
                assert.equal(next.has(other), active.has(other));
            }
            assert.deepEqual(toggleLevel(next, level), active);
        }
    }
});

test('level, barangay and category filters intersect; Live is separate from High', async () => {
    const { HAZARD_LEVELS, filterHazards } = await filters;
    const all = new Set(HAZARD_LEVELS);
    const ids = (levels, other) => filterHazards(hazards, levels, other).map(h => h.id);
    assert.deepEqual(ids(new Set(['live'])), [1]);
    assert.deepEqual(ids(new Set(['high'])), [2]);
    assert.deepEqual(ids(all, { barangay_id: '1', category: 'other' }), [1, 4]);
    assert.deepEqual(ids(new Set(['high']), { barangay_id: '1', category: 'other' }), []);
    assert.deepEqual(ids(all, { barangay_id: '2', category: 'faulty_wiring' }), []);
    assert.deepEqual(ids(new Set(), { barangay_id: '1' }), []);
    // Clear filters restores all four levels and both dropdown defaults.
    assert.deepEqual(ids(new Set(HAZARD_LEVELS), { barangay_id: '', category: '' }), [1, 2, 3, 4]);
});

test('unclassified reports show by default without inventing a risk level', async () => {
    const { HAZARD_LEVELS, filterHazards } = await filters;
    const pending = [{ id: 5, status: 'potential', risk_level: null }];
    assert.deepEqual(filterHazards(pending, new Set(HAZARD_LEVELS)), pending);
    assert.deepEqual(filterHazards(pending, new Set(['low'])), []);
    assert.deepEqual(filterHazards(pending, new Set()), []);
});
