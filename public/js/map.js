/**
 * public/js/map.js
 * ─────────────────────────────────────────────────────────────────────────────
 * EmbeReady — Leaflet Map Module
 * Controls main interactive map, hazard markers, live pulses,
 * filtering on the map layer, and report mini-map.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const BATANGAS_CENTER = [13.7565, 121.0583];
const DEFAULT_ZOOM    = 14;

let _map = null;
let _markerGroup = null;
let _searchMarker = null;
let _onSelectHazard = null;
let _miniMap = null;
let _miniPin = null;
let _miniPinLastValidLatLng = [...BATANGAS_CENTER];

// ── Water Detection ───────────────────────────────────────────────────────────
// Simple in-memory cache so we don't re-check the same coordinate twice.
const _waterCache = new Map();

/**
 * isOnWater(lat, lng) → Promise<boolean>
 * Uses the is-on-water.balbona.me free API (ASTER satellite dataset, 30m precision).
 * Results are cached per rounded coordinate (~11 m grid).
 */
async function isOnWater(lat, lng) {
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (_waterCache.has(key)) return _waterCache.get(key);

    try {
        const res = await fetch(
            `https://is-on-water.balbona.me/api/v1/get/${lat}/${lng}`,
            { signal: AbortSignal.timeout(4000) }
        );
        if (!res.ok) { _waterCache.set(key, false); return false; }
        const data = await res.json();
        const water = !!data.isWater;
        _waterCache.set(key, water);
        return water;
    } catch {
        // On network error or timeout, default to allowing placement
        _waterCache.set(key, false);
        return false;
    }
}

/**
 * showWaterError()
 * Inline toast that does not depend on app.js.
 */
function showWaterError() {
    const existing = document.getElementById('water-toast');
    if (existing) existing.remove();

    const el = document.createElement('div');
    el.id = 'water-toast';
    el.setAttribute('role', 'alert');
    el.style.cssText = [
        'position:fixed',
        'bottom:90px',
        'left:50%',
        'transform:translateX(-50%)',
        'background:#1e293b',
        'color:#f8fafc',
        'padding:10px 22px',
        'border-radius:4px',
        'border-left:3px solid #DC2626',
        'font-family:var(--font-mono,monospace)',
        'font-size:13px',
        'z-index:9999',
        'white-space:nowrap',
        'box-shadow:0 4px 20px rgba(0,0,0,0.5)',
        'pointer-events:none',
    ].join(';');
    el.textContent = '\u26A0  Cannot place a fire hazard on water.';
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
}

// ── Tile layer factory ────────────────────────────────────────────────────────
/**
 * buildTileLayer()
 * Returns an OpenStreetMap tile layer with retina/HiDPI support.
 * detectRetina:true tells Leaflet to request tiles at zoom+1 and scale them
 * down by 2×, producing pixel-perfect sharpness on HiDPI/Retina screens.
 * 100% free, no API key required, ever.
 */
function buildTileLayer() {
    return L.tileLayer(
        'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
            maxZoom: 19,
            minZoom: 3,
            tileSize: 256,
            detectRetina: true,
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
        }
    );
}

/**
 * initMap(containerId, onSelectHazard)
 * Initializes main Leaflet map.
 */
export function initMap(containerId = 'map', onSelectHazard = null) {
    if (_map) return _map;

    _onSelectHazard = onSelectHazard;

    _map = L.map(containerId, {
        center: BATANGAS_CENTER,
        zoom: DEFAULT_ZOOM,
        zoomControl: false,
        attributionControl: false,
        preferCanvas: true  // canvas renderer — faster marker drawing
    });

    // Custom zoom control in bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(_map);

    buildTileLayer().addTo(_map);

    _markerGroup = L.layerGroup().addTo(_map);

    // Auto-resize observer so Leaflet instantly adapts when container becomes visible or resizes
    if (window.ResizeObserver) {
        const container = document.getElementById(containerId);
        if (container) {
            const ro = new ResizeObserver(() => {
                if (_map && container.clientWidth > 0 && container.clientHeight > 0) {
                    _map.invalidateSize({ animate: false });
                }
            });
            ro.observe(container);
        }
    }

    return _map;
}

/**
 * createHazardMarker(hazard)
 * Builds custom HTML divIcon marker.
 */
function createHazardMarker(hazard) {
    const isLive = hazard.status === 'active';
    const riskClass = `er-marker-${hazard.risk_level || 'moderate'}`;
    const activeClass = isLive ? 'er-marker-active' : '';

    let glyph = '\u25CF';
    if (isLive) glyph = '\uD83D\uDD25';
    else if (hazard.risk_level === 'heavy') glyph = '\u25B2';
    else if (hazard.risk_level === 'moderate') glyph = '\u25C6';

    const pulseHtml = isLive
        ? '<div class="er-pulse-ring"></div><div class="er-pulse-ring er-pulse-ring-2"></div>'
        : '';

    const html = `
        <div class="er-marker ${riskClass} ${activeClass}">
            ${pulseHtml}
            <span>${glyph}</span>
        </div>
    `;

    const icon = L.divIcon({
        className: 'er-marker-wrapper',
        html,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
    });

    const marker = L.marker([hazard.lat, hazard.lng], { icon });

    // Custom tooltip
    const tooltipContent = `
        <div class="er-tooltip">
            <div class="tooltip-title">${escapeHtml(hazard.title)}</div>
            <div class="tooltip-meta">${escapeHtml(hazard.barangay_name || '')} &bull; ${escapeHtml((hazard.status === 'active' ? 'ACTIVE FIRE' : hazard.risk_level).toUpperCase())}</div>
        </div>
    `;

    marker.bindTooltip(tooltipContent, {
        direction: 'top',
        offset: [0, -14],
        opacity: 0.95
    });

    marker.on('click', () => {
        if (_onSelectHazard) _onSelectHazard(hazard.id);
    });

    return marker;
}

