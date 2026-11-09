/**
 * public/js/map.js
 * ─────────────────────────────────────────────────────────────────────────────
 * EmbeReady — Leaflet Map Module
 * Controls main interactive map, hazard markers, live pulses,
 * filtering on the map layer, and report mini-map.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { mapSymbolMarkup } from './map-symbols.js';

const BATANGAS_CENTER = [13.7565, 121.0583];
const DEFAULT_ZOOM = 14;

let _map = null;
let _markerGroup = null;
let _searchMarker = null;
let _onSelectHazard = null;
let _miniMap = null;
let _miniPin = null;
const _hazardMarkers=new Map();

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
        attributionControl: true,
        preferCanvas: true  // canvas renderer — faster marker drawing
    });

    // Keep zoom controls above the legend, with the current level below them.
    const zoomControl = L.control.zoom({ position: 'bottomleft' }).addTo(_map);
    zoomControl.getContainer().classList.add('map-zoom-control');
    const zoomLevel = document.createElement('output');
    zoomLevel.className = 'map-zoom-level';
    zoomLevel.setAttribute('aria-live', 'polite');
    zoomLevel.setAttribute('aria-atomic', 'true');
    let zoomNoticeTimer;
    let previousZoom = _map.getZoom();
    const updateZoomLevel = () => {
        const currentZoom = _map.getZoom();
        if (currentZoom === previousZoom) return;
        previousZoom = currentZoom;
        clearTimeout(zoomNoticeTimer);
        zoomLevel.textContent = `Zoom ${currentZoom}`;
        zoomLevel.classList.add('is-visible');
        zoomNoticeTimer = setTimeout(() => zoomLevel.classList.remove('is-visible'), 1000);
    };
    zoomControl.getContainer().append(zoomLevel);
    _map.on('zoomend', updateZoomLevel);

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
    const symbol = isLive ? 'active' : (hazard.risk_level || 'pending');
    const riskClass = `er-marker-${symbol}`;
    const activeClass = isLive ? 'er-marker-active' : '';

    const pulseHtml = isLive
        ? '<div class="er-pulse-ring"></div><div class="er-pulse-ring er-pulse-ring-2"></div>'
        : '';

    const html = `
        <div class="er-marker ${riskClass} ${activeClass}">
            ${pulseHtml}
            ${mapSymbolMarkup(symbol)}
        </div>
    `;

    const icon = L.divIcon({
        className: 'er-marker-wrapper',
        html,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
    });

    const marker = L.marker([hazard.lat, hazard.lng], { icon, title: hazard.title, alt: hazard.title });

    // Custom tooltip
    const riskLevelDisplay = (hazard.status === 'active' ? 'Live' : (hazard.risk_level === 'heavy' ? 'High' : (hazard.risk_level || (hazard.ai_status==='unavailable'?'Assessment unavailable':hazard.ai_status==='completed'?'More evidence needed':'Assessing')))).toUpperCase();
    const sourceLabel=hazard.status!=='active'&&hazard.reported_level&&!hazard.assessed_level?' · REPORTER-SELECTED':'';
    const tooltipContent = `
        <div class="er-tooltip">
            <div class="tooltip-title">${escapeHtml(hazard.title)}</div>
            <div class="tooltip-meta">${escapeHtml(hazard.barangay_name || '')} &bull; ${escapeHtml(riskLevelDisplay)}${sourceLabel}</div>
        </div>
    `;

    marker.bindTooltip(tooltipContent, {
        direction: 'top',
        offset: [0, -14],
        opacity: 0.95,
        className: 'er-tooltip-wrap'
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
    const ids=new Set(hazardsList.map(h=>h.id));
    for(const [id,item]of _hazardMarkers)if(!ids.has(id)||!_markerGroup.hasLayer(item.marker)){_markerGroup.removeLayer(item.marker);_hazardMarkers.delete(id);}
    let activeCount=0;
    for(const h of hazardsList){
        if(h.status==='active')activeCount++;
        const key=JSON.stringify([h.lat,h.lng,h.risk_level,h.status,h.title,h.ai_status,h.assessed_level]);
        const old=_hazardMarkers.get(h.id);
        if(old?.key===key)continue;
        if(old)_markerGroup.removeLayer(old.marker);
        const marker=createHazardMarker(h);_markerGroup.addLayer(marker);_hazardMarkers.set(h.id,{key,marker});
    }

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
        _searchMarker.bindTooltip(label, {
            permanent: true,
            direction: 'top',
            offset: [0, -14],
            className: 'er-tooltip-wrap'
        }).openTooltip();
    }

    flyTo(lat, lng, 16);
}

/**
 * clearSearchMarker()
 */
export function clearSearchMarker() {
    const hadMarker = Boolean(_searchMarker);
    if (_searchMarker && _map) {
        _map.removeLayer(_searchMarker);
        _searchMarker = null;
    }
    return hadMarker;
}

/**
 * getMapInstance()
 * Returns the initialized Leaflet map instance for use by other modules.
 */
export function getMapInstance() {
    return _map;
}

/**
 * resetView()
 */
export function resetView() {
    if (!_map) return;
    clearSearchMarker();
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


    _miniMap = L.map(containerId, {
        center: BATANGAS_CENTER,
        zoom: 14,
        zoomControl: false,
        attributionControl: true,
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
    });

    // Auto-resize observer for mini-map
    if (window.ResizeObserver) {
        const ro = new ResizeObserver(() => {
            if (_miniMap && el.clientWidth > 0 && el.clientHeight > 0) {
                _miniMap.invalidateSize({ animate: false });
            }
        });
        ro.observe(el);
    }

    // Coordinates stay empty until the reporter explicitly pins a location.

    // ── Explicit pin: drag ─────────────────────────────────────────────────────
    _miniPin.on('dragend', (e) => {
        const { lat, lng } = e.target.getLatLng();
        if (onLocationChange) onLocationChange(lat, lng);
    });

    // ── Explicit pin: click ────────────────────────────────────────────────────
    _miniMap.on('click', (e) => {
        const { lat, lng } = e.latlng;
        if (!_miniMap.hasLayer(_miniPin)) _miniPin.addTo(_miniMap);
        _miniPin.setLatLng([lat, lng]);
        if (onLocationChange) onLocationChange(lat, lng);
    });

    setTimeout(() => _miniMap && _miniMap.invalidateSize(), 200);

    return {
        clear: () => { if (_miniMap.hasLayer(_miniPin)) _miniMap.removeLayer(_miniPin); },
        centerOn: (lat,lng) => _miniMap.panTo([lat,lng]),
        setLatLng: (lat, lng) => {
            if (_miniPin && _miniMap) {
                        if (!_miniMap.hasLayer(_miniPin)) _miniPin.addTo(_miniMap);
                _miniPin.setLatLng([lat, lng]);
                _miniMap.panTo([lat, lng]);
                if (onLocationChange) onLocationChange(lat, lng);
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
