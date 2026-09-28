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
import { fetchHazards, startLivePolling } from './api.js';
import { search, QUICK_JUMPS, formatLabel } from './search.js';
import { initMap, renderHazards, flyTo, highlightLocation, resetView, invalidateSize } from './map.js';
import { initDrawer, openDrawer, closeDrawer } from './drawer.js';
import { initReportForm, refreshMiniMap } from './report.js';

// State
let _currentView = 'landing'; // 'landing' | 'map'
let _currentFilters = {
    risk_level: '',
    status: '',
    category: '',
    barangay_id: ''
};
let _allHazards = [];

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    // 1. Initialize Map & Detail Drawer
    initMap('map', (hazardId) => {
        openDrawer(hazardId);
    });
    initDrawer();

    // 2. Initialize Report Form
    initReportForm(async (newHazardId) => {
        showToast('Report received! AI assessment generated.', 'success');
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

    // 6. Setup Filters
    setupFilters();

    // 7. Setup Live Polling (every 30 seconds)
    startLivePolling((activeFires) => {
        updateLiveFireCounter(activeFires.length);
        // If live filter is active or count changed, refresh markers
        if (_currentFilters.status === 'active') {
            renderHazards(activeFires);
        }
    });

    // 8. Offline status detector
    setupNetworkStatus();

    // 9. Initial hazard fetch
    loadHazards();
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
        invalidateSize();
    } else {
        closeDrawer();
        mapView.classList.remove('is-active');
        landingView.classList.add('is-active');
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
            resetView();
        });
    }

    // Header logo click -> back to landing
    const mapWordmark = document.getElementById('map-wordmark');
    if (mapWordmark) {
        mapWordmark.addEventListener('click', () => {
            switchView('landing');
        });
    }

    // Live counter badge click -> filter to active fires
    const liveCounter = document.getElementById('live-fire-counter');
    if (liveCounter) {
        liveCounter.addEventListener('click', () => {
            switchView('map');
            setActiveFilterChip('active');
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
}

function scrollToReport() {
    const reportSection = document.getElementById('report-section');
    if (reportSection) {
        reportSection.scrollIntoView({ behavior: 'smooth' });
        setTimeout(() => refreshMiniMap(), 400);
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
            <span class="item-type">${r.source === 'local' ? 'OFFLINE' : (r.type || 'PLACE')}</span>
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
    highlightLocation(lat, lng, label);
    showToast(`Jumped to ${label}`, 'info');
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
 * setupFilters()
 */
function setupFilters() {
    // Filter chips (All, Live Now, Low, Moderate, Heavy)
    const chips = document.querySelectorAll('.filter-bar .filter-chip');
    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            chips.forEach(c => c.classList.remove('is-active'));
            chip.classList.add('is-active');

            const filterType = chip.getAttribute('data-filter');
            if (filterType === 'all') {
                _currentFilters.risk_level = '';
                _currentFilters.status = '';
            } else if (filterType === 'active') {
                _currentFilters.risk_level = '';
                _currentFilters.status = 'active';
            } else {
                _currentFilters.risk_level = filterType;
                _currentFilters.status = '';
            }

            loadHazards();
        });
    });

    // Select dropdowns
    const bgySelect = document.getElementById('filter-barangay-select');
    if (bgySelect) {
        bgySelect.addEventListener('change', () => {
            _currentFilters.barangay_id = bgySelect.value;
            loadHazards();
        });
    }

    const catSelect = document.getElementById('filter-category-select');
    if (catSelect) {
        catSelect.addEventListener('change', () => {
            _currentFilters.category = catSelect.value;
            loadHazards();
        });
    }

    const resetBtn = document.getElementById('filter-reset-btn');
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            _currentFilters = { risk_level: '', status: '', category: '', barangay_id: '' };
            if (bgySelect) bgySelect.value = '';
            if (catSelect) catSelect.value = '';
            chips.forEach(c => c.classList.remove('is-active'));
            const allChip = document.querySelector('.filter-chip[data-filter="all"]');
            if (allChip) allChip.classList.add('is-active');
            loadHazards();
        });
    }
}

function setActiveFilterChip(filterType) {
    const chips = document.querySelectorAll('.filter-bar .filter-chip');
    chips.forEach(c => {
        if (c.getAttribute('data-filter') === filterType) {
            c.classList.add('is-active');
        } else {
            c.classList.remove('is-active');
        }
    });
    if (filterType === 'active') {
        _currentFilters.risk_level = '';
        _currentFilters.status = 'active';
        loadHazards();
    }
}

/**
 * loadHazards()
 */
async function loadHazards() {
    try {
        const hazards = await fetchHazards(_currentFilters);
        _allHazards = hazards;
        const { total, active } = renderHazards(hazards);
        updateLiveFireCounter(active);
    } catch (err) {
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
        textEl.textContent = count === 1 ? '1 ACTIVE FIRE' : `${count} ACTIVE FIRES`;
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

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function escapeAttr(str) {
    if (!str) return '';
    return String(str).replace(/"/g, '&quot;');
}
