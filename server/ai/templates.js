/**
 * server/ai/templates.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Batangas City–specific preparedness plan templates.
 * Organized by hazard category. All plans reference local context:
 *   – BFP Batangas City
 *   – Barangay Hall / Tanod
 *   – National Emergency Hotline 911
 *   – Nearest evacuation areas in the city
 *
 * Plans include safety constraints:
 *   – Active fires always: "Call 911 / BFP first"
 *   – Never advise fighting large fires
 *   – Never advise re-entering a burning structure
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const PLANS = {

    faulty_wiring: {
        before: [
            'Have all electrical wiring inspected by a licensed electrician at least once every two years.',
            'Replace aluminum or knob-and-tube wiring. Ensure wire gauge matches circuit load.',
            'Install properly rated circuit breakers for each circuit; never replace a breaker with one of higher amperage without professional advice.',
            'Avoid running extension cords under rugs or through walls. Use only UL/PS-listed extension cords.',
            'Keep a working dry-chemical ABC fire extinguisher on every floor and in the kitchen.',
            'Install smoke detectors (9V battery or wired) in every sleeping area and hallway. Test monthly.',
            'Coordinate with your Barangay Hall / Tanod for community fire-safety awareness activities.'
        ],
        during: [
            '⚠️ ACTIVE FIRE — Call 911 and BFP Batangas City Fire Station FIRST. Do not delay.',
            'If wiring is sparking or smoldering and the panel is accessible SAFELY, turn off the main breaker.',
            'Do NOT use water on electrical fires — use a dry-chemical (Class C/ABC) extinguisher only.',
            'Evacuate all occupants immediately. Close doors to slow fire spread — do NOT lock them.',
            'Alert neighbors in adjacent units or structures.',
            'Wait for BFP outside. Do NOT re-enter the building.'
        ],
        after: [
            'Do not restore power until a licensed electrician and BFP inspector have cleared the premises.',
            'Document damage with photos for insurance and reporting purposes.',
            'Report the incident to your Barangay Hall and BFP Batangas City for their records.',
            'Arrange temporary shelter through your Barangay Hall or DSWD if the structure is uninhabitable.'
        ],
        evacuation_tips: [
            'Nearest evacuation assembly points are typically at the Barangay Hall, covered court, or school gymnasium — confirm with your Barangay Captain.',
            'Batangas City Social Welfare and Development Office (CSWDO) coordinates shelter and relief.',
            'Keep important documents (land title, ID, passbooks) in a waterproof, grab-and-go bag near the exit.',
            'Designate a meeting point outside for all household members.'
        ],
        prohibited_actions: [
            '🚫 Do NOT re-enter a burning or smoke-filled building for any reason.',
            '🚫 Do NOT use water or a wet cloth to douse electrical fire sources.',
            '🚫 Do NOT attempt to fight a large electrical fire yourself — call BFP.',
            '🚫 Do NOT restore power without a licensed electrician\'s clearance.'
        ],
        local_context: 'Many structures in Batangas City\'s Poblacion barangays are older mixed-material buildings (wood + hollow blocks) where DIY wiring without permits is common. BFP Batangas City has jurisdiction over all urban barangays. Tanod patrol schedules are set by the Barangay Captain.'
    },

    lpg_storage: {
        before: [
            'Store LPG cylinders only in well-ventilated, outdoor, or semi-enclosed areas away from heat sources, cooking flames, and direct sunlight.',
            'Keep cylinders in an upright position, secured against tipping.',
            'Inspect hoses and regulators monthly for cracks, kinks, or odors. Replace every 5 years or as damaged.',
            'Store no more cylinders than operationally required. Do not stockpile indoors.',
            'Keep a CO/gas detector near LPG storage and cooking areas.',
            'Ensure all occupants know the location of the main LPG valve and how to shut it off.',
            'Avoid storing cylinders near exits — in an emergency, they become blocked escape routes.'
        ],
        during: [
            '⚠️ FIRE NEAR LPG — Call 911 and BFP Batangas City IMMEDIATELY. LPG fires may escalate rapidly to BLEVE (Boiling Liquid Expanding Vapor Explosion).',
            'If safe to do so WITHOUT approaching fire, shut off the LPG valve at the cylinder.',
            'Evacuate everyone from the building and all structures within 50 meters.',
            'Keep bystanders at least 100 meters away if fire is touching a cylinder.',
            'Do NOT move a cylinder that is already on fire or extremely hot.',
            'Alert BFP/911 to the presence and location of LPG cylinders when you call.'
        ],
        after: [
            'Do not reoccupy until BFP declares the area safe and all cylinders have been inspected.',
            'Report damaged or used cylinders to your LPG distributor for proper disposal.',
            'File an incident report with BFP Batangas City and your Barangay Hall.',
            'Have the premise inspected before resuming LPG use.'
        ],
        evacuation_tips: [
            'In the event of LPG fire or explosion, move upwind and uphill if possible.',
            'Do not return to the area until BFP gives the all-clear.',
            'Barangay tanod will assist in crowd control and access restriction.'
        ],
        prohibited_actions: [
            '🚫 Do NOT attempt to extinguish an LPG fire yourself unless it is very small and the gas supply can be immediately shut off.',
            '🚫 Do NOT move a burning or overheated cylinder.',
            '🚫 Do NOT use a mobile phone or create sparks within the immediate area of an LPG leak.',
            '🚫 Do NOT re-enter the evacuation zone until BFP grants clearance.'
        ],
        local_context: 'LPG is the primary cooking fuel for most Batangas City households. Informal refilling stations and cylinder swapping near market areas (Pallocan, Poblacion) have been noted as areas of concern. BFP Batangas City conducts periodic fire safety inspections of commercial establishments.'
    },

    dry_grass: {
        before: [
            'Clear dry cogon grass and brush within at least 10 meters of structures before and during the dry season (November–May).',
            'Create a cleared firebreak between upland grassland and the nearest residential structure.',
            'Never burn agricultural waste during dry season or when fire bans are in effect. Coordinate with your Barangay Captain for proper waste disposal.',
            'Report any signs of unattended burning immediately to your Barangay Tanod.',
            'Install smoke detectors in structures adjacent to brushland.'
        ],
        during: [
            '⚠️ GRASS FIRE — Call 911 and BFP Batangas City if the fire is near structures or spreading rapidly.',
            'Alert your Barangay Tanod to mobilize the community fire brigade if one exists.',
            'Evacuate people and animals downwind from the fire.',
            'If trained, community members may use wet burlap bags (barena) on small edge fires, but only if safe to do so.',
            'Close all windows and doors of nearby structures to reduce ember intrusion.'
        ],
        after: [
            'Inspect for hotspots and smoldering root systems — these can reignite 24–48 hours later.',
            'Keep the area wet for 12–24 hours post-suppression.',
            'Report burned area extent to the Barangay and DOST/DENR if it affects protected slopes.'
        ],
        evacuation_tips: [
            'Evacuate perpendicular to wind direction. Do NOT run directly away from fire in the same wind direction.',
            'If caught in a grassland fire, seek the lowest point (ditch, road shoulder) and lie flat, covering the head.',
            'Barangay Hall coordinates evacuation to the nearest school gymnasium or covered court.'
        ],
        prohibited_actions: [
            '🚫 Do NOT burn dry grass or farm waste during fire bans or dry season without Barangay clearance.',
            '🚫 Do NOT attempt to outrun a grass fire uphill — fire moves faster uphill.',
            '🚫 Do NOT leave campfires or cooking fires unattended in upland areas.'
        ],
        local_context: 'Upland barangays (Sorosoro Ibaba, Tinga Labac, Dumantay) experience the most severe dry-season grass fire risk in Batangas City. DOST-PAGASA issues regional fire weather forecasts; Batangas City DRRMO monitors fire-weather conditions.'
    },

    overloaded_outlets: {
        before: [
            'Avoid connecting more than two high-load appliances to a single outlet or power strip.',
            'Replace multi-socket power strips that lack individual breakers or surge protection.',
            'Have an electrician assess household electrical load vs. circuit capacity.',
            'Do not daisy-chain power strips (connecting one to another).',
            'Unplug high-draw appliances (electric fan, iron, rice cooker) when not in use.',
            'Use PS-marked (Philippine Standard) plugs and outlets only.'
        ],
        during: [
            '⚠️ If an outlet is sparking, smoking, or burning — Call 911 / BFP first.',
            'If the outlet is accessible safely, unplug all devices from that circuit.',
            'Turn off the circuit breaker for that room or the main breaker if safe.',
            'Use a dry ABC fire extinguisher if flames are present. Do NOT use water.',
            'Evacuate the area and alert occupants.'
        ],
        after: [
            'Do not restore power to the affected circuit until an electrician inspects it.',
            'Replace damaged outlets, plugs, and power strips.',
            'Report to Barangay Hall if the fire spread or caused structural damage.'
        ],
        evacuation_tips: [
            'Keep an accessible, clear path to the main exit at all times.',
            'Practice a household evacuation drill at least twice a year with all members.'
        ],
        prohibited_actions: [
            '🚫 Do NOT attempt to repair outlets yourself without proper training.',
            '🚫 Do NOT use water on electrical outlet fires.',
            '🚫 Do NOT return to a burned area without BFP clearance.'
        ],
        local_context: 'Sub-metering arrangements and shared electrical connections are common in Batangas City\'s dense Poblacion residential blocks and boarding houses near schools. MERALCO and municipal inspectors periodically check compliance.'
    },

    blocked_exit: {
        before: [
            'Keep all fire exit corridors and doors completely clear of merchandise, pallets, furniture, and personal property at all times.',
            'Comply with BFP fire exit signage requirements. Fire exits must be clearly marked and illuminated.',
            'Conduct a monthly self-inspection walk-through of all exit routes.',
            'Train all staff and occupants on the location and use of every exit.',
            'Install emergency battery-backed exit lighting above all designated fire doors.',
            'Submit your fire safety plan to BFP Batangas City and ensure your fire safety certificate is current.'
        ],
        during: [
            '⚠️ FIRE WITH BLOCKED EXITS — Call 911 / BFP IMMEDIATELY. Blocked exits in a fire are a life-safety emergency.',
            'Use the nearest UNBLOCKED exit. Do not attempt to force through blocked routes.',
            'If smoke is thick, crouch low and feel doors for heat before opening.',
            'If all exits are blocked, signal from a window and seal door gaps with cloth to slow smoke entry.',
            'Alert BFP to the blocked exit location and the number of occupants trapped.'
        ],
        after: [
            'Immediately remove all obstructions from exits before resuming business.',
            'File a fire safety compliance report with BFP Batangas City.',
            'Train staff on exit accessibility policy.'
        ],
        evacuation_tips: [
            'Pre-identify and post a floor plan showing ALL exits in every room.',
            'Practice evacuation drills regularly. The Batangas City DRRMO can assist with drill facilitation.'
        ],
        prohibited_actions: [
            '🚫 Do NOT lock fire exit doors from the inside during business hours.',
            '🚫 Do NOT use fire exits as storage even temporarily.',
            '🚫 Do NOT delay calling BFP if you discover a blocked exit during an active fire.'
        ],
        local_context: 'BFP Batangas City regularly conducts fire safety inspections of commercial establishments. Non-compliance with fire exit regulations is a common finding in market stalls, commercial buildings, and boarding houses across Batangas City.'
    },

    illegal_burning: {
        before: [
            'Do NOT burn household waste, agricultural residue, or any materials in areas near residential structures or dry vegetation.',
            'Coordinate with your Barangay Captain for a community solid waste collection schedule.',
            'Report any observed illegal burning to your Barangay Tanod immediately.',
            'Clear dried vegetation around structures before the dry season rather than burning it.',
            'If agricultural burning is unavoidable, secure a permit from DOST/DENR and conduct burning only during the early morning with a full suppression setup on standby.'
        ],
        during: [
            '⚠️ ILLEGAL BURNING SPREADING — Call 911 / BFP Batangas City immediately if fire is spreading beyond control.',
            'Evacuate people in the path of smoke and fire, particularly children, the elderly, and those with respiratory conditions.',
            'Alert the Barangay Tanod to respond and contain the area.',
            'Do NOT inhale smoke from agricultural or waste fires — burning plastics and treated wood release toxic fumes.'
        ],
        after: [
            'Do not leave a fire site unattended until all embers are completely cold.',
            'Report the incident to Barangay Hall for documentation and incident mapping.',
            'If the burning caused spread or damage, file a report with BFP Batangas City.'
        ],
        evacuation_tips: [
            'Move upwind and away from smoke.',
            'Seek temporary shelter at the Barangay Hall or nearest school if smoke is heavy.'
        ],
        prohibited_actions: [
            '🚫 Do NOT burn waste within 50 meters of any structure or during dry season without a valid permit.',
            '🚫 Do NOT burn plastic, rubber, electronics, or treated lumber — these release toxic pollutants.',
            '🚫 Do NOT leave a burning pile unattended for any reason.'
        ],
        local_context: 'Illegal waste burning is a recurring enforcement challenge in Batangas City\'s upland barangays (Sorosoro Ibaba, Tinga Labac, Dumantay). The Batangas City Environment and Natural Resources Office (CENRO) and DRRMO coordinate fire prevention campaigns in these areas before each dry season.'
    },

    informal_settlement: {
        before: [
            'Work with your Barangay Captain to map the community\'s internal pathways and identify 2–3 clear evacuation routes.',
            'Form a community fire brigade with trained volunteers and basic fire-fighting equipment (fire buckets, extinguishers).',
            'Install working smoke detectors — battery-powered units are practical and affordable.',
            'Avoid open cooking inside enclosed structures; designate a safe outdoor cooking area.',
            'Maintain at least 1–2 meters of clear space between structures where possible.',
            'Keep water drums or large containers filled as emergency suppression reserves.'
        ],
        during: [
            '⚠️ FIRE IN INFORMAL SETTLEMENT — Call 911 / BFP immediately. Fires in dense informal settlements spread extremely fast.',
            'Alert all neighbors by shouting or ringing any available alarm (bell, horn).',
            'Evacuate immediately. Do not attempt to retrieve property first.',
            'Guide children, elderly, and PWDs to the nearest clear evacuation route.',
            'Point BFP arriving units to the main access lane when they arrive.'
        ],
        after: [
            'Register with your Barangay for emergency relief (food, shelter, livelihood assistance).',
            'Contact DSWD Batangas City for displaced family assistance.',
            'Coordinate with DRRMO for shelter assessment.',
            'Do not re-occupy damaged structures without structural inspection.'
        ],
        evacuation_tips: [
            'Barangay evacuation centers are typically at covered courts, schools, or Barangay Halls.',
            'Identify your nearest evacuation center before an emergency. Register your household with the Barangay.',
            'Keep all documents (IDs, birth certificates, land/lease records) in a single waterproof bag ready at the door.'
        ],
        prohibited_actions: [
            '🚫 Do NOT re-enter a fire-damaged informal structure — structural instability is a serious risk.',
            '🚫 Do NOT use open flame inside enclosed nipa or tarpaulin structures.',
            '🚫 Do NOT attempt to fight a large settlement fire yourself — the risk to the firefighter is extreme.'
        ],
        local_context: 'Coastal informal settlements in Wawa, Santa Clara, and adjacent areas near Batangas Port are identified as high-priority fire risk zones by BFP Batangas City. Barangay DRRM committees are mandated to conduct annual community fire drills.'
    },

    flammable_storage: {
        before: [
            'Store all flammable liquids (fuels, solvents, paints) in approved, sealed metal containers away from ignition sources.',
            'Ensure the storage area has adequate ventilation to prevent vapor buildup.',
            'Post NO SMOKING and NO OPEN FLAME signage in all flammable storage areas.',
            'Keep a Class B/C or ABC fire extinguisher within 5 meters of the storage area.',
            'Maintain a material inventory. Dispose of empty containers safely.',
            'Register your flammable storage facility with BFP Batangas City for Fire Safety Inspection.'
        ],
        during: [
            '⚠️ FLAMMABLE MATERIAL FIRE — Call 911 / BFP Batangas City IMMEDIATELY.',
            'Evacuate all personnel. Shut off ignition sources if safe to do so.',
            'Do NOT use water on flammable liquid fires — use foam, CO₂, or dry-chemical extinguisher.',
            'Alert BFP to the type and quantity of materials when you call.',
            'Evacuate to at least 50 meters upwind of the facility.'
        ],
        after: [
            'Do not reopen the facility until BFP and DOLE/DENR inspectors clear the site.',
            'Dispose of contaminated soil and materials through DENR-accredited hazardous waste handlers.',
            'Review and update your Emergency Response Plan with BFP.'
        ],
        evacuation_tips: [
            'Establish a muster point at least 100 meters upwind of flammable storage facilities.',
            'Provide BFP with your site Material Safety Data Sheets (MSDS) as soon as they arrive.'
        ],
        prohibited_actions: [
            '🚫 Do NOT use water on a flammable liquid fire — water can spread burning fuel.',
            '🚫 Do NOT re-enter a storage area with visible vapor until ventilated and cleared.',
            '🚫 Do NOT store flammable liquids in unmarked plastic containers or near electrical panels.'
        ],
        local_context: 'Industrial and port-adjacent areas in Batangas City (Tabangao, Ilijan, Santa Clara) have the highest concentration of bulk flammable storage. BFP Batangas City coordinates with the Port Authority and industrial estate management for fire safety compliance.'
    },

    other: {
        before: [
            'Conduct a fire safety audit of the specific hazard location with BFP Batangas City.',
            'Install appropriate fire detection and suppression equipment as advised by BFP.',
            'Create and share an emergency evacuation plan with all occupants.',
            'Keep emergency contacts posted in a visible location.',
            'Train at least one household or workplace member in basic fire safety.'
        ],
        during: [
            '⚠️ In any fire emergency, Call 911 / BFP Batangas City FIRST.',
            'Evacuate all persons from the affected area immediately.',
            'Alert neighbors and passersby.',
            'Meet BFP units at the scene access point to guide them.'
        ],
        after: [
            'File an incident report with BFP Batangas City and your Barangay Hall.',
            'Seek shelter and assistance through your Barangay Captain if displaced.',
            'Have the site inspected before returning.'
        ],
        evacuation_tips: [
            'Know your nearest barangay evacuation center.',
            'Keep a grab-and-go bag with essential documents and supplies.'
        ],
        prohibited_actions: [
            '🚫 Do NOT re-enter fire-damaged structures without BFP clearance.',
            '🚫 Do NOT delay calling 911 or BFP when a fire is visible or smoke is present.'
        ],
        local_context: 'BFP Batangas City is the primary fire response authority. The national emergency hotline 911 connects directly to dispatch. Barangay Hall and Tanod are first-responder coordinators at the community level.'
    }
};

/**
 * getPlan(category)
 * Returns the preparedness plan object for a given category.
 * Falls back to 'other' if the category is not found.
 */
function getPlan(category, barangayName = '') {
    const plan = PLANS[category] || PLANS.other;
    return {
        before_steps_json:       JSON.stringify(plan.before),
        during_steps_json:       JSON.stringify(plan.during),
        after_steps_json:        JSON.stringify(plan.after),
        evacuation_tips_json:    JSON.stringify(plan.evacuation_tips),
        prohibited_actions_json: JSON.stringify(plan.prohibited_actions),
        local_context_notes:     barangayName
            ? `${plan.local_context} Jurisdiction: ${barangayName}.`
            : plan.local_context
    };
}

module.exports = { getPlan, PLANS };
