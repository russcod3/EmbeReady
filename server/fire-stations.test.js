'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
let Database;
try { Database = require('node:sqlite').DatabaseSync; }
catch { Database = require('better-sqlite3'); }
const { syncFireStations, listFireStations } = require('./fire-stations');
const { loadFrontend } = require('../test/frontend-helpers');

function database(t) {
    const db = new Database(':memory:');
    db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
    t.after(() => db.close());
    return db;
}

test('station sync saves one volunteer brigade with two independent phone contacts', t => {
    const db = database(t);
    db.prepare(`INSERT INTO emergency_contacts
        (jurisdiction, agency_type, facility_name, phone_display, phone_dialable)
        VALUES (?, ?, ?, ?, ?)`).run('Citywide', 'BFP', 'Existing BFP', '043 123 4567', '+63431234567');
    syncFireStations(db);
    const before = db.prepare('SELECT * FROM emergency_contacts ORDER BY id').all();
    syncFireStations(db);
    assert.deepEqual(db.prepare('SELECT * FROM emergency_contacts ORDER BY id').all(), before);
    const [station] = listFireStations(db);
    assert.equal(listFireStations(db).length, 1);
    assert.equal(station.type, 'Volunteer Fire Brigade');
    assert.deepEqual([station.lat, station.lng], [13.75668, 121.05587]);
    assert.match(station.address, /D\. Silang.*V\. Luna/);
    assert.deepEqual(station.phoneNumbers.map(phone => phone.phone_dialable), ['+63437765911', '+639207418888']);
    const contacts = before.filter(contact => contact.agency_type === 'Volunteer Fire Brigade');
    assert.equal(contacts.length, 2);
    assert.match(contacts[0].facility_name, /Landline$/);
    assert.match(contacts[1].facility_name, /Mobile$/);
    assert.equal(before.find(contact => contact.facility_name === 'Existing BFP').phone_dialable, '+63431234567');
});

function mapScene(fetchStations) {
    const groups = [];
    const L = {
        layerGroup() {
            const group = { markers: [], addLayer(marker) { this.markers.push(marker); } };
            groups.push(group);
            return group;
        },
        divIcon(options) { return options; },
        marker(coords, options) {
            return { coords, options, bindPopup(html) { this.popup = html; }, bindTooltip() {} };
        }
    };
    const { exports: infrastructure } = loadFrontend('public/js/infrastructure.js', ['initInfrastructure', 'FIRE_STATIONS'], {
        L, fetchFireStations: fetchStations, mapSymbolMarkup: () => '<svg></svg>',
        escapeHtml: text => String(text ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
    });
    return { groups, infrastructure };
}

test('the map uses saved coordinates and renders separate callable landline and mobile links', async t => {
    const db = database(t);
    syncFireStations(db);
    const scene = mapScene(async () => listFireStations(db));
    await scene.infrastructure.initInfrastructure({});
    const stations = scene.groups[2].markers;
    assert.equal(stations.length, 6);
    const brigade = stations.find(marker => marker.options.title.includes('Filipino Chinese'));
    assert.deepEqual(Array.from(brigade.coords), [13.75668, 121.05587]);
    assert.match(brigade.popup, /Volunteer Fire Brigade/);
    assert.match(brigade.popup, /Landline[\s\S]*tel:\+63437765911/);
    assert.match(brigade.popup, /Mobile[\s\S]*tel:\+639207418888/);
    assert.match(brigade.popup, /\(043\) 776-5911/);
    assert.match(brigade.popup, /0920 741-8888/);
    assert.equal(scene.groups[1].markers.length, 6);
    await scene.infrastructure.initInfrastructure({});
    assert.equal(scene.groups[5].markers.length, 6);
});

test('an older contacts response does not create invalid map pins before the server restarts', async () => {
    const scene = mapScene(async () => [{ id: 1, facility_name: 'Existing contact' }]);
    await scene.infrastructure.initInfrastructure({});
    assert.equal(scene.groups[2].markers.length, 5);
    assert.equal(scene.infrastructure.FIRE_STATIONS.length, 5);
});
