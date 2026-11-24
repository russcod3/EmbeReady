'use strict';

const express = require('express');
const db = require('../db');
const assessments = require('../assessment-service');
const { installAdminAuth, fail } = require('../admin-auth');
const { installDemoQueue, queueOrder, saveWorkflow, workflowDetails } = require('../report-workflow');

const router = express.Router();
const decisions = ['validated', 'needs_verification', 'dismissed'];
const levels = ['low', 'moderate', 'heavy'];
const reasons = ['unclear_location', 'possible_duplicate', 'insufficient_evidence', 'other'];
const pageSize = 20;

installAdminAuth(router);
installDemoQueue(router);

const reportJoins = `
    FROM reports r
    LEFT JOIN hazards h ON h.id = r.hazard_id
    LEFT JOIN barangays b ON b.id = h.barangay_id
    LEFT JOIN report_reviews v ON v.report_id = r.id
    LEFT JOIN report_followups f ON f.report_id = r.id
    LEFT JOIN reports original ON original.id = f.duplicate_of
    LEFT JOIN review_demo_hazards demo ON demo.hazard_id = h.id
    LEFT JOIN report_review_history e ON e.report_id = r.id AND e.version = v.version
`;
const reportScope = `WHERE r.honeypot_triggered = 0 AND (COALESCE(h.is_demo, 0) = 0 OR demo.hazard_id IS NOT NULL)`;
const reports = `${reportJoins} ${reportScope}`;
const summaryFields = `
    r.ref_number, r.reported_level, r.created_at,
    h.title, h.status AS incident_status, b.name AS barangay,
    COALESCE(v.decision, 'pending') AS decision, e.reason, f.assignee, f.due_on,
    original.ref_number AS duplicate_ref, (demo.hazard_id IS NOT NULL) AS is_training
`;

router.get('/reports', (req, res) => {
    const { decision = 'all', reason = 'all', q = '', page = '1',
        followup = 'all', source = 'community', next_after = '' } = req.query;
    const pageNumber = Number(page);
    if (!['all', 'pending', ...decisions].includes(decision) || !['all', ...reasons].includes(reason) || typeof q !== 'string' ||
        !['community', 'demo'].includes(source) || !['all', 'mine', 'overdue'].includes(followup) ||
        typeof next_after !== 'string' || next_after.length > 64 || typeof page !== 'string' || !Number.isSafeInteger(pageNumber) || pageNumber < 1) {
        return fail(res, 400, 'Invalid report filters.');
    }

    const training = Number(source === 'demo');
    const sourceFilter = 'AND (demo.hazard_id IS NOT NULL) = ?';
    const isOpen = "COALESCE(v.decision, 'pending') IN ('pending', 'needs_verification') AND COALESCE(h.status, '') <> 'resolved'";
    const counts = { all: 0, pending: 0, needs_verification: 0, validated: 0, dismissed: 0 };
    const grouped = db.prepare(`SELECT COALESCE(v.decision, 'pending') AS decision, COUNT(*) AS total
        ${reports} ${sourceFilter} GROUP BY COALESCE(v.decision, 'pending')`).all(training);
    for (const row of grouped) {
        counts[row.decision] = row.total;
        counts.all += row.total;
    }

    const query = q.trim().toLowerCase().slice(0, 120);
    const filters = `${sourceFilter}
        AND (? = 'all' OR ((${isOpen}) AND
            ((? = 'mine' AND f.assignee = ?) OR (? = 'overdue' AND f.due_on < date('now', '+8 hours')))))
        AND (? = 'all' OR COALESCE(v.decision, 'pending') = ?)
        AND (? = 'all' OR e.reason = ?)
        AND (instr(lower(r.ref_number), ?) > 0 OR instr(lower(COALESCE(h.title, '')), ?) > 0
             OR instr(lower(COALESCE(b.name, '')), ?) > 0)`;
    const params = [training, followup, followup, req.reviewer.username, followup, decision, decision, reason, reason, query, query, query];
    const { total } = db.prepare(`SELECT COUNT(*) AS total ${reports} ${filters}`).get(...params);
    const pages = Math.max(1, Math.ceil(total / pageSize));
    let currentPage = Math.min(pageNumber, pages);
    let nextRef = null;
    const current = next_after && reportDetail.get(next_after);
    if (current?.is_training === training) {
        const priority = Number(current.incident_status !== 'active');
        const candidate = db.prepare(`
            SELECT ref_number, row_number_in_queue FROM (
                SELECT r.id, r.ref_number, CASE WHEN h.status = 'active' THEN 0 ELSE 1 END AS priority,
                    ROW_NUMBER() OVER (ORDER BY ${queueOrder}) AS row_number_in_queue
                ${reports} ${filters}
            ) WHERE priority > ? OR (priority = ? AND id < ?)
            ORDER BY row_number_in_queue LIMIT 1
        `).get(...params, priority, priority, current.id);
        if (candidate) {
            nextRef = candidate.ref_number;
            currentPage = Math.ceil(candidate.row_number_in_queue / pageSize);
        }
    }
    const data = db.prepare(`SELECT ${summaryFields} ${reports} ${filters}
        ORDER BY ${queueOrder} LIMIT ? OFFSET ?`)
        .all(...params, pageSize, (currentPage - 1) * pageSize);

    res.json({ success: true, data, counts, page: currentPage, pages, total, next_ref: nextRef, reviewer: req.reviewer });
});

