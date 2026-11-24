// Shared level rules for the controls and Leaflet marker visibility.
export const HAZARD_LEVELS = Object.freeze(['live', 'high', 'moderate', 'low']);

export function createActiveLevels() {
    return new Set(HAZARD_LEVELS);
}

export function isLevelActive(activeLevels, level) {
    return level === 'all'
        ? HAZARD_LEVELS.every(item => activeLevels.has(item))
        : activeLevels.has(level);
}

export function toggleLevel(activeLevels, level) {
    if (level === 'all') {
        const allActive = isLevelActive(activeLevels, 'all');
        activeLevels.clear();
        if (!allActive) HAZARD_LEVELS.forEach(item => activeLevels.add(item));
    } else if (HAZARD_LEVELS.includes(level)) {
        if (activeLevels.has(level)) activeLevels.delete(level);
        else activeLevels.add(level);
    }
    return activeLevels;
}

export function resetLevels(activeLevels) {
    activeLevels.clear();
    HAZARD_LEVELS.forEach(level => activeLevels.add(level));
}

export function hazardLevel(hazard) {
    // An active fire belongs only to Live, regardless of its assessed severity.
    if (hazard.status === 'active') return 'live';
    const level = hazard.risk_level || hazard.assessed_level || hazard.reported_level;
    return level === 'heavy' ? 'high' : level;
}

export function filterHazards(hazards, activeLevels, filters = {}) {
    return hazards.filter(hazard => {
        const level = hazardLevel(hazard);
        // Unclassified reports stay visible with All; never invent a risk band.
        const levelVisible = HAZARD_LEVELS.includes(level)
            ? activeLevels.has(level)
            : isLevelActive(activeLevels, 'all');
        return levelVisible
            && (!filters.barangay_id || String(hazard.barangay_id) === String(filters.barangay_id))
            && (!filters.category || hazard.category === filters.category);
    });
}
