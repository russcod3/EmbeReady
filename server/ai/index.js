/**
 * server/ai/index.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Unified AI service layer for EmbeReady.
 *
 * Responsibilities:
 *   A. assessHazard(hazard, barangay, historyCount) → risk assessment object
 *   B. generatePlan(category, barangayName) → preparedness plan object
 *   C. assessReport(reportData, barangay) → assessment for new user report
 *
 * Provider selection (from .env):
 *   AI_PROVIDER=none       → rule_based only (default)
 *   AI_PROVIDER=gemini     → Google Gemini API
 *   AI_PROVIDER=openai     → OpenAI Chat Completions API
 *   AI_PROVIDER=anthropic  → Anthropic Messages API
 *
 * If the LLM call fails (network error, bad key, rate limit, invalid JSON),
 * the system ALWAYS falls back to the rule-based engine and logs a warning.
 * A failed AI call never blocks report saving.
 *
 * All LLM calls request structured JSON and validate the response schema.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

require('dotenv').config();

const { scoreHazard } = require('./rules');
const { getPlan }     = require('./templates');

const AI_PROVIDER = (process.env.AI_PROVIDER || 'none').toLowerCase();
const MAX_RETRIES = 2;

// ── JSON schema for LLM assessment response ───────────────────────────────────
const ASSESSMENT_SCHEMA_KEYS = [
    'overall_score', 'assessed_level', 'factors_json',
    'confidence_level', 'reasoning_summary'
];

// ── Factor structure expected inside factors_json ─────────────────────────────
const FACTOR_KEYS = [
    'ignition_sources', 'fuel_combustibles', 'proximity_to_people',
    'structure_material', 'truck_access', 'fire_history',
    'weather_seasonal', 'human_behavior'
];

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * assessHazard — run full risk assessment for a hazard.
 */
async function assessHazard(hazard, barangay, historyCount = 0) {
    if (AI_PROVIDER === 'none') {
        return ruleBasedAssessment(hazard, barangay, historyCount);
    }
    try {
        return await llmAssessment(hazard, barangay, historyCount);
    } catch (err) {
        console.warn(`[AI] LLM assessment failed (${err.message}), falling back to rules.`);
        const result = ruleBasedAssessment(hazard, barangay, historyCount);
        result.reasoning_summary = `[LLM unavailable — rule-based estimate] ${result.reasoning_summary}`;
        return result;
    }
}

/**
 * generatePlan — return a preparedness plan for a hazard category.
 * LLM enhancement is additive; the template is always the base.
 */
async function generatePlan(category, barangayName = '') {
    // For now (no LLM key), always return the rich template plan.
    // When a key is added, the LLM can augment/localize the template.
    return getPlan(category, barangayName);
}

/**
 * assessReport — assess a newly submitted user report.
 * Returns { assessment, plan, suggestedLevel }
 */
