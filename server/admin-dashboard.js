'use strict';
const db = require('./db');
const { fail } = require('./admin-auth');
const detector = require('./photo-authenticity');
const { deleteHazard } = require('./delete-hazard');

const joins = `FROM hazards h JOIN barangays b ON b.id=h.barangay_id
    LEFT JOIN reports r ON r.id=(SELECT MAX(id) FROM reports latest WHERE latest.hazard_id=h.id AND latest.honeypot_triggered=0)
    LEFT JOIN report_reviews v ON v.report_id=r.id
    LEFT JOIN photo_authenticity_scans s ON s.hazard_id=h.id
    LEFT JOIN assessment_jobs j ON j.hazard_id=h.id
    LEFT JOIN assessment_runs a ON a.id=j.run_id AND j.state='completed'`;
const scope = `NOT EXISTS(SELECT 1 FROM review_demo_hazards demo WHERE demo.hazard_id=h.id)`;
const community = 'h.is_demo=0 AND r.id IS NOT NULL';
const fields = `h.id,h.ref_code,h.title,h.description,h.address,h.category,h.status,h.risk_level,h.lat,h.lng,h.photo_url,h.is_demo,
    h.created_at,b.name AS barangay,r.ref_number,r.reported_level,r.created_at AS submitted_at,
    COALESCE(v.decision,'pending') AS decision,COALESCE(v.version,0) AS version,v.notes,
    json_extract(a.result_json,'$.assessment.assessed_level') AS assessed_level,
    s.ai_score,s.scanned_at,s.model_revision`;
const labels = { validated: 'verified', dismissed: 'fake', needs_verification: 'pending', pending: 'pending' };

function publicRow(row) {
    return { ...row, review_status: row.is_demo ? 'example' : labels[row.decision],
        has_photo: Boolean(detector.photoFile(row.photo_url, { userOnly: false })),
        photo_scan: row.ai_score === null ? null : { ...detector.signal(row.ai_score), scanned_at: row.scanned_at },
        can_review: !row.is_demo && Boolean(row.ref_number) };
}
function installAdminDashboard(router) {
    router.get('/session', (req, res) => res.json({ success: true, reviewer: req.reviewer }));
    router.get('/photo-scanner', (req, res) => res.json({ success: true, available: detector.available(), model: detector.model.name, local: true, threshold: detector.model.threshold }));
    router.get(['/dashboard', '/hazards'], (req, res) => {
        const { q = '', status = 'all', level = 'all', page = '1', source = 'all' } = req.query;
        const pageNumber = Number(page), inbox = req.path === '/dashboard';
        if (typeof q !== 'string' || q.length > 120 || !['all','pending','verified','fake'].includes(status) ||
            !['all','low','moderate','heavy','live'].includes(level) || !['all','community','examples'].includes(source) ||
            typeof page !== 'string' || !Number.isSafeInteger(pageNumber) || pageNumber < 1) return fail(res, 400, 'Invalid dashboard filters.');
        let where = `WHERE ${scope}`;
        if (inbox || source === 'community') where += ` AND ${community}`;
        else if (source === 'examples') where += ' AND h.is_demo=1';
        const counts = { all: 0, pending: 0, verified: 0, fake: 0 };
        for (const item of db.prepare(`SELECT COALESCE(v.decision,'pending') AS decision,COUNT(*) AS count ${joins} WHERE ${scope} AND ${community} GROUP BY COALESCE(v.decision,'pending')`).all()) {
            counts[labels[item.decision]] += item.count; counts.all += item.count;
        }
        const params = [];
        if (status !== 'all') {
            where += ` AND ${community}`;
            where += status === 'pending' ? " AND COALESCE(v.decision,'pending') IN ('pending','needs_verification')" : ' AND v.decision=?';
            if (status !== 'pending') params.push(status === 'verified' ? 'validated' : 'dismissed');
        }
        if (level !== 'all') {
            if (level === 'live') where += " AND h.status='active'";
            else { where += " AND h.status<>'active' AND COALESCE(r.reported_level,h.risk_level)=?"; params.push(level); }
        }
        const query = q.trim().toLowerCase();
        if (query) { where += ' AND (instr(lower(h.title),?)>0 OR instr(lower(b.name),?)>0 OR instr(lower(COALESCE(r.ref_number,h.ref_code)),?)>0)'; params.push(query,query,query); }
        const { total } = db.prepare(`SELECT COUNT(*) AS total ${joins} ${where}`).get(...params);
        const pages = Math.max(1, Math.ceil(total / 24)), currentPage = Math.min(pageNumber, pages);
        const rows = db.prepare(`SELECT ${fields} ${joins} ${where} ORDER BY COALESCE(r.created_at,h.created_at) DESC,h.id DESC LIMIT 24 OFFSET ?`).all(...params, (currentPage-1)*24);
        res.json({ success: true, data: rows.map(publicRow), counts, total, page: currentPage, pages });
    });
    router.get('/hazards/:id', (req, res) => {
        const id = Number(req.params.id);
        if (!Number.isSafeInteger(id) || id < 1) return fail(res, 400, 'Invalid hazard.');
        const row = db.prepare(`SELECT ${fields} ${joins} WHERE ${scope} AND h.id=?`).get(id);
        if (!row) return fail(res, 404, 'This hazard no longer exists.');
        const history = row.ref_number ? db.prepare(`SELECT e.decision,e.notes,e.reviewer,e.reviewed_at FROM report_review_history e JOIN reports r ON r.id=e.report_id WHERE r.ref_number=? ORDER BY e.version DESC LIMIT 10`).all(row.ref_number) : [];
        res.json({ success: true, data: { ...publicRow(row), history } });
    });
    router.post('/hazards/:id/photo-scan', async (req, res, next) => {
        const id = Number(req.params.id);
        if (!Number.isSafeInteger(id) || id < 1) return fail(res, 400, 'Invalid hazard.');
        const row = db.prepare('SELECT id FROM hazards WHERE id=? AND is_demo=0').get(id);
        if (!row) return fail(res, 404, 'Submitted report not found.');
        try { res.json({ success: true, data: await detector.scan(db, id) }); }
        catch (error) {
            if (error.code === 'PHOTO_UNAVAILABLE') return fail(res, 400, error.message);
            if (error.code === 'PHOTO_CHANGED') return fail(res, 409, error.message);
            console.warn('[photo scanner]', error.message);
            return fail(res, 503, error.code === 'SCANNER_BUSY' || error.code === 'SCANNER_NOT_INSTALLED' ? error.message : 'The local photo check could not finish. Try again; no verdict was recorded.');
        }
    });
    router.delete('/hazards/:id', (req, res) => {
        if (!req.reviewer.supervisor) return fail(res, 403, 'Administrator access is required to remove a hazard.');
        const id = Number(req.params.id), { confirm, ref_code, reason } = req.body ?? {};
        if (!Number.isSafeInteger(id) || id < 1 || confirm !== true || typeof ref_code !== 'string' ||
            !['fake_report','no_longer_exists','requested_removal'].includes(reason)) return fail(res, 400, 'Confirm the hazard and a removal reason.');
        const hazard = db.prepare('SELECT ref_code FROM hazards WHERE id=?').get(id);
        if (!hazard) return fail(res, 404, 'This hazard has already been removed.');
        if (hazard.ref_code !== ref_code) return fail(res, 409, 'The selected hazard changed. Reopen it before deleting.');
        res.json({ success: true, data: deleteHazard(db, id, { reason, reviewer: req.reviewer.username }) });
    });
}
module.exports = { installAdminDashboard };
