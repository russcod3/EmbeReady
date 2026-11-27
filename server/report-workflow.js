'use strict';

const db = require('./db');
const { fail } = require('./admin-auth');
const { nearestBarangay } = require('./report-validation');

const sharedReviewer = 'Shared admin';
const queueOrder = "CASE WHEN h.status = 'active' THEN 0 ELSE 1 END, r.id DESC";
const publicHazard = `NOT EXISTS (SELECT 1 FROM review_demo_hazards demo WHERE demo.hazard_id = h.id)
    AND NOT EXISTS (SELECT 1 FROM reports flagged JOIN report_reviews review ON review.report_id=flagged.id
        WHERE flagged.hazard_id=h.id AND review.decision='dismissed')`;
const enabledReviewers = db.prepare('SELECT username FROM reviewer_accounts WHERE enabled = 1 ORDER BY username');
const findAccount = db.prepare('SELECT username FROM reviewer_accounts WHERE enabled = 1 AND username = ?');
const inboundLink = db.prepare('SELECT 1 FROM report_followups WHERE duplicate_of = ? LIMIT 1');
const saveFollowup = db.prepare(`
    INSERT INTO report_followups (report_id, assignee, due_on, duplicate_of, version)
    VALUES (?, ?, ?, ?, 1)
    ON CONFLICT (report_id) DO UPDATE SET assignee = excluded.assignee, due_on = excluded.due_on,
        duplicate_of = excluded.duplicate_of, version = report_followups.version + 1
    RETURNING version
`);
const updateIncident = db.prepare(`
    UPDATE hazards SET status = ?, active_started_at = COALESCE(?, active_started_at),
        updated_at = datetime('now') WHERE id = ?
`);
const insertHistory = db.prepare(`
    INSERT INTO report_workflow_history (report_id, reviewer, changes) VALUES (?, ?, ?)
`);
const loadHistory = db.prepare(`
    SELECT reviewer, changes, recorded_at FROM report_workflow_history WHERE report_id = ? ORDER BY id DESC
`);

function workflowDetails(report) {
    return {
        assignees: [sharedReviewer, ...enabledReviewers.all().map(row => row.username)],
        workflow_history: loadHistory.all(report.id).map(event => ({ ...event, changes: JSON.parse(event.changes) }))
    };
}

function validDate(value) {
    if (value === null) return true;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const time = new Date(value);
    return Number.isFinite(time.getTime()) && time.toISOString().slice(0, 10) === value;
}

