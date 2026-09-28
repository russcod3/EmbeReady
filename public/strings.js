/**
 * public/strings.js
 * ─────────────────────────────────────────────────────────────────────────────
 * All user-facing UI strings for EmbeReady.
 * Centralized here so a Filipino (FIL) translation can be added later
 * without touching any other JS or HTML file.
 *
 * Usage (app.js):
 *   import S from './strings.js';
 *   element.textContent = S.landing.title;
 *
 * To add Filipino:
 *   1. Add a FIL_STRINGS object below with the same key structure.
 *   2. Export a getStrings(lang) function that returns EN or FIL.
 *   3. Call getStrings(currentLang) in app.js and re-render UI.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const EN_STRINGS = {

    // ── App identity ─────────────────────────────────────────────────────────
    app: {
        name:           'EmbeReady',
        tagline:        'Community Fire Hazard & Risk Map',
        city:           'Batangas City, Batangas, Philippines',
        coords:         '13.7565°N  121.0583°E',
        demoBadge:      'DEMO DATA',
        liveBadge:      'LIVE',
        aiLabel:        'AI-generated',
        ruleLabel:      'Rule-based estimate'
    },

    // ── Landing / Search ──────────────────────────────────────────────────────
    landing: {
        eyebrow:        'Batangas City Fire Hazard Watch',
        title:          'Find fire hazards\nin your area.',
        subtitle:       'Search a barangay, street, or landmark in Batangas City to load the community hazard map.',
        inputPlaceholder: 'Search barangay, street, landmark…',
        searchBtn:      'Search',
        quickLabel:     'Quick jump:',
        exploreBtn:     'View full city map',
        outOfBoundsMsg: 'EmbeReady currently covers Batangas City only.',
        noResultsMsg:   'No results found. Try a barangay name or landmark.',
        offlineFallback:'Network unavailable — searching local database.',
    },

    // ── Map & filters ─────────────────────────────────────────────────────────
    map: {
        legendTitle:    'Risk Level',
        low:            'Low',
        moderate:       'Moderate',
        heavy:          'Heavy / Active',
        filterAll:      'All',
        filterLive:     'Live Now',
        liveCounter:    (n) => n === 1 ? '1 active fire' : `${n} active fires`,
        liveTimerLabel: 'Started',
        minutesAgo:     (m) => `${m}m ago`,
        hoursAgo:       (h) => `${h}h ago`,
        loadingMarkers: 'Loading hazards…',
        noHazards:      'No hazards match the current filters.',
        filterPanel:    'Filter hazards',
        filterLevel:    'Risk level',
        filterCategory: 'Category',
        filterBarangay: 'Barangay',
        filterStatus:   'Status',
        resetFilters:   'Clear filters',
        applyFilters:   'Apply',
    },

    // ── Detail drawer ─────────────────────────────────────────────────────────
    drawer: {
        closeBtn:       'Close',
        reportedLevel:  'Reported level',
        assessedLevel:  'AI-assessed level',
        statusLabel:    'Status',
        barangayLabel:  'Barangay',
        addressLabel:   'Address',
        categoryLabel:  'Hazard type',
        descLabel:      'Description',
        photoAlt:       'Hazard site photo',
        photoSlot:      'NO PHOTO RECORDED — FIELD SLOT OPEN',
        historyTitle:   'Fire history at this location',
        noHistory:      'No recorded fire incidents at this site.',
        aiSectionTitle: 'Risk Assessment',
        planTitle:      'Preparedness Plan',
        tabBefore:      'Before',
        tabDuring:      'During',
        tabAfter:       'After',
        tabEvacuation:  'Evacuation',
        tabProhibited:  'What NOT to do',
        contactsTitle:  'Emergency Contacts',
        callBtn:        (name) => `Call ${name}`,
        placeholderWarn:'Number not yet configured — edit server/contacts.json',
        confidenceHigh: 'High confidence',
        confidenceMed:  'Medium confidence',
        confidenceLow:  'Low confidence',
        scoreLabel:     'Risk score',
        factorScore:    (score, max) => `${score} / ${max}`,
        engineAI:       'AI-generated assessment',
        engineRule:     'Rule-based estimate',
    },

    // ── Report form ───────────────────────────────────────────────────────────
    report: {
        sectionTitle:   'Report a Hazard or Risk',
        sectionSub:     'All reports appear on the map after submission. No login required.',
        titleLabel:     'Hazard title',
        titlePlaceholder: 'Brief description of the hazard',
        categoryLabel:  'Hazard type',
        levelLabel:     'Risk level',
        statusLabel:    'Reporting status',
        statusPotential:'Potential hazard (not currently on fire)',
        statusActive:   'Active fire or emergency right now',
        locationLabel:  'Location',
        addressLabel:   'Address / street / landmark',
        addressPlaceholder: 'e.g. Near the market, along Rizal Ave',
        barangayLabel:  'Barangay',
        barangayDefault:'Select a barangay',
        pinInstructions:'Click the map to drop a pin, or drag the pin to the exact location.',
        descLabel:      'Description',
        descPlaceholder:'Describe what you observed. Include any details that help BFP respond.',
        photoLabel:     'Photo (optional)',
        photoHint:      'JPG, PNG, or WebP — max 5 MB',
        submitBtn:      'Submit Report',
        submitting:     'Submitting…',
        errorTitle:     'Please correct the following:',
        successTitle:   'Report Submitted',
        refLabel:       'Reference number',
        aiResultTitle:  'AI Risk Assessment',
        actionPrompt:   'What would you like to do next?',
        actionBFP:      'Report to BFP Batangas City',
        actionBarangay: 'Report to Barangay Hall',
        actionDone:     'Done',
        smsPrefix:      'EmbeReady Report',
        smsDivider:     '—',
        closeModal:     'Close',
    },

    // ── Category labels ───────────────────────────────────────────────────────
    categories: {
        faulty_wiring:       'Faulty / Overloaded Wiring',
        lpg_storage:         'LPG / Gas Storage',
        dry_grass:           'Dry Grass / Brush',
        overloaded_outlets:  'Overloaded Electrical Outlets',
        blocked_exit:        'Blocked Fire Exit',
        illegal_burning:     'Illegal / Open Burning',
        informal_settlement: 'Informal Settlement',
        flammable_storage:   'Flammable Material Storage',
        other:               'Other'
    },

    // ── Status labels ─────────────────────────────────────────────────────────
    statuses: {
        potential:  'Potential Hazard',
        active:     'Active Fire',
        contained:  'Contained',
        resolved:   'Resolved'
    },

    // ── Error messages ────────────────────────────────────────────────────────
    errors: {
        networkError:   'Unable to connect to the server. Check your connection.',
        serverError:    'Server error. Please try again.',
        loadFailed:     'Failed to load hazard data.',
        uploadError:    'Photo upload failed. Please try again.',
        rateLimited:    'Too many reports from this device. Please wait 15 minutes.',
    }
};

// ── Exports ───────────────────────────────────────────────────────────────────
// Default export is English. When FIL is added, update this function.
function getStrings(lang = 'en') {
    // Future: if (lang === 'fil') return FIL_STRINGS;
    return EN_STRINGS;
}

// Current language (set from app.js, persisted in localStorage)
let _currentLang = localStorage.getItem('embeready-lang') || 'en';
export const S  = getStrings(_currentLang);
export default S;
export { getStrings };
