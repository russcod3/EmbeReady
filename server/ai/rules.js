/**
 * server/ai/rules.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Deterministic rule-based fire risk scoring engine.
 * Used as the default when AI_PROVIDER=none, or as a fallback when the LLM
 * API is unavailable.
 *
 * Scoring breakdown (total: 0–100):
 *   ignition_sources    0–15  (category-driven)
 *   fuel_combustibles   0–15  (category + structure)
 *   proximity_people    0–15  (barangay classification + density)
 *   structure_material  0–10  (inferred from category + classification)
 *   truck_access        0–10  (classification-based road access proxy)
 *   fire_history        0–10  (count of nearby incidents in DB)
 *   weather_seasonal    0–10  (Batangas dry season + coastal wind factor)
 *   human_behavior      0–15  (occupation type + informal settlement flag)
 *
 * Score → Level mapping:
 *   0–39  → low
 *   40–64 → moderate
 *   65–100 → heavy
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

// ── Category base scores ──────────────────────────────────────────────────────
// Tuned for Batangas City hazard context
const CATEGORY_PROFILES = {
    faulty_wiring: {
        ignition:   13,
        fuel:        9,
        structure:   7,
        behavior:   10,
        label:      'Faulty / Overloaded Wiring'
    },
    lpg_storage: {
        ignition:   14,
        fuel:       15,
        structure:   6,
        behavior:    8,
        label:      'LPG / Compressed Gas Storage'
    },
    dry_grass: {
        ignition:    9,
        fuel:       14,
        structure:   4,
        behavior:    9,
        label:      'Dry Grass / Cogon / Brush'
    },
    overloaded_outlets: {
        ignition:   12,
        fuel:        8,
        structure:   6,
        behavior:   11,
        label:      'Overloaded Electrical Outlets'
    },
    blocked_exit: {
        ignition:    5,
        fuel:        5,
        structure:   5,
        behavior:   12,
        label:      'Blocked / Obstructed Fire Exit'
    },
    illegal_burning: {
        ignition:   13,
        fuel:       13,
        structure:   3,
        behavior:   13,
        label:      'Illegal / Open Burning'
    },
    informal_settlement: {
        ignition:   10,
        fuel:       11,
        structure:   9,
        behavior:   12,
        label:      'Informal Settlement Congestion'
    },
    flammable_storage: {
        ignition:   11,
        fuel:       14,
        structure:   7,
        behavior:    8,
        label:      'Flammable Material Storage'
    },
    other: {
        ignition:    7,
        fuel:        7,
        structure:   5,
        behavior:    7,
        label:      'Other Hazard'
    }
};

// ── Classification modifiers ──────────────────────────────────────────────────
const CLASSIFICATION_PROFILES = {
    urban: {
        proximity:    13,
        truck_access:  7,
        label:        'Dense urban / Poblacion'
    },
    coastal: {
        proximity:    12,
        truck_access:  5,  // narrow lanes near shoreline
        label:        'Coastal / Shoreline area'
    },
    industrial: {
        proximity:     7,
        truck_access:  9,  // wider roads, industrial gates
        label:        'Industrial zone'
    },
    upland: {
        proximity:     5,
        truck_access:  4,  // difficult terrain
        label:        'Upland / outlying barangay'
    },
    transit: {
        proximity:    14,  // high pedestrian and vehicle density
        truck_access:  8,
        label:        'Transit / Terminal hub'
    }
};

// ── Weather/seasonal score (Batangas context) ─────────────────────────────────
// Dry season (Nov–May) in Batangas: high risk; wet season (Jun–Oct): lower.
// Coastal areas add wind factor year-round.
function getWeatherScore(classification, nowMonth) {
    const isDrySeason = nowMonth >= 11 || nowMonth <= 5;
    const isCoastal   = classification === 'coastal';
    let score = isDrySeason ? 8 : 4;
    if (isCoastal) score = Math.min(score + 2, 10);
    return {
        score,
        max_score: 10,
        reason: isDrySeason
            ? `Dry season (${nowMonth < 6 ? 'Jan–May' : 'Nov–Dec'}). Batangas City experiences severe dryness and high fire weather during this period${isCoastal ? ', compounded by coastal winds' : ''}.`
            : `Wet season reduces spread risk for now, but${isCoastal ? ' coastal winds remain a factor' : ' monitoring is still required'}.`
    };
}

/**
 * scoreHazard(hazard, barangay, historyCount)
 *
 * @param {Object} hazard        – hazard row from DB
 * @param {Object} barangay      – barangay row from DB
 * @param {number} historyCount  – number of past fire incidents at/near this hazard
 * @returns {Object}             – full assessment object
 */
