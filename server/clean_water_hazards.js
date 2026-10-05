'use strict';
const https = require('https');
const db = require('./db');

// Get all hazards from DB
const all = db.prepare('SELECT id, ref_code, title, lat, lng, is_demo FROM hazards ORDER BY id').all();

function checkWater(lat, lng) {
  return new Promise(resolve => {
    const url = 'https://is-on-water.balbona.me/api/v1/get/' + lat + '/' + lng;
    https.get(url, { headers: { 'Accept': 'application/json' } }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          resolve({ isWater: !!data.isWater, feature: data.feature || 'UNKNOWN' });
        } catch { resolve({ isWater: false, feature: 'parse-error' }); }
      });
    }).on('error', err => {
      console.error('  Network error:', err.message);
      resolve({ isWater: false, feature: 'net-error' });
    });
  });
}

(async () => {
  const waterHazardIds = [];
  console.log('\nChecking ' + all.length + ' hazards for water placement...\n');

  for (const h of all) {
    const { isWater, feature } = await checkWater(h.lat, h.lng);
    const status = isWater ? '  WATER (' + feature + ')' : '  land';
    console.log('ID ' + String(h.id).padStart(2) + ' ' + h.ref_code + ' [' + status.trim() + '] ' + h.title.substring(0, 50));
    if (isWater) waterHazardIds.push(h.id);
    // Small delay to respect rate limit (120 req/min)
    await new Promise(r => setTimeout(r, 520));
  }

  console.log('\n--- Results ---');
  if (waterHazardIds.length === 0) {
    console.log('No hazards found on water. Nothing to delete.');
  } else {
    console.log('Water hazard IDs to delete: ' + waterHazardIds.join(', '));
    // Delete them from the database (CASCADE deletes related assessments/plans)
    const stmt = db.prepare('DELETE FROM hazards WHERE id = ?');
    for (const id of waterHazardIds) {
      stmt.run(id);
      console.log('  Deleted hazard ID ' + id);
    }
    console.log('\nDone. Removed ' + waterHazardIds.length + ' water hazard(s).');
  }
  process.exit(0);
})();
