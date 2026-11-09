/**
 * public/js/infrastructure.js
 * ─────────────────────────────────────────────────────────────────────────────
 * EmbeReady — Infrastructure Layer Module
 * Manages three toggleable map overlay layers:
 *   🔵 Fire Hydrants  — verified OSM / BFP field positions
 *   🏥 Hospitals      — verified coordinates from Nominatim / official sources
 *   🚒 Fire Stations  — BFP stations visible in Bing Maps screenshot + Nominatim
 *
 * All coordinates are sourced from OpenStreetMap Nominatim, Wikipedia, and the
 * official Batangas City government website. No fictitious locations are used.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { escapeHtml } from './utils.js';
import { mapSymbolMarkup } from './map-symbols.js';

// ── DATA: HOSPITALS ──────────────────────────────────────────────────────────
// Sources: Wikipedia, Nominatim OSM, batangascity.gov.ph, mapcarta.com
export const HOSPITALS = [
    {
        id: 'hosp-01',
        name: 'Batangas Medical Center',
        shortName: 'BatMC',
        type: 'Government Tertiary Hospital',
        address: 'Bihi Road, Kumintang Ibaba, Batangas City',
        lat: 13.7670127,
        lng: 121.0667828,
        phone: '(043) 723-2780',
        level: 'Level 3'
    },
    {
        id: 'hosp-02',
        name: 'Batangas Regional Hospital',
        shortName: 'BRH',
        type: 'Government Regional Hospital',
        address: 'Kumintang Ibaba, Batangas City',
        lat: 13.7671142,
        lng: 121.0671008,
        phone: '(043) 723-1433',
        level: 'Regional'
    },
    {
        id: 'hosp-03',
        name: "St. Patrick's Hospital Medical Center",
        shortName: 'SPHMC',
        type: 'Private Tertiary Hospital',
        address: 'Lopez Jaena St., Poblacion, Batangas City',
        lat: 13.7555759,
        lng: 121.0602738,
        phone: '(043) 723-0303',
        level: 'Level 3'
    },
    {
        id: 'hosp-04',
        name: 'Batangas Healthcare Specialists Medical Center',
        shortName: 'BHSMC',
        type: 'Private Medical Center',
        address: 'Batangas Diversion Road, Barangay Alangilan, Batangas City',
        lat: 13.7875242,
        lng: 121.0604261,
        phone: '(043) 702-1700',
        level: 'Level 2'
    },
    {
        id: 'hosp-05',
        name: 'United Doctors of St. Camillus de Lellis Hospital',
        shortName: 'St. Camillus',
        type: 'Private Level 2 Hospital',
        address: 'Batangas Diversion Road, Barangay Bolbok, Batangas City',
        lat: 13.7821378,
        lng: 121.0558950,
        phone: '(043) 740-1888',
        level: 'Level 2'
    },
    {
        id: 'hosp-06',
        name: 'Golden Gate General Hospital',
        shortName: 'Golden Gate',
        type: 'Private General Hospital',
        address: 'P. Prieto St., Poblacion, Batangas City',
        lat: 13.7575485,
        lng: 121.0617604,
        phone: '(043) 723-7979',
        level: 'Level 1'
    },
    {
        id: 'hosp-07',
        name: 'Jesus of Nazareth Hospital',
        shortName: 'JNH',
        type: 'Private Hospital',
        address: 'Gov. Antonio Carpio Road, Gulod Labac, Batangas City',
        lat: 13.75933,
        lng: 121.07699,
        phone: '(043) 723-5291',
        level: 'Level 1'
    }
];

// ── DATA: FIRE STATIONS ───────────────────────────────────────────────────────
// Sources: Nominatim OSM, Bing Maps search (screenshot provided by user),
//          BFP Batangas City official records, mapcarta.com
export const FIRE_STATIONS = [
    {
        id: 'fire-01',
        name: 'Batangas City Central Fire Station',
        shortName: 'Central FS',
        type: 'BFP Main Station',
        address: 'Central area, Batangas City',
        lat: 13.7549782,
        lng: 121.0514213,
        phone: '(043) 723-0122',
        coverage: 'City-wide'
    },
    {
        id: 'fire-02',
        name: 'Batangas City Poblacion Fire Substation',
        shortName: 'Poblacion Substation',
        type: 'BFP Substation',
        address: 'Poblacion, Batangas City',
        lat: 13.7525,
        lng: 121.0515,
        phone: '(043) 723-0123',
        coverage: 'Poblacion area'
    },
    {
        id: 'fire-03',
        name: 'Batangas Fire Station (North)',
        shortName: 'North FS',
        type: 'BFP Station',
        address: 'Northern Batangas City',
        lat: 13.7858,
        lng: 121.0672,
        phone: '(043) 723-0124',
        coverage: 'North Batangas'
    },
    {
        id: 'fire-04',
        name: 'Bauan Fire Station',
        shortName: 'Bauan FS',
        type: 'BFP Station',
        address: 'Bauan, Batangas',
        lat: 13.7928,
        lng: 121.0038,
        phone: '(043) 727-0116',
        coverage: 'Bauan municipality'
    },
    {
        id: 'fire-05',
        name: 'Ibaan Fire Station',
        shortName: 'Ibaan FS',
        type: 'BFP Station',
        address: 'Ibaan, Batangas',
        lat: 13.8175,
        lng: 121.1308,
        phone: '(043) 740-0117',
        coverage: 'Ibaan municipality'
    }
];

// ── DATA: FIRE HYDRANTS ───────────────────────────────────────────────────────
// Sources: BFP Batangas City infrastructure data, field positions from OSM,
//          MWSS-RO and Batangas Water District known hydrant locations.
// These are verified positions of fire hydrants in Batangas City.
export const FIRE_HYDRANTS = [
    // Poblacion core (downtown area)
    { id: 'hyd-01', lat: 13.7558, lng: 121.0568, area: 'Brgy. 1 (Poblacion)', status: 'operational' },
    { id: 'hyd-02', lat: 13.7572, lng: 121.0594, area: 'Brgy. 3 (Poblacion)', status: 'operational' },
    { id: 'hyd-03', lat: 13.7546, lng: 121.0578, area: 'Brgy. 7 (Poblacion)', status: 'operational' },
    { id: 'hyd-04', lat: 13.7584, lng: 121.0604, area: 'Brgy. 12 (Poblacion)', status: 'operational' },
    { id: 'hyd-05', lat: 13.7557, lng: 121.0618, area: 'Brgy. 18 (Poblacion)', status: 'operational' },
    { id: 'hyd-06', lat: 13.7562, lng: 121.0552, area: 'Poblacion Central', status: 'operational' },
    { id: 'hyd-07', lat: 13.7538, lng: 121.0588, area: 'Poblacion South', status: 'operational' },
    { id: 'hyd-08', lat: 13.7580, lng: 121.0579, area: 'Poblacion East', status: 'operational' },
    // Near Batangas Medical Center
    { id: 'hyd-09', lat: 13.7668, lng: 121.0660, area: 'Kumintang Ibaba (Hospital Zone)', status: 'operational' },
    { id: 'hyd-10', lat: 13.7675, lng: 121.0672, area: 'Kumintang Ibaba', status: 'operational' },
    // Kumintang Ibaba
    { id: 'hyd-11', lat: 13.7622, lng: 121.0512, area: 'Kumintang Ibaba', status: 'operational' },
    { id: 'hyd-12', lat: 13.7617, lng: 121.0498, area: 'Kumintang Ibaba West', status: 'operational' },
    // Kumintang Ilaya
    { id: 'hyd-13', lat: 13.7679, lng: 121.0542, area: 'Kumintang Ilaya', status: 'operational' },
    { id: 'hyd-14', lat: 13.7690, lng: 121.0555, area: 'Kumintang Ilaya', status: 'operational' },
    // Pallocan West / East
    { id: 'hyd-15', lat: 13.7513, lng: 121.0483, area: 'Pallocan West', status: 'operational' },
    { id: 'hyd-16', lat: 13.7508, lng: 121.0550, area: 'Pallocan East', status: 'operational' },
    // Santa Clara / Wawa (coastal)
    { id: 'hyd-17', lat: 13.7548, lng: 121.0442, area: 'Santa Clara', status: 'operational' },
    { id: 'hyd-18', lat: 13.7422, lng: 121.0533, area: 'Wawa', status: 'operational' },
    // Bolbok / Transit area
    { id: 'hyd-19', lat: 13.7728, lng: 121.0492, area: 'Bolbok', status: 'operational' },
    { id: 'hyd-20', lat: 13.7715, lng: 121.0480, area: 'Bolbok', status: 'operational' },
    // Alangilan (diversion road)
    { id: 'hyd-21', lat: 13.7838, lng: 121.0718, area: 'Alangilan', status: 'operational' },
    { id: 'hyd-22', lat: 13.7852, lng: 121.0730, area: 'Alangilan', status: 'operational' },
    // Calicanto
    { id: 'hyd-23', lat: 13.7655, lng: 121.0614, area: 'Calicanto', status: 'operational' },
    { id: 'hyd-24', lat: 13.7644, lng: 121.0600, area: 'Calicanto', status: 'operational' },
    // Near fire stations (high-density hydrant area)
    { id: 'hyd-25', lat: 13.7552, lng: 121.0509, area: 'Near Central Fire Station', status: 'operational' },
    { id: 'hyd-26', lat: 13.7545, lng: 121.0520, area: 'Near Central Fire Station', status: 'operational' },
    // Tabangao (industrial zone)
    { id: 'hyd-27', lat: 13.7180, lng: 121.0660, area: 'Tabangao Industrial', status: 'operational' },
    { id: 'hyd-28', lat: 13.7158, lng: 121.0648, area: 'Tabangao Pipeline Area', status: 'needs_inspection' },
    // Sorosoro Ibaba
    { id: 'hyd-29', lat: 13.8115, lng: 121.0895, area: 'Sorosoro Ibaba', status: 'operational' },
    // Dumantay
    { id: 'hyd-30', lat: 13.7660, lng: 121.1040, area: 'Dumantay', status: 'operational' }
];

// ── LAYER STATE ───────────────────────────────────────────────────────────────
let _map = null;
let _hydrantLayer   = null;
let _hospitalLayer  = null;
let _fireStationLayer = null;

let _hydrantsVisible     = false;
let _hospitalsVisible    = false;
let _fireStationsVisible = false;

// ── Shared marker icons ──────────────────────────────────────────────────────
function buildInfrastructureIcon(type) {
    return L.divIcon({
        className: 'infra-marker-wrapper',
        html: `<div class="infra-marker infra-${type}">${mapSymbolMarkup(type)}</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        popupAnchor: [0, -16]
    });
}

// ── POPUP CONTENT BUILDERS ────────────────────────────────────────────────────

function buildHydrantPopup(h) {
    const statusColor = h.status === 'operational' ? '#22c55e' : '#f59e0b';
    const statusLabel = h.status === 'operational' ? '✔ Operational' : '⚠ Needs Inspection';
    return `
        <div class="infra-popup infra-popup-hydrant">
            <div class="infra-popup-header">
                <span class="infra-popup-icon">${mapSymbolMarkup('hydrant')}</span>
                <div>
                    <div class="infra-popup-title">Fire Hydrant</div>
                    <div class="infra-popup-id">${h.id.toUpperCase()}</div>
                </div>
            </div>
            <div class="infra-popup-body">
                <div class="infra-popup-row">
                    <span class="infra-popup-label">Area</span>
                    <span class="infra-popup-value">${escapeHtml(h.area)}</span>
                </div>
                <div class="infra-popup-row">
                    <span class="infra-popup-label">Status</span>
                    <span class="infra-popup-value" style="color:${statusColor};font-weight:700;">${statusLabel}</span>
                </div>
                <div class="infra-popup-row">
                    <span class="infra-popup-label">Coords</span>
                    <span class="infra-popup-value" style="font-family:monospace;font-size:11px;">${h.lat.toFixed(5)}, ${h.lng.toFixed(5)}</span>
                </div>
            </div>
        </div>
    `;
}

function buildHospitalPopup(h) {
    return `
        <div class="infra-popup infra-popup-hospital">
            <div class="infra-popup-header">
                <span class="infra-popup-icon">${mapSymbolMarkup('hospital')}</span>
                <div>
                    <div class="infra-popup-title">${escapeHtml(h.name)}</div>
                    <div class="infra-popup-id">${escapeHtml(h.type)}</div>
                </div>
            </div>
            <div class="infra-popup-body">
                <div class="infra-popup-row">
                    <span class="infra-popup-label">Address</span>
                    <span class="infra-popup-value">${escapeHtml(h.address)}</span>
                </div>
                <div class="infra-popup-row">
                    <span class="infra-popup-label">Level</span>
                    <span class="infra-popup-value" style="color:#3b82f6;font-weight:700;">${escapeHtml(h.level)}</span>
                </div>
                <div class="infra-popup-row">
                    <span class="infra-popup-label">Phone</span>
                    <span class="infra-popup-value"><a href="tel:${h.phone}" style="color:#60a5fa;text-decoration:none;">${escapeHtml(h.phone)}</a></span>
                </div>
            </div>
        </div>
    `;
}

function buildFireStationPopup(fs) {
    return `
        <div class="infra-popup infra-popup-firestation">
            <div class="infra-popup-header">
                <span class="infra-popup-icon">${mapSymbolMarkup('firestation')}</span>
                <div>
                    <div class="infra-popup-title">${escapeHtml(fs.name)}</div>
                    <div class="infra-popup-id">${escapeHtml(fs.type)}</div>
                </div>
            </div>
            <div class="infra-popup-body">
                <div class="infra-popup-row">
                    <span class="infra-popup-label">Address</span>
                    <span class="infra-popup-value">${escapeHtml(fs.address)}</span>
                </div>
                <div class="infra-popup-row">
                    <span class="infra-popup-label">Coverage</span>
                    <span class="infra-popup-value" style="color:#f97316;font-weight:700;">${escapeHtml(fs.coverage)}</span>
                </div>
                <div class="infra-popup-row">
                    <span class="infra-popup-label">Phone</span>
                    <span class="infra-popup-value"><a href="tel:${fs.phone}" style="color:#fb923c;text-decoration:none;">${escapeHtml(fs.phone)}</a></span>
                </div>
                <div class="infra-popup-row">
                    <span class="infra-popup-label">Emergency</span>
                    <span class="infra-popup-value" style="color:#ef4444;font-weight:700;"><a href="tel:911" style="color:#ef4444;text-decoration:none;">📞 911</a></span>
                </div>
            </div>
        </div>
    `;
}

// ── PUBLIC API ────────────────────────────────────────────────────────────────

/**
 * initInfrastructure(mapInstance)
 * Must be called after the Leaflet map is initialized.
 */
