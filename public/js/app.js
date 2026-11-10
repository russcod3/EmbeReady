/**
 * public/js/app.js
 * ─────────────────────────────────────────────────────────────────────────────
 * EmbeReady — Main Application Entry Point
 * Orchestrates:
 * - Landing view <-> Map view switching
 * - Search & autocomplete (Nominatim + local fallback)
 * - Map marker rendering & live pulse badges
 * - Drawer open/close for hazard details
 * - Dynamic filter bar (Risk, Status, Barangay, Category)
 * - 30s background polling for live fires
 * - Report submission & post-submission flows
 * ─────────────────────────────────────────────────────────────────────────────
 */

import S from '../strings.js';
import { escapeHtml, escapeAttr } from './utils.js';
import { fetchHazards, fetchBarangays, startLivePolling, startAssessments, fetchAssessmentStatus } from './api.js';
import { search, QUICK_JUMPS, formatLabel } from './search.js';
import { initMap, renderHazards, flyTo, highlightLocation, resetView, invalidateSize, getMapInstance } from './map.js';
import { initDrawer, openDrawer, closeDrawer } from './drawer.js';
import { initReportForm, refreshMiniMap, openReportPanel, closeReportPanel } from './report.js';
import { initInfrastructure, toggleHydrants, toggleHospitals, toggleFireStations } from './infrastructure.js';
import { initMapSymbols } from './map-symbols.js';
import { HAZARD_LEVELS, allLevelsActive, toggleLevel, filterHazards } from './hazard-filters.mjs';

// State
let _currentView = 'landing'; // 'landing' | 'map'
let _currentFilters = {
    category: '',
    barangay_id: ''
};
let _allHazards = null;
let _activeLevels = new Set(HAZARD_LEVELS);
let _hazardLoadVersion = 0;

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    initMapSymbols();
    // 1. Initialize Map & Detail Drawer
    const map = initMap('map', (hazardId) => {
        openDrawer(hazardId);
    });
    initDrawer();

    // 1b. Initialize Infrastructure Layers (hidden by default)
    initInfrastructure(map);

    // 2. Initialize Report Form
    initReportForm(async (newHazardId) => {
        showToast('Report saved on the map.', 'success');
        closeReportPanel();
        _activeLevels = new Set(HAZARD_LEVELS);
        _currentFilters = { category:'',barangay_id:'' };
        document.getElementById('filter-barangay-select').value = '';
        document.getElementById('filter-category-select').value = '';
        renderFilteredHazards();
        await loadHazards();
        // Open the newly created hazard
        if (newHazardId) {
            openDrawer(newHazardId);
        }
    });

    // 3. Setup Navigation & View Switching
    setupNavigation();

    // 4. Setup Search (Landing & Header)
    setupSearch();

    // 5. Setup Quick-Jump Buttons
    setupQuickJumps();

    // 6. Populate barangay dropdown from DB (ensures IDs match actual database)
    await populateBarangayDropdown();

    // 7. Setup Filters
    setupFilters();

    // 8. Setup Live Polling (every 30 seconds)
    startLivePolling((activeFires) => {
        updateLiveFireCounter(activeFires.length);
        // Refresh live markers without changing the user's level switches.
        if (_activeLevels.has('live')) {
            loadHazards();
        }
    });

    // 8. Offline status detector
    setupNetworkStatus();

    // 9. Initial hazard fetch
    loadHazards();
    monitorAssessments(true);
    window.addEventListener('assessment:requested',()=>monitorAssessments());
    document.getElementById('assessment-retry').addEventListener('click',()=>monitorAssessments(true,true));
}

