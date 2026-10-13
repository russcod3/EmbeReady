/**
 * public/js/search.js
 * ─────────────────────────────────────────────────────────────────────────────
 * EmbeReady — Location Search Module
 * Matches Google Maps ground truth for Batangas City:
 * - Prioritizes official Batangas City barangays and landmarks
 * - Cleans OSM boundary hierarchy artifacts (e.g. Alangilan vs Banaba South)
 * - Returns clean "{Place}, Batangas City" labels
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { nominatimSearch, localGeocode } from './api.js';

const BOUNDS = { south: 13.60, north: 13.85, west: 120.93, east: 121.14 };

// ── Quick-jump locations ──────────────────────────────────────────────────────
export const QUICK_JUMPS = [
    { label: 'Poblacion',       lat: 13.7565, lng: 121.0583 },
    { label: 'Batangas Port',   lat: 13.7552, lng: 121.0440 },
    { label: 'Alangilan',       lat: 13.7841, lng: 121.0722 },
    { label: 'Pallocan',        lat: 13.7510, lng: 121.0478 },
    { label: 'Grand Terminal',  lat: 13.7898, lng: 121.0623 },
    { label: 'Tabangao',        lat: 13.7142, lng: 121.0645 }
];

/**
 * cleanPlaceLabel(r)
 * Converts raw OSM / local names into clean Google Maps-style labels:
 * e.g. "Alangilan, Batangas City" instead of "Alangilan, Banaba Ibaba"
 */
function cleanPlaceLabel(r) {
    const rawName = (r.name || (r.display_name ? r.display_name.split(',')[0] : '')).trim();
    if (!rawName) return 'Batangas City';

    // If local DB item with a parent barangay
    if (r.barangay_name && r.barangay_name !== rawName) {
        return `${rawName}, ${r.barangay_name}, Batangas City`;
    }

    if (r.display_name) {
        const parts = r.display_name.split(',').map(s => s.trim());
        // Remove erroneous OSM boundary inclusions like Banaba Ibaba/South on Alangilan or Bolbok
        const filtered = parts.filter(p => {
            if ((rawName.toLowerCase() === 'alangilan' || rawName.toLowerCase() === 'bolbok') && p.toLowerCase().includes('banaba')) {
                return false;
            }
            if (/^\d{4}$/.test(p) || p.toLowerCase() === 'philippines' || p.toLowerCase() === 'calabarzon') {
                return false;
            }
            return true;
        });

        if (filtered.length >= 2 && !filtered[0].toLowerCase().includes('batangas city')) {
            const second = filtered[1].toLowerCase().includes('batangas city') ? 'Batangas City' : filtered[1];
            return `${filtered[0]}, ${second}`;
        }
    }

    // Default clean format
    if (rawName.toLowerCase().includes('batangas city')) return rawName;
    return `${rawName}, Batangas City`;
}

function cleanPlaceType(r) {
    const t = (r.type || r.class || 'place').toLowerCase();
    if (t === 'administrative' || t === 'quarter' || t === 'suburb' || t === 'village' || t === 'barangay') return 'Barangay';
    if (t === 'university' || t === 'college' || t === 'school') return 'School';
    if (t === 'hospital' || t === 'clinic') return 'Hospital';
    if (t === 'bus_station' || t === 'terminal') return 'Terminal';
    if (t === 'port' || t === 'harbour') return 'Port';
    if (t === 'residential' || t === 'highway' || t === 'primary' || t === 'road') return 'Road';
    if (t === 'commercial' || t === 'mall') return 'Mall';
    if (t === 'evacuation site' || t === 'evacuation') return 'Evacuation';
    if (t === 'government') return 'Govt';
    if (t === 'fire station') return 'Fire Station';
    return 'Place';
}

/**
 * search(query)
 * Runs local geocode first (guaranteed official Batangas landmarks and barangays)
 * supplemented by Nominatim for streets and specific buildings.
 */
export async function search(query) {
    if (!query || query.trim().length < 2) return { results: [], offline: false };
    const q = query.trim();

    // 1. Local database search (instant, official Batangas City data)
    let localResults = [];
    try {
        const local = await localGeocode(q);
        localResults = (local || []).map(r => ({
            label:  cleanPlaceLabel(r),
            lat:    r.lat,
            lng:    r.lng,
            type:   cleanPlaceType(r),
            source: 'official'
        }));
    } catch (err) {
        console.warn('[Search] Local geocode failed:', err.message);
    }

    // 2. Online Nominatim search (for streets, specific addresses)
    let onlineResults = [];
    try {
        const online = await nominatimSearch(q);
        onlineResults = (online || []).map(r => ({
            label:  cleanPlaceLabel(r),
            lat:    parseFloat(r.lat),
            lng:    parseFloat(r.lon),
            type:   cleanPlaceType(r),
            source: 'online'
        })).filter(r => inBounds(r.lat, r.lng));
    } catch (err) {
        // Offline or network error
    }

    // Merge and deduplicate by label/coordinates
    const seen = new Set();
    const merged = [];

    // Prioritize official local barangays & landmarks first
    for (const item of [...localResults, ...onlineResults]) {
        const key = `${item.label.toLowerCase()}_${item.lat.toFixed(3)}_${item.lng.toFixed(3)}`;
        if (!seen.has(key)) {
            seen.add(key);
            merged.push(item);
        }
    }

    return { results: merged.slice(0, 7), offline: onlineResults.length === 0 };
}

export function validateBounds(lat, lng) {
    return inBounds(parseFloat(lat), parseFloat(lng));
}

function inBounds(lat, lng) {
    return lat >= BOUNDS.south && lat <= BOUNDS.north &&
           lng >= BOUNDS.west  && lng <= BOUNDS.east;
}

export function formatLabel(result) {
    return result.label;
}