/**
 * renderHazards(hazardsList)
 * Clears and draws markers on the map.
 */
export function renderHazards(hazardsList = []) {
    if (!_markerGroup) return;
    _markerGroup.clearLayers();

    let activeCount = 0;

    hazardsList.forEach(h => {
        if (h.status === 'active') activeCount++;
        const marker = createHazardMarker(h);
        _markerGroup.addLayer(marker);
    });

    return { total: hazardsList.length, active: activeCount };
}

/**
 * flyTo(lat, lng, zoom = 16)
 */
export function flyTo(lat, lng, zoom = 16) {
    if (!_map) return;
    _map.flyTo([lat, lng], zoom, {
        duration: 1.2,
        easeLinearity: 0.25
    });
}

/**
 * highlightLocation(lat, lng, label = '')
 * Drops a temporary search pulse marker at coordinates.
 */
export function highlightLocation(lat, lng, label = '') {
    if (!_map) return;

    if (_searchMarker) {
        _map.removeLayer(_searchMarker);
        _searchMarker = null;
    }

    const icon = L.divIcon({
        className: 'search-location-pin',
        html: `
            <div style="position:relative; width:24px; height:24px;">
                <div style="position:absolute; inset:-8px; border-radius:50%; border:2px solid #059669; animation:pulse-ring 1.8s infinite;"></div>
                <div style="width:24px; height:24px; border-radius:50%; background:#059669; border:2.5px solid #fff; box-shadow:0 2px 8px rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; color:#fff; font-size:12px;">\uD83D\uDCCD</div>
            </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });

    _searchMarker = L.marker([lat, lng], { icon }).addTo(_map);

    if (label) {
        _searchMarker.bindTooltip(label, { permanent: true, direction: 'top', offset: [0, -14] }).openTooltip();
    }

    flyTo(lat, lng, 16);
}

/**
 * resetView()
 */
export function resetView() {
    if (!_map) return;
    _map.flyTo(BATANGAS_CENTER, DEFAULT_ZOOM);
}

/**
 * invalidateSize()
 * Call when map container becomes visible or drawer expands/collapses.
 */
export function invalidateSize() {
    if (_map) {
        _map.invalidateSize();
        setTimeout(() => { if (_map) _map.invalidateSize(); }, 100);
        setTimeout(() => { if (_map) _map.invalidateSize(); }, 350);
    }
}

// ── Report Mini-Map ───────────────────────────────────────────────────────────

/**
 * initReportMiniMap(containerId, onLocationChange)
 */
export function initReportMiniMap(containerId = 'report-minimap', onLocationChange = null) {
    const el = document.getElementById(containerId);
    if (!el) return;

    if (_miniMap) {
        _miniMap.remove();
        _miniMap = null;
    }

    _miniPinLastValidLatLng = [...BATANGAS_CENTER];

    _miniMap = L.map(containerId, {
        center: BATANGAS_CENTER,
        zoom: 14,
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false  // prevents trapping mouse wheel when scrolling the form
    });

    buildTileLayer().addTo(_miniMap);

    const pinIcon = L.divIcon({
        className: 'report-pin-marker',
        html: `
            <div style="width:30px; height:30px; border-radius:50%; background:#DC2626; border:3px solid #fff; box-shadow:0 3px 10px rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; color:#fff; font-size:14px; font-weight:bold;">
                \uD83D\uDCCD
            </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });

    _miniPin = L.marker(BATANGAS_CENTER, {
        draggable: true,
        icon: pinIcon
    }).addTo(_miniMap);

    // Auto-resize observer for mini-map
    if (window.ResizeObserver) {
        const ro = new ResizeObserver(() => {
            if (_miniMap && el.clientWidth > 0 && el.clientHeight > 0) {
                _miniMap.invalidateSize({ animate: false });
            }
        });
        ro.observe(el);
    }

    // Initial position trigger
    if (onLocationChange) {
        onLocationChange(BATANGAS_CENTER[0], BATANGAS_CENTER[1]);
    }

    // ── Water guard: drag ─────────────────────────────────────────────────────
    _miniPin.on('dragend', async (e) => {
        const { lat, lng } = e.target.getLatLng();
        if (await isOnWater(lat, lng)) {
            // Snap pin back to last valid land position
            _miniPin.setLatLng(_miniPinLastValidLatLng);
            showWaterError();
            return;
        }
        _miniPinLastValidLatLng = [lat, lng];
        if (onLocationChange) onLocationChange(lat, lng);
    });

    // ── Water guard: click ────────────────────────────────────────────────────
    _miniMap.on('click', async (e) => {
        const { lat, lng } = e.latlng;
        if (await isOnWater(lat, lng)) {
            showWaterError();
            return;
        }
        _miniPinLastValidLatLng = [lat, lng];
        _miniPin.setLatLng([lat, lng]);
        if (onLocationChange) onLocationChange(lat, lng);
    });

    setTimeout(() => _miniMap && _miniMap.invalidateSize(), 200);

    return {
        setLatLng: (lat, lng) => {
            if (_miniPin && _miniMap) {
                _miniPinLastValidLatLng = [lat, lng];
                _miniPin.setLatLng([lat, lng]);
                _miniMap.panTo([lat, lng]);
            }
        },
        invalidate: () => {
            if (_miniMap) _miniMap.invalidateSize();
        }
    };
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