let _assessmentMonitoring=false;
async function monitorAssessments(start=false,retry=false) {
    if(_assessmentMonitoring)return;
    _assessmentMonitoring=true;
    const box=document.getElementById('assessment-progress'),text=document.getElementById('assessment-progress-text'),button=document.getElementById('assessment-retry');
    try {
        let progress=start?await startAssessments(retry):await fetchAssessmentStatus();
        do {
            box.hidden=!progress.total;
            box.dataset.state=progress.queued+progress.processing?'processing':progress.unavailable?'unavailable':'completed';
            text.textContent=progress.queued+progress.processing?`Assessing hazards · ${progress.completed}/${progress.total}`:progress.unavailable?`${progress.completed} reports ready · ${progress.unavailable} awaiting assessment`:`${progress.completed} assessments ready`;
            button.hidden=!progress.unavailable||Boolean(progress.queued+progress.processing);
            await loadHazards();
            window.dispatchEvent(new CustomEvent('assessment:updated'));
            if(!progress.queued&&!progress.processing)break;
            await new Promise(resolve=>setTimeout(resolve,2500));
            progress=await fetchAssessmentStatus();
        } while(true);
    } catch(error) {
        box.hidden=false;box.dataset.state='unavailable';text.textContent='Could not check assessment progress';button.hidden=false;
    } finally {_assessmentMonitoring=false;}
}

/**
 * switchView(viewName)
 */
function switchView(viewName) {
    _currentView = viewName;
    const landingView = document.getElementById('view-landing');
    const mapView     = document.getElementById('view-map');

    if (viewName === 'map') {
        landingView.classList.remove('is-active');
        mapView.classList.add('is-active');
        window.scrollTo(0, 0);
        invalidateSize();
    } else {
        closeDrawer();
        mapView.classList.remove('is-active');
        landingView.classList.add('is-active');
        window.scrollTo(0, 0);
    }
}

/**
 * setupNavigation()
 */
function setupNavigation() {
    // Landing "View full city map" button
    const exploreBtn = document.getElementById('landing-explore-btn');
    if (exploreBtn) {
        exploreBtn.addEventListener('click', () => {
            switchView('map');
            setTimeout(() => {
                invalidateSize();
                resetView();
            }, 60);
        });
    }

    // Header logo click -> back to landing
    const mapWordmark = document.getElementById('map-wordmark');
    if (mapWordmark) {
        mapWordmark.addEventListener('click', () => {
            resetView();
        });
    }

    // Live counter badge click -> filter to active fires
    const liveCounter = document.getElementById('live-fire-counter');
    if (liveCounter) {
        liveCounter.addEventListener('click', () => {
            switchView('map');
            _activeLevels = new Set(['live']);
            renderFilteredHazards();
            loadHazards();
        });
    }

    // Report FAB button -> scroll to report section
    const fabBtn = document.getElementById('report-fab-btn');
    if (fabBtn) {
        fabBtn.addEventListener('click', () => {
            scrollToReport();
        });
    }

    const headerReportBtn = document.getElementById('map-report-btn');
    if (headerReportBtn) {
        headerReportBtn.addEventListener('click', () => {
            scrollToReport();
        });
    }

    // Back to map button in report section
    const backToMapBtn = document.getElementById('back-to-map-btn');
    if (backToMapBtn) {
        backToMapBtn.addEventListener('click', closeReportPanel);
    }

    // ── Infrastructure Layer Toggles ─────────────────────────────────────────
    const hydrantBtn     = document.getElementById('toggle-hydrants-btn');
    const hospitalBtn    = document.getElementById('toggle-hospitals-btn');
    const fireStationBtn = document.getElementById('toggle-firestations-btn');

    if (hydrantBtn) {
        hydrantBtn.addEventListener('click', () => {
            const visible = toggleHydrants();
            hydrantBtn.classList.toggle('infra-toggle-active', visible);
            hydrantBtn.setAttribute('aria-pressed', visible);
            showToast(visible ? 'Fire Hydrants shown' : 'Fire Hydrants hidden', 'info');
        });
    }

    if (hospitalBtn) {
        hospitalBtn.addEventListener('click', () => {
            const visible = toggleHospitals();
            hospitalBtn.classList.toggle('infra-toggle-active', visible);
            hospitalBtn.setAttribute('aria-pressed', visible);
            showToast(visible ? 'Hospitals shown' : 'Hospitals hidden', 'info');
        });
    }

    if (fireStationBtn) {
        fireStationBtn.addEventListener('click', () => {
            const visible = toggleFireStations();
            fireStationBtn.classList.toggle('infra-toggle-active', visible);
            fireStationBtn.setAttribute('aria-pressed', visible);
            showToast(visible ? 'Fire Stations shown' : 'Fire Stations hidden', 'info');
        });
    }
}

function scrollToReport() {
    const reportSection = document.getElementById('report-section');
    if (reportSection) {
        closeDrawer();
        openReportPanel();
        setTimeout(() => refreshMiniMap(), 300);
        setTimeout(() => refreshMiniMap(), 600);
    }
}

