'use strict';
// Import manually edited contacts without reseeding or deleting reports.
const fs = require('fs');
const path = require('path');
const db = require('./db');
const entries = JSON.parse(fs.readFileSync(path.join(__dirname, 'contacts.json'), 'utf8'));
db.runTransaction(() => {
    const find = db.prepare('SELECT id FROM emergency_contacts WHERE jurisdiction = ? AND facility_name = ?');
    const update = db.prepare('UPDATE emergency_contacts SET agency_type=?, phone_display=?, phone_dialable=?, is_placeholder=?, sort_order=? WHERE id=?');
    const insert = db.prepare('INSERT INTO emergency_contacts (jurisdiction, facility_name, agency_type, phone_display, phone_dialable, is_placeholder, sort_order) VALUES (?,?,?,?,?,?,?)');
    for (const c of entries) {
        const placeholder = c.is_placeholder || !c.phone_dialable || !/^\+?[0-9][0-9 ()-]{2,}$/.test(c.phone_dialable);
        const values = [c.agency_type, c.phone_display || 'Not configured', placeholder ? null : c.phone_dialable, placeholder ? 1 : 0, c.sort_order || 100];
        const existing = find.get(c.jurisdiction, c.facility_name);
        if (existing) update.run(...values, existing.id);
        else insert.run(c.jurisdiction, c.facility_name, ...values);
    }
    for (const b of db.prepare('SELECT name FROM barangays').all()) {
        if (!db.prepare("SELECT id FROM emergency_contacts WHERE jurisdiction=? AND agency_type='Barangay'").get(b.name)) {
            insert.run(b.name, `Barangay Hall — ${b.name}`, 'Barangay', 'Not configured', null, 1, 100);
        }
    }
});
console.log('Contacts updated; existing reports preserved.');
