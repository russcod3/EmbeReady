/**
 * public/js/api.js
 * ─────────────────────────────────────────────────────────────────────────────
 * EmbeReady — REST API client
 * All server communication goes through this module.
 * Exports named functions consumed by other modules.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const BASE = '';  // same-origin — no base URL needed

// ── Generic fetch wrapper ─────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
    const res = await fetch(`${BASE}${path}`, {
        headers: { 'Accept': 'application/json', ...(options.headers || {}) },
        ...options
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        const err  = new Error(body.error || `HTTP ${res.status}`);
        err.status  = res.status;
        err.details = body.errors || null;
        throw err;
    }
    return res.json();
}

// ── Hazards ───────────────────────────────────────────────────────────────────

/**
 * fetchHazards(filters)
 * @param {Object} filters – { status, risk_level, category, barangay_id, active_only }
 */
export async function fetchHazards(filters = {}) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(filters)) {
        if (v !== undefined && v !== '') params.set(k, v);
    }
    const qs = params.toString();
    const data = await apiFetch(`/api/hazards${qs ? '?' + qs : ''}`);
    return data.data;
}

/**
 * fetchHazardDetail(id) → { hazard, assessment, plan, history, contacts }
 */
export async function fetchHazardDetail(id) {
    const data = await apiFetch(`/api/hazards/${id}`);
    return data.data;
}

/**
 * fetchActiveHazards() — for 30s polling
 */
export async function fetchActiveHazards() {
    return fetchHazards({ active_only: '1' });
}

// ── Barangays ─────────────────────────────────────────────────────────────────
export async function fetchBarangays() {
    const data = await apiFetch('/api/hazards/meta/barangays');
    return data.data;
}

// ── Offline geocode search ────────────────────────────────────────────────────
export async function localGeocode(query) {
    const data = await apiFetch(`/api/hazards/meta/geocode?q=${encodeURIComponent(query)}`);
    return data.data;
}

// ── Contacts ──────────────────────────────────────────────────────────────────
export async function fetchContacts(barangay = '') {
    const path = barangay
        ? `/api/contacts/${encodeURIComponent(barangay)}`
        : '/api/contacts';
    const data = await apiFetch(path);
    return data.data;
}

// ── Reports ───────────────────────────────────────────────────────────────────

/**
 * submitReport(formData) — multipart form with optional photo
 * @param {FormData} formData
 */
export async function submitReport(formData) {
    const data = await apiFetch('/api/reports', {
        method: 'POST',
        body:   formData
        // NOTE: Do NOT set Content-Type header — browser sets multipart boundary automatically
    });
    return data;
}

/**
 * logReportAction(refNumber, action)
 * action: 'bfp' | 'barangay' | 'none'
 */
export async function logReportAction(refNumber, action) {
    return apiFetch(`/api/reports/${refNumber}/action`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ action })
    });
}

// ── Nominatim geocoding (online search) ──────────────────────────────────────

const NOMINATIM_URL  = 'https://nominatim.openstreetmap.org/search';
const NOMINATIM_PARAMS = {
    format:       'json',
    countrycodes: 'ph',
    bounded:      '1',
    // Batangas City bounding box: south,west,north,east
    viewbox:      '120.93,13.60,121.14,13.85',
    limit:        '8',
    addressdetails: '1'
};

/**
 * nominatimSearch(query) → array of results
 * Each result: { lat, lon, display_name, type, ... }
 */
export async function nominatimSearch(query) {
    const params = new URLSearchParams({
        ...NOMINATIM_PARAMS,
        q: `${query}, Batangas City, Philippines`
    });
    const res = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
        headers: { 'Accept-Language': 'en', 'User-Agent': 'EmbeReady/1.0' }
    });
    if (!res.ok) throw new Error(`Nominatim ${res.status}`);
    const results = await res.json();

    // Filter: must be within Batangas City bounding box
    const BOUNDS = { south: 13.60, north: 13.85, west: 120.93, east: 121.14 };
    return results.filter(r => {
        const lat = parseFloat(r.lat);
        const lon = parseFloat(r.lon);
        return lat >= BOUNDS.south && lat <= BOUNDS.north &&
               lon >= BOUNDS.west  && lon <= BOUNDS.east;
    });
}

// ── 30-second live fire polling ───────────────────────────────────────────────
let _pollTimer = null;
let _pollCallback = null;

export function startLivePolling(callback, intervalMs = 30000) {
    _pollCallback = callback;
    if (_pollTimer) clearInterval(_pollTimer);
    _pollTimer = setInterval(async () => {
        try {
            const active = await fetchActiveHazards();
            _pollCallback(active);
        } catch (err) {
            console.warn('[API] Live poll failed:', err.message);
        }
    }, intervalMs);
}

export function stopLivePolling() {
    if (_pollTimer) clearInterval(_pollTimer);
    _pollTimer = null;
}