const reportDetail = db.prepare(`
    SELECT ${summaryFields}, r.id, r.hazard_id, h.category, h.description, h.address,
           h.lat, h.lng, h.photo_url, o.data_json AS observations_json,
           (h.active_started_at IS NOT NULL OR h.status = 'active') AS was_live,
           COALESCE(f.version, 0) AS workflow_version,
           v.evaluated_level, v.notes, v.updated_at AS reviewed_at, COALESCE(v.version, 0) AS version
    ${reportJoins}
    LEFT JOIN hazard_observations o ON o.hazard_id = h.id
    ${reportScope} AND r.ref_number = ?
`);

const nearbyReports = db.prepare(`
    SELECT ${summaryFields}, h.lat, h.lng
    ${reports}
    AND r.id <> ? AND (demo.hazard_id IS NOT NULL) = ? AND h.lat BETWEEN ? AND ? AND h.lng BETWEEN ? AND ?
    AND (h.lat - ?) * (h.lat - ?) + (h.lng - ?) * (h.lng - ?) * ? <= ?
    ORDER BY (h.lat - ?) * (h.lat - ?) + (h.lng - ?) * (h.lng - ?) * ?, r.id DESC
    LIMIT 5
`);
const reviewHistory = db.prepare(`
    SELECT version, decision, evaluated_level, reason, notes, reviewer, reviewed_at
    FROM report_review_history WHERE report_id = ? ORDER BY version DESC
`);

function nearby(report) {
    const { id, lat, lng } = report;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return [];
    const radius = 500 / 111195;
    const scale = Math.cos(lat * Math.PI / 180);
    const longitudeRadius = radius / scale;
    const center = [lat, lat, lng, lng, scale ** 2];
    return nearbyReports.all(id, report.is_training, lat - radius, lat + radius, lng - longitudeRadius, lng + longitudeRadius,
        ...center, radius ** 2, ...center).map(item => ({
        ...item, distance: Math.round(111195 * Math.hypot(item.lat - lat, (item.lng - lng) * scale))
    }));
}

router.get('/reports/:ref', (req, res) => {
    const report = reportDetail.get(req.params.ref);
    if (!report) return fail(res, 404, 'Report not found.');
    const { id, hazard_id, observations_json, ...data } = report;
    const assessment = hazard_id && assessments.detail(hazard_id);
    data.observations = observations_json ? JSON.parse(observations_json).fields : null;
    data.assessment = assessment?.assessment ?? null;
    data.ai_status = data.is_training ? 'demo' : data.was_live ? 'not_requested' : assessment?.ai_status;
    data.nearby = nearby(report);
    data.history = reviewHistory.all(id);
    data.has_location = hazard_id !== null;
    res.json({ success: true, data: { ...data, ...workflowDetails(report) } });
});
saveWorkflow(router, reportDetail);

const saveReview = db.prepare(`
    INSERT INTO report_reviews (report_id, decision, evaluated_level, notes, version)
    SELECT ?, ?, ?, ?, 1
    WHERE ? = 0 OR EXISTS (SELECT 1 FROM report_reviews WHERE report_id = ?)
    ON CONFLICT (report_id) DO UPDATE SET
        decision = excluded.decision, evaluated_level = excluded.evaluated_level,
        notes = excluded.notes, updated_at = datetime('now'), version = report_reviews.version + 1
    WHERE report_reviews.version = ?
    RETURNING decision, evaluated_level, notes, updated_at AS reviewed_at, version
`);

const recordReview = db.prepare(`
    INSERT INTO report_review_history
        (report_id, version, decision, evaluated_level, reason, notes, reviewer, reviewed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

router.put('/reports/:ref', (req, res) => {
    const report = reportDetail.get(req.params.ref);
    if (!report) return fail(res, 404, 'Report not found.');

    const { decision, evaluated_level: level, notes, version, reason = null } = req.body ?? {};
    if (!decisions.includes(decision) || (level !== null && !levels.includes(level)) ||
        typeof notes !== 'string' || notes.length > 2000 || !Number.isSafeInteger(version) || version < 0) {
        return fail(res, 400, 'Choose a valid decision and risk level, and keep notes under 2,000 characters.');
    }
    if (decision !== 'validated' && !notes.trim()) {
        return fail(res, 400, 'Add a note explaining why the report needs verification or was dismissed.');
    }

    if (decision === 'needs_verification' ? !reasons.includes(reason) : reason !== null) {
        return fail(res, 400, 'Select a follow-up reason when a report needs verification.');
    }
    const review = db.runTransaction(() => {
        const saved = saveReview.get(report.id, decision, level, notes.trim(), version, report.id, version);
        if (!saved) return null;
        recordReview.run(report.id, saved.version, decision, level, reason, saved.notes, req.reviewer.username, saved.reviewed_at);
        return { ...saved, reason, history: reviewHistory.all(report.id) };
    });
    if (!review) return fail(res, 409, 'This report was reviewed elsewhere. Copy any unsaved notes, then reopen the report before editing.');
    res.json({ success: true, data: review });
});

router.use((req, res) => fail(res, 404, 'Admin endpoint not found.'));

module.exports = router;
