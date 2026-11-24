'use strict';

const db = require('./db');
const { fail } = require('./admin-auth');
const { isWithinBatangas } = require('./report-validation');

const list = db.prepare(`
    SELECT reviewer, previous_lat, previous_lng, lat, lng, reason, changed_at
    FROM report_pin_changes WHERE hazard_id = ? ORDER BY id DESC
`);

function installPinCorrections(router, reportDetail, nearby) {
    router.put('/reports/:ref/pin', (req, res) => {
        const { lat, lng, original_lat, original_lng, reason } = req.body ?? {};
        if (!isWithinBatangas(lat, lng) || typeof reason !== 'string' || !reason.trim() || reason.length > 500) {
            return fail(res, 400, 'Enter Batangas City coordinates and a reason up to 500 characters.');
        }
        const result = db.runTransaction(() => {
            const report = reportDetail.get(req.params.ref);
            if (!report?.hazard_id) return [404, 'This report has no saved pin.'];
            if (report.lat !== original_lat || report.lng !== original_lng) {
                return [409, 'The pin moved elsewhere. Reopen the report before correcting it.'];
            }
            if (report.lat === lat && report.lng === lng) return [400, 'Choose a different location for the pin.'];
            db.prepare("UPDATE hazards SET lat = ?, lng = ?, updated_at = datetime('now') WHERE id = ?")
                .run(lat, lng, report.hazard_id);
            db.prepare(`
                INSERT INTO report_pin_changes (hazard_id, reviewer, previous_lat, previous_lng, lat, lng, reason)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(report.hazard_id, req.reviewer.username, report.lat, report.lng, lat, lng, reason.trim());
            const updated = { ...report, lat, lng };
            return { lat, lng, pin_history: list.all(report.hazard_id), nearby: nearby(updated) };
        }, { immediate: true });
        if (Array.isArray(result)) return fail(res, ...result);
        res.json({ success: true, data: result });
    });
}

module.exports = { installPinCorrections, list };
