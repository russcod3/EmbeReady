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
        attributionControl: false
    });

    // Custom zoom control in bottom right
    L.control.zoom({ position: 'bottomright' }).addTo(_map);

    // OpenStreetMap tile layer (runs 100% locally or with cached/web tiles)
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(_map);

    _markerGroup = L.layerGroup().addTo(_map);

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

    let glyph = '●';
    if (isLive) glyph = '🔥';
    else if (hazard.risk_level === 'heavy') glyph = '▲';
    else if (hazard.risk_level === 'moderate') glyph = '◆';

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
                <div style="width:24px; height:24px; border-radius:50%; background:#059669; border:2.5px solid #fff; box-shadow:0 2px 8px rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; color:#fff; font-size:12px;">📍</div>
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
        setTimeout(() => _map.invalidateSize(), 200);
    }
}

/**
 * ── Report Mini-Map ───────────────────────────────────────────────────────────
 * initReportMiniMap(containerId, onLocationChange)
 */
export function initReportMiniMap(containerId = 'report-minimap', onLocationChange = null) {
    const el = document.getElementById(containerId);
    if (!el) return;

    if (_miniMap) {
        _miniMap.remove();
        _miniMap = null;
    }

    _miniMap = L.map(containerId, {
        center: BATANGAS_CENTER,
        zoom: 14,
        zoomControl: false,
        attributionControl: false
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18
    }).addTo(_miniMap);

    const pinIcon = L.divIcon({
        className: 'report-pin-marker',
        html: `
            <div style="width:30px; height:30px; border-radius:50%; background:#DC2626; border:3px solid #fff; box-shadow:0 3px 10px rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; color:#fff; font-size:14px; font-weight:bold;">
                📍
            </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
    });

    _miniPin = L.marker(BATANGAS_CENTER, {
        draggable: true,
        icon: pinIcon
    }).addTo(_miniMap);

    // Initial position trigger
    if (onLocationChange) {
        onLocationChange(BATANGAS_CENTER[0], BATANGAS_CENTER[1]);
    }

    _miniPin.on('dragend', (e) => {
        const { lat, lng } = e.target.getLatLng();
        if (onLocationChange) onLocationChange(lat, lng);
    });

    _miniMap.on('click', (e) => {
        const { lat, lng } = e.latlng;
        _miniPin.setLatLng([lat, lng]);
        if (onLocationChange) onLocationChange(lat, lng);
    });

    setTimeout(() => _miniMap.invalidateSize(), 250);

    return {
        setLatLng: (lat, lng) => {
            if (_miniPin && _miniMap) {
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
