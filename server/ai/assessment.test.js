'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
process.env.AI_PROVIDER = 'gemini';
process.env.GEMINI_API_KEY = 'test-only-key';
const ai = require('./index');
const fields = ['ignition_sources','fuel_combustibles','proximity_to_people','structure_material','truck_access','fire_history','weather_seasonal','human_behavior'];
const maxima = [15,15,15,10,10,10,10,15];
const hazard = { title: 'Test wiring hazard', category: 'faulty_wiring', risk_level: 'low', status: 'potential', description: 'Exposed wires' };
const barangay = { name: 'Test barangay', classification: 'urban' };
const response = value => ({ ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify(value) }] } }] }) });
test('Gemini risk and guidance are validated, normalized and identified', async t => {
    const original = global.fetch;
    t.after(() => {global.fetch = original;});
    global.fetch = async (url, options) => {
        assert.ok(!url.includes('test-only-key'));
        assert.equal(options.headers['x-goog-api-key'], 'test-only-key');
        const prompt = JSON.parse(options.body).contents[0].parts[0].text;
        if (prompt.startsWith('Generate conservative')) return response(Object.fromEntries([
            ...['before_steps','during_steps','after_steps','evacuation_tips','prohibited_actions'].map(k => [k,['Keep clear.','Contact responders.']]),
            ['local_context_notes','Based on reported conditions.']
        ]));
        return response({ overall_score: 1, assessed_level: 'low', confidence_level: 'medium', reasoning_summary: 'Potential ignition source.', factors_json: Object.fromEntries(fields.map((key,i) => [key,{score:maxima[i],max_score:maxima[i],reason:'Observed condition'}])) });
    };
    const result = await ai.assessReport(hazard, barangay);
    assert.equal(result.assessment.overall_score, 100);
    assert.equal(result.suggestedLevel, 'heavy');
    assert.equal(result.assessment.engine, 'llm');
    assert.equal(JSON.parse(result.plan.before_steps_json).length, 2);
    assert.match(result.plan.local_context_notes, /AI-generated/);
});
test('malformed model output yields labelled fallback instead of invalid scores', async t => {
    const original = global.fetch;
    t.after(() => {global.fetch = original;});
    global.fetch = async () => response({ overall_score:'not a score', assessed_level:'heavy', confidence_level:'medium', reasoning_summary:'bad', factors_json:{} });
    const result = await ai.assessReport(hazard, barangay);
    assert.equal(result.assessment.engine, 'rule_based');
    assert.ok(Number.isFinite(result.assessment.overall_score));
    assert.match(result.plan.local_context_notes, /Template guidance/);
});
test('network failure preserves an assessable report and template plan', async t => {
    const original = global.fetch;
    t.after(() => {global.fetch = original;});
    global.fetch = async () => {throw new Error('Network unavailable');};
    const result = await ai.assessReport({...hazard,status:'active'}, barangay);
    assert.equal(result.assessment.engine, 'rule_based');
    assert.match(result.assessment.reasoning_summary, /LLM unavailable/);
    assert.ok(JSON.parse(result.plan.during_steps_json).length);
});
