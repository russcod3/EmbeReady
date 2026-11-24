// Keep stored provenance intact while avoiding repeated demo labels in the prose.
export function isPreparedAssessment(assessment) {
    return assessment?.engine === 'mock';
}

export function assessmentText(text, prepared = false) {
    const value = String(text || '');
    if (!prepared) return value;
    return value
        .replace(/\bMock (observation|scenario|survey|inventory|inspection|active incident|maintenance log|incident follow-up|report):?\s*/gi, '')
        .replace(/\bFictional (scenario log|scenario observation|incident observation|follow-up maintenance log)(?: at \d\d:\d\d)?:?\s*/gi, '')
        .replace(/\bSynthetic scenario:?\s*/gi, '')
        .replace(/\b(?:linked )?mock incidents\b/gi, 'recorded incidents')
        .replace(/\blinked demo incidents\b/gi, 'recorded incidents')
        .replace(/\bthe demo incident register\b/gi, 'the incident register')
        .replace(/\bfictional (?=inspection|check|fire)/gi, '')
        .replace(/\bThese are synthetic scenario values, not current weather\.?/gi, '')
        .replace(/\bThese are not current weather observations\.?/gi, '')
        .replace(/\bduring the scenario inspection\b/gi, 'during inspection')
        .trim()
        .replace(/^[a-z]/, letter => letter.toUpperCase());
}
