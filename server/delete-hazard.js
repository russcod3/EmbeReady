'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { photoFile } = require('./photo-authenticity');

function deleteHazard(db, id, { reason, reviewer }) {
    const hazard = db.prepare('SELECT * FROM hazards WHERE id = ?').get(id);
    if (!hazard) return null;
    const photo = photoFile(hazard.photo_url);
    db.runTransaction(() => {
        const references = db.prepare('SELECT ref_number FROM reports WHERE hazard_id = ?').all(id).map(row => row.ref_number);
        db.prepare('INSERT INTO hazard_deletions(hazard_id,ref_code,report_refs,reason,reviewer) VALUES(?,?,?,?,?)')
            .run(id, hazard.ref_code, JSON.stringify(references), reason, reviewer);
        // Legacy databases may have NO ACTION on reports.hazard_id.
        db.prepare('DELETE FROM reports WHERE hazard_id = ?').run(id);
        db.prepare('DELETE FROM fire_history WHERE hazard_id = ?').run(id);
        db.prepare('DELETE FROM assessment_jobs WHERE hazard_id = ?').run(id);
        db.prepare('DELETE FROM hazards WHERE id = ?').run(id);
    }, { immediate: true });
    let photoDeleted = false;
    if (photo && !db.prepare('SELECT 1 FROM hazards WHERE photo_url = ?').get(hazard.photo_url)) {
        try { fs.unlinkSync(photo); photoDeleted = true; }
        catch (error) { console.warn('[admin] Report removed; photo cleanup failed for ' + path.basename(photo) + ': ' + error.code); }
    }
    return { id, deleted: true, photo_deleted: photoDeleted };
}
module.exports = { deleteHazard };