function saveWorkflow(router, reportDetail) {
    router.put('/reports/:ref/workflow', (req, res) => {
        const { assignee, due_on, duplicate_ref, incident_status, previous_incident_status, workflow_version } = req.body ?? {};
        if ((assignee !== null && (typeof assignee !== 'string' || assignee.length > 32)) ||
            (duplicate_ref !== null && (typeof duplicate_ref !== 'string' || duplicate_ref.length > 64)) ||
            !validDate(due_on) || !Number.isSafeInteger(workflow_version) || workflow_version < 0) {
            return fail(res, 400, 'Check the assignee, due date, and original report reference.');
        }

        const result = db.runTransaction(() => {
            const report = reportDetail.get(req.params.ref);
            if (!report) return [404, 'Report not found.'];
            if (report.workflow_version !== workflow_version) return [409, 'This follow-up changed elsewhere. Reopen the report to see the latest details.'];
            const assigned = assignee === null || assignee === sharedReviewer || assignee === report.assignee
                ? assignee : findAccount.get(assignee)?.username;
            if (assigned === undefined) return [400, 'Choose an active reviewer.'];
            const status = report.incident_status;
            const nextStatus = incident_status === undefined ? status : incident_status;
            if (previous_incident_status !== undefined && status !== previous_incident_status) {
                return [409, 'The incident status changed elsewhere. Reopen the report before changing its status.'];
            }
            const initial = report.was_live ? 'active' : 'potential';
            const allowed = report.was_live ? [initial, 'contained', 'resolved'] : [initial, 'resolved'];
            if (nextStatus !== status && (!report.hazard_id || !allowed.includes(nextStatus))) {
                return [400, 'Choose a valid incident status.'];
            }
            const original = duplicate_ref === null ? null : reportDetail.get(duplicate_ref.toUpperCase());
            if (duplicate_ref !== null && (!original || original.id === report.id || original.is_training !== report.is_training)) {
                return [400, 'Enter another report reference from the same queue.'];
            }
            if (original && (original.duplicate_ref || inboundLink.get(report.id))) {
                return [400, 'Link directly to the original. A report with linked duplicates cannot itself be marked as a duplicate.'];
            }
            const values = { assignee: assigned, due_on, duplicate_ref: original?.ref_number ?? null, incident_status: nextStatus };
            const changes = Object.entries(values)
                .filter(([field, value]) => report[field] !== value)
                .map(([field, value]) => ({ field, from: report[field], to: value }));
            let savedVersion = report.workflow_version;
            if (changes.length) {
                savedVersion = saveFollowup.get(report.id, assigned, due_on, original?.id ?? null).version;
                if (status !== nextStatus) {
                    updateIncident.run(nextStatus, nextStatus === 'active' ? new Date().toISOString() : null, report.hazard_id);
                }
                insertHistory.run(report.id, req.reviewer.username, JSON.stringify(changes));
            }
            return { ...values, workflow_version: savedVersion, ...workflowDetails(report) };
        }, { immediate: true });
        if (Array.isArray(result)) return fail(res, ...result);
        res.json({ success: true, data: result });
    });
}

const trainingFixtures = [
    ['DEMO-REVIEW-101', 'Smoke near a practice evacuation route', 'Smoke was reported near an evacuation route. The incident has been contained.', 'other', 'contained', 13.7564, 121.0579],
    ['DEMO-REVIEW-102', 'Second report of smoke nearby', 'The description and location are similar to DEMO-REVIEW-101. Check the map before linking the two.', 'other', 'potential', 13.7567, 121.0582],
    ['DEMO-REVIEW-103', 'Exposed wiring with an unclear location', 'The reporter mentioned a gate but did not identify which building. Ask for a landmark before verifying.', 'faulty_wiring', 'potential', 13.7586, 121.0605],
    ['DEMO-REVIEW-104', 'Cleared obstruction at a practice exit', 'The obstruction was removed. Compare the incident status with the review decision.', 'blocked_exit', 'resolved', 13.7595, 121.0582]
];

function installDemoQueue(router) {
    router.post('/demo', (req, res) => {
        const barangays = db.prepare('SELECT id, center_lat, center_lng FROM barangays ORDER BY id').all();
        if (!barangays.length) return fail(res, 409, 'Load the city barangays before creating the demo queue.');
        const find = db.prepare('SELECT 1 FROM reports WHERE ref_number = ?');
        const addHazard = db.prepare(`
            INSERT INTO hazards (ref_code, title, description, category, status, barangay_id, lat, lng, risk_level, is_demo, active_started_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'moderate', 1, ?)
        `);
        const identify = db.prepare('INSERT INTO review_demo_hazards (hazard_id) VALUES (?)');
        const addReport = db.prepare('INSERT INTO reports (ref_number, hazard_id, reported_level) VALUES (?, ?, ?)');
        db.runTransaction(() => {
            for (const [ref, title, description, category, status, lat, lng] of trainingFixtures) {
                if (find.get(ref)) continue;
                const live = status === 'contained';
                const barangay = nearestBarangay(barangays, lat, lng);
                const { lastInsertRowid } = addHazard.run(ref, title, description, category, status, barangay.id, lat, lng,
                    live ? new Date().toISOString() : null);
                identify.run(lastInsertRowid);
                addReport.run(ref, lastInsertRowid, live ? null : 'moderate');
            }
        }, { immediate: true });
        res.json({ success: true });
    });
}

module.exports = { installDemoQueue, publicHazard, queueOrder, saveWorkflow, workflowDetails };