function scoreHazard(hazard, barangay, historyCount = 0) {
    const now   = new Date();
    const month = now.getMonth() + 1; // 1-indexed

    const catProfile   = CATEGORY_PROFILES[hazard.category] || CATEGORY_PROFILES.other;
    const classProfile = CLASSIFICATION_PROFILES[barangay.classification] || CLASSIFICATION_PROFILES.urban;

    // ── Individual factor scores ──────────────────────────────────────────────
    const factors = {
        ignition_sources: {
            score:     catProfile.ignition,
            max_score: 15,
            reason:    buildIgnitionReason(hazard.category, catProfile)
        },
        fuel_combustibles: {
            score:     catProfile.fuel,
            max_score: 15,
            reason:    buildFuelReason(hazard.category, barangay.classification)
        },
        proximity_to_people: {
            score:     classProfile.proximity,
            max_score: 15,
            reason:    `${classProfile.label} — ${hazard.category === 'informal_settlement' ? 'extremely dense population with limited egress' : 'significant surrounding population density'}.`
        },
        structure_material: {
            score:     catProfile.structure,
            max_score: 10,
            reason:    buildStructureReason(hazard.category, barangay.classification)
        },
        truck_access: {
            score:     classProfile.truck_access,
            max_score: 10,
            reason:    buildAccessReason(barangay.classification, classProfile.truck_access)
        },
        fire_history: {
            score:     Math.min(historyCount * 3, 10),
            max_score: 10,
            reason:    historyCount > 0
                ? `${historyCount} documented fire incident(s) recorded at or near this location.`
                : 'No documented prior fire incidents at this specific location.'
        },
        weather_seasonal: getWeatherScore(barangay.classification, month),
        human_behavior: {
            score:     catProfile.behavior,
            max_score: 15,
            reason:    buildBehaviorReason(hazard.category)
        }
    };

    // ── Totals ────────────────────────────────────────────────────────────────
    const overall_score = Object.values(factors).reduce((sum, f) => sum + f.score, 0);
    const assessed_level = overall_score >= 65 ? 'heavy'
                         : overall_score >= 40 ? 'moderate'
                         : 'low';

    const confidence_level = historyCount > 0 ? 'high' : 'medium';

    const reasoning_summary =
        `Rule-based estimate. Overall score: ${overall_score}/100 → ${assessed_level.toUpperCase()} risk. ` +
        `This ${catProfile.label} hazard is located in ${barangay.name} (${classProfile.label}). ` +
        `Key drivers: ${topFactors(factors)}. ` +
        `Confidence: ${confidence_level}. Re-run assessment with AI key for a more nuanced evaluation.`;

    return {
        overall_score,
        assessed_level,
        factors_json:        JSON.stringify(factors),
        confidence_level,
        reasoning_summary,
        engine:              'rule_based',
        model_version:       'rules-v1.0'
    };
}

// ── Reason builders ───────────────────────────────────────────────────────────

function buildIgnitionReason(category, profile) {
    const map = {
        faulty_wiring:       'Faulty wiring is a leading cause of structural fires in Batangas City. Arcing, short circuits, and overheating are persistent ignition risks.',
        lpg_storage:         'Compressed LPG cylinders present direct ignition risk through leaks, valve failure, or improper storage near open flame.',
        dry_grass:           'Dry cogon grass and brush ignite rapidly, especially during Batangas\'s pronounced dry season. Even cigarette butts or cooking sparks can start a fire.',
        overloaded_outlets:  'Overloaded electrical outlets generate sustained heat buildup that can ignite nearby combustibles with no visible warning sign.',
        blocked_exit:        'Blocked exits do not inherently ignite fires but significantly amplify ignition-to-casualty risk by trapping occupants.',
        illegal_burning:     'Deliberate open burning with direct flame contact — highest ignition probability of all categories.',
        informal_settlement: 'Dense informal housing often relies on improvised wiring, open cooking, and candles — multiple simultaneous ignition sources.',
        flammable_storage:   'Stored flammable materials (solvents, fuels, paints) have low flash points and can auto-ignite at ambient Batangas temperatures in enclosed areas.',
        other:               'Specific ignition pathway not classified; moderate baseline risk assumed.'
    };
    return map[category] || map.other;
}