/**
 * setupSearch()
 */
function setupSearch() {
    setupSearchInput('landing-search-input', 'landing-search-form', 'landing-autocomplete');
    setupSearchInput('map-search-input', 'map-search-form', 'map-autocomplete');
}

function setupSearchInput(inputId, formId, dropdownId) {
    const input = document.getElementById(inputId);
    const form  = document.getElementById(formId);
    const drop  = document.getElementById(dropdownId);
    if (!input || !form || !drop) return;

    let debounceTimer = null;

    input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        const q = input.value.trim();
        if (q.length < 2) {
            drop.classList.remove('is-open');
            drop.innerHTML = '';
            return;
        }

        debounceTimer = setTimeout(async () => {
            const { results, offline } = await search(q);
            renderAutocompleteResults(results, drop, input, offline);
        }, 250);
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const q = input.value.trim();
        if (!q) return;

        drop.classList.remove('is-open');
        const { results } = await search(q);
        if (results.length > 0) {
            const first = results[0];
            executeSearchJump(first.lat, first.lng, first.label);
        } else {
            showToast(S.landing.noResultsMsg, 'warning');
        }
    });

    // Close autocomplete on clicking outside
    document.addEventListener('click', (e) => {
        if (!form.contains(e.target)) {
            drop.classList.remove('is-open');
        }
    });
}

function renderAutocompleteResults(results, dropEl, inputEl, isOffline) {
    if (!results || results.length === 0) {
        dropEl.classList.remove('is-open');
        dropEl.innerHTML = '';
        return;
    }

    dropEl.innerHTML = results.map(r => `
        <div class="autocomplete-item" data-lat="${r.lat}" data-lng="${r.lng}" data-label="${escapeAttr(r.label)}">
            <span class="item-type">${escapeHtml((r.type || 'PLACE').toUpperCase())}</span>
            <span>${escapeHtml(r.label)}</span>
        </div>
    `).join('');

    dropEl.classList.add('is-open');

    dropEl.querySelectorAll('.autocomplete-item').forEach(item => {
        item.addEventListener('click', () => {
            const lat = parseFloat(item.getAttribute('data-lat'));
            const lng = parseFloat(item.getAttribute('data-lng'));
            const label = item.getAttribute('data-label');
            inputEl.value = label;
            dropEl.classList.remove('is-open');
            executeSearchJump(lat, lng, label);
        });
    });
}

function executeSearchJump(lat, lng, label) {
    switchView('map');
    setTimeout(() => {
        invalidateSize();
        highlightLocation(lat, lng, label);
        showToast(`Jumped to ${label}`, 'info');
    }, 60);
}

/**
 * setupQuickJumps()
 */
function setupQuickJumps() {
    const container = document.getElementById('landing-quickjump-list');
    if (!container) return;

    container.innerHTML = QUICK_JUMPS.map(qj => `
        <button class="quickjump-chip" data-lat="${qj.lat}" data-lng="${qj.lng}" data-label="${escapeAttr(qj.label)}">
            ${escapeHtml(qj.label)}
        </button>
    `).join('');

    container.querySelectorAll('.quickjump-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            const lat = parseFloat(btn.getAttribute('data-lat'));
            const lng = parseFloat(btn.getAttribute('data-lng'));
            const label = btn.getAttribute('data-label');
            executeSearchJump(lat, lng, label);
        });
    });
}

/**
 * populateBarangayDropdown()
 * Fetches barangays from the API and builds <option> elements using
 * actual DB IDs as values — prevents mismatch with hardcoded options.
 */
async function populateBarangayDropdown() {
    const bgySelect = document.getElementById('filter-barangay-select');
    if (!bgySelect) return;

    try {
        const barangays = await fetchBarangays();
        // Preserve the "All Barangays" default option, then append real ones
        bgySelect.innerHTML = '<option value="">All Barangays</option>';
        barangays.forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.id;        // actual DB primary key
            opt.textContent = b.name;
            bgySelect.appendChild(opt);
        });
    } catch (err) {
        console.warn('[App] Could not load barangays for filter dropdown:', err.message);
        // Dropdown degrades gracefully — stays at "All Barangays" only
    }
}

