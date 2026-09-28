/**
 * public/js/search.js
 * ─────────────────────────────────────────────────────────────────────────────
 * EmbeReady — Location Search Module
 * Handles: Nominatim online search → offline local DB fallback
 * Feeds results to: app.js (which calls map.js to center the map)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { nominatimSearch, localGeocode } from './api.js';

const BOUNDS = { south: 13.60, north: 13.85, west: 120.93, east: 121.14 };

// ── Quick-jump locations ──────────────────────────────────────────────────────
export const QUICK_JUMPS = [
    { label: 'Poblacion',       lat: 13.7565, lng: 121.0583 },
    { label: 'Batangas Port',   lat: 13.7575, lng: 121.0401 },
    { label: 'Alangilan',       lat: 13.7841, lng: 121.0722 },
    { label: 'Pallocan',        lat: 13.7510, lng: 121.0478 },
    { label: 'Grand Terminal',  lat: 13.7438, lng: 121.0516 },
    { label: 'Tabangao',        lat: 13.7812, lng: 121.1095 }
];

/**
 * search(query)
 * Tries Nominatim first; falls back to local DB if offline or no results.
 * Returns: { results: Array<{label, lat, lng, type, source}>, offline: boolean }
 */
export async function search(query) {
    if (!query || query.trim().length < 2) return { results: [], offline: false };

    // 1. Try Nominatim (online)
    try {
        const online = await nominatimSearch(query.trim());
        if (online.length > 0) {
            const results = online.map(r => ({
                label:   r.display_name.split(',').slice(0, 2).join(', '),
                lat:     parseFloat(r.lat),
                lng:     parseFloat(r.lon),
                type:    r.type || 'place',
                source:  'nominatim'
            })).filter(r => inBounds(r.lat, r.lng));

            if (results.length > 0) return { results, offline: false };
        }
    } catch (err) {
        console.warn('[Search] Nominatim unavailable:', err.message);
    }

    // 2. Fallback: local DB search
    try {
        const local = await localGeocode(query.trim());
        const results = local.map(r => ({
            label:   r.barangay_name
                ? `${r.name} — ${r.barangay_name}`
                : r.name,
            lat:     r.lat,
            lng:     r.lng,
            type:    r.type || 'local',
            source:  'local'
        }));
        return { results, offline: true };
    } catch (err) {
        console.error('[Search] Local geocode also failed:', err.message);
        return { results: [], offline: true };
    }
}

/**
 * validateBounds(lat, lng)
 * Returns true if the point is within the Batangas City bounding box.
 */
export function validateBounds(lat, lng) {
    return inBounds(parseFloat(lat), parseFloat(lng));
}

function inBounds(lat, lng) {
    return lat >= BOUNDS.south && lat <= BOUNDS.north &&
           lng >= BOUNDS.west  && lng <= BOUNDS.east;
}

/**
 * formatSearchResult(result) → display label string
 */
export function formatLabel(result) {
    if (result.source === 'local') return `📍 ${result.label} (local database)`;
    return result.label;
}