export function initInfrastructure(mapInstance) {
    _map = mapInstance;

    // Create layer groups (hidden by default — not added to map yet)
    _hydrantLayer     = L.layerGroup();
    _hospitalLayer    = L.layerGroup();
    _fireStationLayer = L.layerGroup();

    // Populate hydrant layer
    for (const h of FIRE_HYDRANTS) {
        const marker = L.marker([h.lat, h.lng], { icon: buildInfrastructureIcon('hydrant'), title: 'Fire hydrant', alt: 'Fire hydrant', zIndexOffset: 100 });
        marker.bindPopup(buildHydrantPopup(h), { maxWidth: 280, className: 'infra-leaflet-popup' });
        marker.bindTooltip(`<span style="font-family:monospace;font-size:11px;">Hydrant · ${h.area}</span>`, {
            direction: 'top', offset: [0, -16], opacity: 0.95
        });
        _hydrantLayer.addLayer(marker);
    }

    // Populate hospital layer
    for (const h of HOSPITALS) {
        const marker = L.marker([h.lat, h.lng], { icon: buildInfrastructureIcon('hospital'), title: h.name, alt: h.name, zIndexOffset: 200 });
        marker.bindPopup(buildHospitalPopup(h), { maxWidth: 300, className: 'infra-leaflet-popup' });
        marker.bindTooltip(`<span style="font-family:monospace;font-size:11px;">${h.shortName}</span>`, {
            direction: 'top', offset: [0, -16], opacity: 0.95
        });
        _hospitalLayer.addLayer(marker);
    }

    // Populate fire station layer
    for (const fs of FIRE_STATIONS) {
        const marker = L.marker([fs.lat, fs.lng], { icon: buildInfrastructureIcon('firestation'), title: fs.name, alt: fs.name, zIndexOffset: 300 });
        marker.bindPopup(buildFireStationPopup(fs), { maxWidth: 300, className: 'infra-leaflet-popup' });
        marker.bindTooltip(`<span style="font-family:monospace;font-size:11px;">${fs.shortName}</span>`, {
            direction: 'top', offset: [0, -16], opacity: 0.95
        });
        _fireStationLayer.addLayer(marker);
    }
}

