'use strict';
const CATEGORIES = new Set(['faulty_wiring','lpg_storage','dry_grass','overloaded_outlets','blocked_exit','illegal_burning','informal_settlement','flammable_storage','other']);

function validateReport(body) {
    const live = body.report_type === 'live_fire' || body.category === 'live_fire' || body.status === 'active';
    const lat = body.lat === '' || body.lat == null ? NaN : Number(body.lat);
    const lng = body.lng === '' || body.lng == null ? NaN : Number(body.lng);
    const errors = [];
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) errors.push('Pin the location on the map.');
    else if (lat < 13.60 || lat > 13.85 || lng < 120.93 || lng > 121.14) errors.push('The pin must be within Batangas City.');
    if (!live && !CATEGORIES.has(body.category)) errors.push('Select a fire hazard category.');
    const title = live ? 'Live fire reported' : String(body.title || '').trim();
    if (!live && (title.length < 5 || title.length > 180)) errors.push('Use a hazard title between 5 and 180 characters.');
    if (body.status && !['active','potential'].includes(body.status)) errors.push('Invalid report status.');
    const reportedLevel = body.reported_level || body.risk_level;
    if (!live && !['low','moderate','heavy'].includes(reportedLevel)) errors.push('Choose the reported risk level.');
    const observations = {};
    for (const key of ['ignition_sources','fuel_combustibles','proximity_to_people','structure_material','escape_routes','truck_access','fire_history','weather_seasonal','human_behavior','safeguards']) {
        const value = String(body['observation_' + key] || '').trim();
        if (value.length > 1000) errors.push('Keep each observation under 1,000 characters.');
        if (!live && value) observations[key] = value.slice(0,1000);
    }
    const description = live ? '' : String(body.description || '').trim();
    if (description.length > 5000) errors.push('Keep the description under 5,000 characters.');
    const barangayId = live || !body.barangay_id ? null : Number(body.barangay_id);
    if (barangayId !== null && (!Number.isInteger(barangayId) || barangayId < 1)) errors.push('Select a valid barangay or use the nearest barangay to the pin.');
    return { errors, report: { title, category:live ? 'other' : body.category, status:live ? 'active' : 'potential', risk_level:live ? 'heavy' : reportedLevel, observations, description, lat, lng, address:String(body.address || '').trim().slice(0,500), barangay_id:barangayId } };
}

// Only a proximity suggestion: barangay centres are not jurisdiction boundaries.
function nearestBarangay(barangays,lat,lng) {
    const distance = b => (Number(b.center_lat)-lat)**2 + ((Number(b.center_lng)-lng)*Math.cos(lat*Math.PI/180))**2;
    return barangays.reduce((nearest,b)=>!nearest || distance(b)<distance(nearest) ? b : nearest,null);
}
module.exports={validateReport,nearestBarangay};
