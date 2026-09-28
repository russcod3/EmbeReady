/**
 * server/reassess.js
 * ─────────────────────────────────────────────────────────────────────────────
 * npm run reassess
 *
 * Re-runs the AI/rule-based assessment on ALL hazards in the database.
 * Useful after:
 *   - Adding an AI key to .env (run to upgrade all rule-based assessments)
 *   - Adding new fire history records near a hazard
 *   - Manual edits to hazard records
 *
 * The script does NOT delete old assessments — it inserts new ones which
 * become the "latest" used by the API (ORDER BY created_at DESC LIMIT 1).
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

require('dotenv').config();

const db  = require('./db');
const ai  = require('./ai');

async function reassessAll() {
    console.log('\n[reassess] Starting re-assessment of all hazards...\n');

    const hazards = db.prepare(`
        SELECT h.*, b.name AS barangay_name, b.classification AS barangay_classification
        FROM hazards h
        JOIN barangays b ON h.barangay_id = b.id
    `).all();

    const insertAssessment = db.prepare(`
        INSERT INTO risk_assessments
            (hazard_id, overall_score, assessed_level, factors_json,
             confidence_level, reasoning_summary, engine, model_version)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertPlan = db.prepare(`
        INSERT INTO preparedness_plans
            (hazard_id, before_steps_json, during_steps_json, after_steps_json,
             evacuation_tips_json, prohibited_actions_json, local_context_notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    let success = 0;
    let failed  = 0;

    for (const hazard of hazards) {
        const barangay = {
            name:           hazard.barangay_name,
            classification: hazard.barangay_classification
        };

        const historyCount = db.prepare(`
            SELECT COUNT(*) as c FROM fire_history WHERE hazard_id = ?
        `).get(hazard.id)?.c || 0;

        try {
            // Risk assessment
            const assessment = await ai.assessHazard(hazard, barangay, historyCount);
            insertAssessment.run(
                hazard.id,
                assessment.overall_score,
                assessment.assessed_level,
                assessment.factors_json,
                assessment.confidence_level,
                assessment.reasoning_summary,
                assessment.engine,
                assessment.model_version
            );

            // Preparedness plan
            const plan = await ai.generatePlan(hazard.category, hazard.barangay_name);
            insertPlan.run(
                hazard.id,
                plan.before_steps_json,
                plan.during_steps_json,
                plan.after_steps_json,
                plan.evacuation_tips_json,
                plan.prohibited_actions_json,
                plan.local_context_notes
            );

            console.log(`  ✓ [${hazard.ref_code}] ${hazard.title.slice(0, 55)}`);
            success++;
        } catch (err) {
            console.error(`  ✗ [${hazard.ref_code}] Failed: ${err.message}`);
            failed++;
        }
    }

    console.log(`\n[reassess] Done. ${success} succeeded, ${failed} failed.\n`);
}

reassessAll().catch(err => {
    console.error('[reassess] Fatal error:', err);
    process.exit(1);
});