function buildFuelReason(category, classification) {
    const coastal = classification === 'coastal';
    const map = {
        faulty_wiring:       `Residential and commercial structures in Batangas City commonly use wood framing, bamboo partitions, and nipa materials — high fuel load.${coastal ? ' Coastal saltair accelerates wiring degradation.' : ''}`,
        lpg_storage:         'LPG itself is a high-energy fuel. A single 11-kg cylinder at failure can produce a fireball. Multiple cylinders multiply this risk nonlinearly.',
        dry_grass:           'Dried cogon grass has a very high fuel loading per square meter. Fire spread is rapid, especially on upland slopes with wind.',
        overloaded_outlets:  'Adjacent combustibles (furniture, curtains, cardboard) are typically present in Filipino residential and market settings.',
        blocked_exit:        'Fuel load depends on building type. Risk is primarily egress-related rather than fuel-based.',
        illegal_burning:     'Agricultural waste, debris, and surrounding dry brush dramatically increase the available fuel when illegal burning escapes control.',
        informal_settlement: 'Extremely high fuel loading: plywood, plastic sheeting, tarpaulin roofing, and scavenged lumber combine to create a dense, continuous fuel bed.',
        flammable_storage:   'Bulk flammable liquids provide sustained, high-intensity fuel that is difficult to suppress with standard fire extinguishers.',
        other:               'Fuel load is unclassified; moderate baseline risk assumed.'
    };
    return map[category] || map.other;
}

function buildStructureReason(category, classification) {
    const upland = classification === 'upland' || classification === 'coastal';
    const map = {
        faulty_wiring:       'Wiring hazards are highest in mixed-material (wood + concrete) structures common in Batangas City Poblacion — poor wire routing and aging insulation.',
        lpg_storage:         'Risk is structural if cylinders are stored indoors; outdoor storage in a dedicated cage reduces but does not eliminate structural risk.',
        dry_grass:           'Grass fires do not involve built structures directly unless they spread to adjacent buildings.',
        overloaded_outlets:  'Outlets in older reinforced concrete buildings with inadequate circuit breakers present latent structural ignition risk.',
        blocked_exit:        'Most critical in multi-storey and densely partitioned commercial buildings common in Batangas City\'s Poblacion district.',
        illegal_burning:     upland ? 'Upland barangays have fewer fire-resistant structures; spread to adjacent homes is a primary structural concern.' : 'Open burning near mixed-material structures significantly raises spread risk.',
        informal_settlement: 'Typically non-engineered structures: no fire compartmentation, no firebreaks, high material flammability, rapid lateral spread.',
        flammable_storage:   'Warehouses and garages storing flammables often lack fire-rated walls, sprinklers, or adequate ventilation.',
        other:               'Structure type not specifically classified.'
    };
    return map[category] || map.other;
}

function buildAccessReason(classification, score) {
    const map = {
        urban:       score >= 7
            ? 'Main roads in Poblacion are generally accessible, but narrow back alleys and interior courts limit fire truck reach in some blocks.'
            : 'Dense urban grid with narrow residential lanes; some interior areas may be inaccessible to standard BFP apparatus.',
        coastal:     'Coastal barangay lanes are often informal and narrow. Proximity to shoreline may also limit approach angles for fire apparatus.',
        industrial:  'Industrial zones typically have wider access roads and gate infrastructure, improving BFP response access.',
        upland:      'Upland roads are often unpaved or single-lane. Gradient and lack of hydrants limit BFP response effectiveness significantly.',
        transit:     'Major transit corridors have wide primary roads, but terminal interiors and adjacent streets may be congested during peak hours.'
    };
    return map[classification] || 'Access conditions unclassified.';
}

function buildBehaviorReason(category) {
    const map = {
        faulty_wiring:       'Low public awareness of wiring hazards in residential settings. DIY electrical work without permits is common.',
        lpg_storage:         'Improper cylinder storage (indoors, near cooking, stacked horizontally) and reuse of expired cylinders are documented issues.',
        dry_grass:           'Dry season burning of agricultural waste is a recurring behavior in outlying Batangas City barangays despite fire bans.',
        overloaded_outlets:  'Power-strip daisy-chaining, unpermitted sub-metering, and overloaded circuits are widespread in informal and market settings.',
        blocked_exit:        'Exits are frequently obstructed by merchandise, pallets, and furniture in commercial premises — a persistent compliance gap.',
        illegal_burning:     'Seasonal agricultural burning practices and waste disposal by burning remain common in upland and peri-urban areas.',
        informal_settlement: 'High occupancy density, shared cooking spaces, and limited community fire drills increase collective behavioral risk.',
        flammable_storage:   'Improper labeling, inadequate MSDS compliance, and casual handling of flammable goods observed in small commercial settings.',
        other:               'Human behavior risk factor unclassified.'
    };
    return map[category] || map.other;
}

function topFactors(factors) {
    return Object.entries(factors)
        .sort(([, a], [, b]) => (b.score / b.max_score) - (a.score / a.max_score))
        .slice(0, 3)
        .map(([key]) => key.replace(/_/g, ' '))
        .join(', ');
}

// ── Level from reported string ────────────────────────────────────────────────
function scoreFromLevel(level) {
    return { low: 20, moderate: 52, heavy: 78 }[level] || 50;
}

module.exports = { scoreHazard, CATEGORY_PROFILES, scoreFromLevel };