/**
 * setupFilters()
 */
function setupFilters() {
    const chips = document.querySelectorAll('.filter-bar .filter-chip[data-filter]');
    _activeLevels = new Set(HAZARD_LEVELS);
    renderFilteredHazards();
    setupFilterTip();

    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            _activeLevels = toggleLevel(_activeLevels, chip.dataset.filter);
            renderFilteredHazards();
            if (!_activeLevels.size) closeDrawer();
        });
    });

    // Select dropdowns
    const bgySelect = document.getElementById('filter-barangay-select');
    if (bgySelect) {
        bgySelect.value = '';
        bgySelect.addEventListener('change', () => {
            _currentFilters.barangay_id = bgySelect.value;
            renderFilteredHazards();
        });
    }

    const catSelect = document.getElementById('filter-category-select');
    if (catSelect) {
        catSelect.value = '';
        catSelect.addEventListener('change', () => {
            _currentFilters.category = catSelect.value;
            renderFilteredHazards();
        });
    }

    const resetBtn = document.getElementById('filter-reset-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            _activeLevels = new Set(HAZARD_LEVELS);
            _currentFilters = { category: '', barangay_id: '' };
            if (bgySelect) bgySelect.value = '';
            if (catSelect) catSelect.value = '';
            renderFilteredHazards();
            loadHazards();
        });
    }
}

function setupFilterTip() {
    const tip = document.getElementById('filter-first-tip');
    const storageKey = 'embeready-level-tip-dismissed';
    try { tip.hidden = localStorage.getItem(storageKey) === '1'; }
    catch { tip.hidden = false; }
    document.getElementById('filter-tip-dismiss').addEventListener('click', () => {
        tip.hidden = true;
        try { localStorage.setItem(storageKey, '1'); } catch {}
        document.querySelector('.filter-chip[data-filter="all"]').focus({ preventScroll: true });
    });
}

function renderFilteredHazards() {
    document.querySelectorAll('.filter-bar .filter-chip[data-filter]').forEach(chip => {
        const selected = chip.dataset.filter === 'all'
            ? allLevelsActive(_activeLevels) : _activeLevels.has(chip.dataset.filter);
        chip.classList.toggle('is-active', selected);
        chip.setAttribute('aria-pressed', String(selected));
        chip.querySelector('.filter-check').hidden = !selected;
        if (chip.dataset.filter === 'all') {
            chip.title = selected ? 'Hide all hazard levels' : 'Show all hazard levels';
        }
    });
    if (_allHazards === null) return;
    const visible = filterHazards(_allHazards, _activeLevels, _currentFilters);
    renderHazards(visible);
    document.getElementById('hazard-empty-state').hidden = visible.length > 0;
}

/**
 * loadHazards()
 */
async function loadHazards() {
    const version = ++_hazardLoadVersion;
    try {
        const hazards = await fetchHazards();
        if (version !== _hazardLoadVersion) return;
        _allHazards = hazards;
        renderFilteredHazards();
        updateLiveFireCounter(hazards.filter(hazard => hazard.status === 'active').length);
    } catch (err) {
        if (version !== _hazardLoadVersion) return;
        console.error('[App] Failed to load hazards:', err);
        showToast(S.errors.loadFailed, 'error');
    }
}

/**
 * updateLiveFireCounter(count)
 */
function updateLiveFireCounter(count) {
    const counterEl = document.getElementById('live-fire-counter');
    const textEl    = document.getElementById('live-counter-text');
    if (!counterEl || !textEl) return;

    if (count > 0) {
        textEl.textContent = `${count} Live`;
        counterEl.classList.remove('is-hidden');
    } else {
        counterEl.classList.add('is-hidden');
    }
}

/**
 * setupNetworkStatus()
 */
function setupNetworkStatus() {
    const badges = document.querySelectorAll('.offline-badge');
    const update = () => {
        const isOffline = !navigator.onLine;
        badges.forEach(b => {
            if (isOffline) b.classList.add('is-visible');
            else b.classList.remove('is-visible');
        });
        if (isOffline) {
            showToast('Operating in local offline mode.', 'warning');
        }
    };
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
}

/**
 * showToast(message, type)
 */
export function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'is-error' : (type === 'warning' ? 'is-warning' : '')}`;
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(8px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

