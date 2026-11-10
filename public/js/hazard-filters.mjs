// Leaflet uses "heavy" for High and status="active" for Live.
export const HAZARD_LEVELS = Object.freeze(['live', 'high', 'moderate', 'low']);

export function allLevelsActive(activeLevels) {
    return HAZARD_LEVELS.every(level => activeLevels.has(level));
}

export function toggleLevel(activeLevels, level) {
    if (level === 'all') {
        return new Set(allLevelsActive(activeLevels) ? [] : HAZARD_LEVELS);
    }
    const next = new Set(activeLevels);
    if (HAZARD_LEVELS.includes(level)) {
        if (next.has(level)) next.delete(level);
        else next.add(level);
    }
    return next;
}

export function filterHazards(hazards, activeLevels, filters = {}) {
    return hazards.filter(hazard => {
        const level = hazard.status === 'active' ? 'live'
            : hazard.risk_level === 'heavy' ? 'high' : hazard.risk_level;
        // Unclassified reports stay visible only with all levels enabled.
        const levelMatches = level ? activeLevels.has(level) : allLevelsActive(activeLevels);
        return levelMatches
            && (!filters.barangay_id || String(hazard.barangay_id) === String(filters.barangay_id))
            && (!filters.category || hazard.category === filters.category);
    });
}
