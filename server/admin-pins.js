'use strict';

const db = require('./db');
const { fail } = require('./admin-auth');
const { isWithinBatangas } = require('./report-validation');

const list = db.prepare(`
    SELECT p.reviewer, p.previous_lat, p.previous_lng, p.lat, p.lng, p.reason, p.changed_at,
        l.previous_barangay, l.barangay, l.previous_address, l.address
    FROM report_pin_changes p LEFT JOIN report_pin_location_details l ON l.change_id = p.id
    WHERE p.hazard_id = ? ORDER BY p.id DESC
`);
const barangays = db.prepare('SELECT id, name FROM barangays ORDER BY name');
const findBarangay = db.prepare('SELECT id, name FROM barangays WHERE id = ?');
const updateLocation = db.prepare(`
    UPDATE hazards SET lat = ?, lng = ?, barangay_id = ?, address = ?, title = ?, updated_at = datetime('now')
    WHERE id = ?
`);
const recordPin = db.prepare(`
    INSERT INTO report_pin_changes (hazard_id, reviewer, previous_lat, previous_lng, lat, lng, reason)
    VALUES (?, ?, ?, ?, ?, ?, ?)
`);
const recordLocation = db.prepare(`
    INSERT INTO report_pin_location_details (change_id, previous_barangay, barangay, previous_address, address)
    VALUES (?, ?, ?, ?, ?)
`);

function installPinCorrections(router, reportDetail, nearby) {
    router.put('/reports/:ref/pin', (req, res) => {
        const { lat, lng, pin_revision, barangay_id, address, reason } = req.body ?? {};
        if (!isWithinBatangas(lat, lng) || typeof reason !== 'string' || !reason.trim() || reason.length > 500) {
            return fail(res, 400, 'Enter Batangas City coordinates and a reason up to 500 characters.');
        }
        if (!Number.isSafeInteger(pin_revision) || pin_revision < 0 || !Number.isSafeInteger(barangay_id) ||
            typeof address !== 'string' || address.length > 500) {
            return fail(res, 400, 'Confirm the barangay and keep the address under 500 characters.');
        }
        const result = db.runTransaction(() => {
            const report = reportDetail.get(req.params.ref);
            if (!report?.hazard_id) return [404, 'This report has no saved pin.'];
            if (report.pin_revision !== pin_revision) {
                return [409, 'The location changed elsewhere. Reopen the report before correcting it.'];
            }
            const barangay = findBarangay.get(barangay_id);
            if (!barangay) return [400, 'Choose a valid barangay.'];
            const correctedAddress = address.trim() || null;
            if (report.lat === lat && report.lng === lng && report.barangay_id === barangay_id &&
                (report.address || null) === correctedAddress) {
                return [400, 'Change the coordinates, barangay, or address before saving.'];
            }
            const title = report.was_live && report.title === `Live fire near ${report.barangay}`
                ? `Live fire near ${barangay.name}` : report.title;
            updateLocation.run(lat, lng, barangay_id, correctedAddress, title, report.hazard_id);
            const change = recordPin.run(report.hazard_id, req.reviewer.username, report.lat, report.lng, lat, lng, reason.trim());
            recordLocation.run(change.lastInsertRowid, report.barangay, barangay.name, report.address, correctedAddress);
            const updated = { ...report, lat, lng };
            return {
                lat, lng, barangay_id, barangay: barangay.name, address: correctedAddress, title,
                pin_revision: Number(change.lastInsertRowid), pin_history: list.all(report.hazard_id), nearby: nearby(updated)
            };
        }, { immediate: true });
        if (Array.isArray(result)) return fail(res, ...result);
        res.json({ success: true, data: result });
    });
}

module.exports = { installPinCorrections, list, barangays };
