'use strict';

const stations = require('./data/fire-stations.json');

function syncFireStations(db) {
    const upsert = db.prepare(`
        INSERT INTO fire_stations
            (id, name, short_name, type, address, lat, lng, coverage, phone_numbers_json, location_source, contact_source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (id) DO UPDATE SET name = excluded.name, short_name = excluded.short_name,
            type = excluded.type, address = excluded.address, lat = excluded.lat, lng = excluded.lng,
            coverage = excluded.coverage, phone_numbers_json = excluded.phone_numbers_json,
            location_source = excluded.location_source, contact_source = excluded.contact_source
    `);
    const findContact = db.prepare('SELECT id FROM emergency_contacts WHERE jurisdiction = ? AND facility_name = ?');
    const insertContact = db.prepare(`
        INSERT INTO emergency_contacts
            (jurisdiction, facility_name, agency_type, phone_display, phone_dialable, is_placeholder, sort_order)
        VALUES (?, ?, ?, ?, ?, 0, 6)
    `);
    const updateContact = db.prepare(`
        UPDATE emergency_contacts SET agency_type = ?, phone_display = ?, phone_dialable = ?,
            is_placeholder = 0 WHERE id = ?
    `);

    db.exec('SAVEPOINT sync_fire_stations');
    try {
        for (const station of stations) {
            upsert.run(station.id, station.name, station.shortName, station.type, station.address,
                station.lat, station.lng, station.coverage, JSON.stringify(station.phoneNumbers),
                station.locationSource, station.contactSource);
            for (const phone of station.phoneNumbers) {
                const name = `${station.name} — ${phone.label}`;
                const existing = findContact.get('Citywide', name);
                if (existing) {
                    updateContact.run(station.type, phone.phone_display, phone.phone_dialable, existing.id);
                } else {
                    insertContact.run('Citywide', name, station.type, phone.phone_display, phone.phone_dialable);
                }
            }
        }
        db.exec('RELEASE sync_fire_stations');
    } catch (error) {
        db.exec('ROLLBACK TO sync_fire_stations');
        db.exec('RELEASE sync_fire_stations');
        throw error;
    }
}

function listFireStations(db) {
    return db.prepare('SELECT * FROM fire_stations ORDER BY name').all().map(row => ({
        id: row.id, name: row.name, shortName: row.short_name, type: row.type,
        address: row.address, lat: row.lat, lng: row.lng, coverage: row.coverage,
        phoneNumbers: JSON.parse(row.phone_numbers_json)
    }));
}

module.exports = { syncFireStations, listFireStations };