async function assessReport(reportData, barangay) {
    const pseudoHazard = {
        category:   reportData.category,
        risk_level: reportData.risk_level,
        status:     reportData.status,
        description: reportData.description || ''
    };
    const assessment = await assessHazard(pseudoHazard, barangay, 0);
    const plan       = await generatePlan(reportData.category, barangay.name);

    return {
        assessment,
        plan,
        suggestedLevel:  assessment.assessed_level,
        reportedLevel:   reportData.risk_level
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// RULE-BASED ASSESSMENT
// ─────────────────────────────────────────────────────────────────────────────

function ruleBasedAssessment(hazard, barangay, historyCount) {
    return scoreHazard(hazard, barangay, historyCount);
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM ASSESSMENT (provider-agnostic with retry)
// ─────────────────────────────────────────────────────────────────────────────

async function llmAssessment(hazard, barangay, historyCount) {
    const prompt = buildPrompt(hazard, barangay, historyCount);
    let lastError;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const raw = await callProvider(prompt);
            const parsed = parseAndValidate(raw);
            parsed.engine        = 'llm';
            parsed.model_version = getModelVersion();
            return parsed;
        } catch (err) {
            lastError = err;
            console.warn(`[AI] Attempt ${attempt + 1} failed: ${err.message}`);
        }
    }
    throw lastError;
}

function buildPrompt(hazard, barangay, historyCount) {
    return `You are a fire risk assessment expert for Batangas City, Philippines, advising the Bureau of Fire Protection (BFP).

Assess this fire hazard and return a JSON object with EXACTLY this structure (no other text):

{
  "overall_score": <integer 0-100>,
  "assessed_level": "<low|moderate|heavy>",
  "confidence_level": "<low|medium|high>",
  "reasoning_summary": "<2-3 sentence plain language explanation>",
  "factors_json": {
    "ignition_sources":     {"score": <0-15>, "max_score": 15, "reason": "<string>"},
    "fuel_combustibles":    {"score": <0-15>, "max_score": 15, "reason": "<string>"},
    "proximity_to_people":  {"score": <0-15>, "max_score": 15, "reason": "<string>"},
    "structure_material":   {"score": <0-10>, "max_score": 10, "reason": "<string>"},
    "truck_access":         {"score": <0-10>, "max_score": 10, "reason": "<string>"},
    "fire_history":         {"score": <0-10>, "max_score": 10, "reason": "<string>"},
    "weather_seasonal":     {"score": <0-10>, "max_score": 10, "reason": "<string>"},
    "human_behavior":       {"score": <0-15>, "max_score": 15, "reason": "<string>"}
  }
}

HAZARD DATA:
- Category: ${hazard.category}
- Status: ${hazard.status}
- Reporter's risk level: ${hazard.risk_level}
- Description: ${hazard.description || 'None provided'}
- Barangay: ${barangay.name}, Batangas City
- Barangay classification: ${barangay.classification}
- Prior fire incidents nearby: ${historyCount}

SCORING GUIDE:
- overall_score = sum of all factor scores (max 100)
- Score → Level: 0-39=low, 40-64=moderate, 65-100=heavy
- Include Batangas City dry season context (Nov-May = severe fire weather)
- Reference BFP Batangas City and local barangay context where relevant

Respond ONLY with the JSON object above. No markdown, no explanation outside the JSON.`;
}

function parseAndValidate(raw) {
    let text = raw.trim();
    // Strip markdown code fences if present
    text = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim();

    let parsed;
    try {
        parsed = JSON.parse(text);
    } catch {
        throw new Error(`Invalid JSON from LLM: ${text.slice(0, 200)}`);
    }

    // Validate top-level keys
    for (const key of ASSESSMENT_SCHEMA_KEYS) {
        if (!(key in parsed)) throw new Error(`Missing key in LLM response: ${key}`);
    }
    if (!['low', 'moderate', 'heavy'].includes(parsed.assessed_level)) {
        throw new Error(`Invalid assessed_level: ${parsed.assessed_level}`);
    }

    // Normalize factors_json to string (store as JSON string in DB)
    if (typeof parsed.factors_json === 'object') {
        const factors = parsed.factors_json;
        for (const fk of FACTOR_KEYS) {
            if (!factors[fk]) throw new Error(`Missing factor: ${fk}`);
        }
        parsed.factors_json = JSON.stringify(factors);
    }

    // Clamp score
    parsed.overall_score = Math.max(0, Math.min(100, Math.round(Number(parsed.overall_score))));

    return parsed;
}

// ─────────────────────────────────────────────────────────────────────────────
// PROVIDER ADAPTERS
// ─────────────────────────────────────────────────────────────────────────────

async function callProvider(prompt) {
    switch (AI_PROVIDER) {
        case 'gemini':    return callGemini(prompt);
        case 'openai':    return callOpenAI(prompt);
        case 'anthropic': return callAnthropic(prompt);
        default: throw new Error(`Unknown AI provider: ${AI_PROVIDER}`);
    }
}

async function callGemini(prompt) {
    const fetch  = (await import('node-fetch')).default;
    const key    = process.env.GEMINI_API_KEY;
    const model  = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
    const url    = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: 'application/json' }
        })
    });
    if (!res.ok) throw new Error(`Gemini API ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callOpenAI(prompt) {
    const fetch = (await import('node-fetch')).default;
    const key   = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            response_format: { type: 'json_object' }
        })
    });
    if (!res.ok) throw new Error(`OpenAI API ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
}

async function callAnthropic(prompt) {
    const fetch = (await import('node-fetch')).default;
    const key   = process.env.ANTHROPIC_API_KEY;
    const model = process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307';

    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
            model,
            max_tokens: 1024,
            messages: [{ role: 'user', content: prompt }]
        })
    });
    if (!res.ok) throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return data.content?.[0]?.text || '';
}

function getModelVersion() {
    switch (AI_PROVIDER) {
        case 'gemini':    return process.env.GEMINI_MODEL    || 'gemini-1.5-flash';
        case 'openai':    return process.env.OPENAI_MODEL    || 'gpt-4o-mini';
        case 'anthropic': return process.env.ANTHROPIC_MODEL || 'claude-3-haiku-20240307';
        default:          return 'none';
    }
}

module.exports = { assessHazard, generatePlan, assessReport };