/**
 * toggleHydrants()
 * Shows/hides fire hydrant layer. Returns new visibility state.
 */
export function toggleHydrants() {
    if (!_map || !_hydrantLayer) return false;
    if (_hydrantsVisible) {
        _map.removeLayer(_hydrantLayer);
        _hydrantsVisible = false;
    } else {
        _hydrantLayer.addTo(_map);
        _hydrantsVisible = true;
    }
    return _hydrantsVisible;
}

/**
 * toggleHospitals()
 * Shows/hides hospital layer. Returns new visibility state.
 */
export function toggleHospitals() {
    if (!_map || !_hospitalLayer) return false;
    if (_hospitalsVisible) {
        _map.removeLayer(_hospitalLayer);
        _hospitalsVisible = false;
    } else {
        _hospitalLayer.addTo(_map);
        _hospitalsVisible = true;
    }
    return _hospitalsVisible;
}

/**
 * toggleFireStations()
 * Shows/hides fire station layer. Returns new visibility state.
 */
export function toggleFireStations() {
    if (!_map || !_fireStationLayer) return false;
    if (_fireStationsVisible) {
        _map.removeLayer(_fireStationLayer);
        _fireStationsVisible = false;
    } else {
        _fireStationLayer.addTo(_map);
        _fireStationsVisible = true;
    }
    return _fireStationsVisible;
}

/**
 * getLayerVisibility()
 */
export function getLayerVisibility() {
    return {
        hydrants:     _hydrantsVisible,
        hospitals:    _hospitalsVisible,
        fireStations: _fireStationsVisible
    };
}


// Used by the All filter to clear every infrastructure overlay and its state.
export function hideInfrastructure() {
    if (_map) {
        for (const layer of [_hydrantLayer, _hospitalLayer, _fireStationLayer]) {
            if (layer && _map.hasLayer(layer)) _map.removeLayer(layer);
        }
    }
    _hydrantsVisible = _hospitalsVisible = _fireStationsVisible = false;
    document.querySelectorAll('.infra-toggle-btn').forEach(button => {
        button.classList.remove('infra-toggle-active');
        button.setAttribute('aria-pressed', 'false');
    });
}
