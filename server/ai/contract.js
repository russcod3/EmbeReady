'use strict';
// Prototype prioritisation index, not a calibrated probability or BFP rating.
const VERSION='evidence-v2';
const FACTORS=Object.freeze({
 ignition_sources:{max:20,label:'Ignition',evidence:'Observed sparks, heat, open flames, electrical damage or leaks.'},
 fuel_combustibles:{max:15,label:'Combustible materials',evidence:'Fuel type, quantity, containment and separation from heat.'},
 proximity_to_people:{max:15,label:'People exposed',evidence:'Occupancy, sleeping areas, vulnerability and neighbouring exposure.'},
 structure_material:{max:10,label:'Fire spread',evidence:'Construction, separation, ventilation and spread pathways.'},
 escape_routes:{max:10,label:'Escape routes',evidence:'Available exits, obstructions and evacuation limitations.'},
 truck_access:{max:10,label:'Responder access',evidence:'Observed road width and obstructions; distance does not establish response time.'},
 fire_history:{max:5,label:'Fire history',evidence:'Recorded incidents, causes, severity, dates and relevance. Missing records do not mean no fires.'},
 weather_seasonal:{max:5,label:'Environment',evidence:'Dated observations of weather and vegetation; never infer current weather from the month.'},
 human_behavior:{max:5,label:'Unsafe practices',evidence:'Observed cooking, smoking and maintenance; avoid demographic assumptions.'},
 safeguards:{max:5,label:'Safety measures',evidence:'Observed deficiencies in alarms, suppression, separation and maintenance.'}
});
const PLAN_FIELDS=['before_steps','during_steps','after_steps','evacuation_tips','prohibited_actions'];
const levelFor=n=>n<40?'low':n<65?'moderate':'heavy';
const factorSchema=max=>({type:'object',properties:{score:{type:['integer','null'],minimum:0,maximum:max},max_score:{type:'integer',enum:[max]},reason:{type:'string'},evidence_refs:{type:'array',items:{type:'string'}}},required:['score','max_score','reason','evidence_refs']});
const RESPONSE_SCHEMA={type:'object',properties:{assessment:{type:'object',properties:{overall_score:{type:['integer','null'],minimum:0,maximum:100},assessed_level:{type:['string','null']},confidence_level:{type:'string',enum:['low','medium','high']},reasoning_summary:{type:'string'},action_priority:{type:'string',enum:['immediate','prompt','routine']},missing_information:{type:'array',items:{type:'string'}},factors_json:{type:'object',properties:Object.fromEntries(Object.entries(FACTORS).map(([k,f])=>[k,factorSchema(f.max)])),required:Object.keys(FACTORS)}},required:['overall_score','assessed_level','confidence_level','reasoning_summary','action_priority','missing_information','factors_json']},plan:{type:'object',properties:{...Object.fromEntries(PLAN_FIELDS.map(k=>[k,{type:'array',items:{type:'string'},minItems:2,maxItems:5}])),local_context_notes:{type:'string'}},required:[...PLAN_FIELDS,'local_context_notes']}},required:['assessment','plan']};
// Request evidence judgments before their arithmetic summary.
const {factors_json:factorProperties,...summaryProperties}=RESPONSE_SCHEMA.properties.assessment.properties;
RESPONSE_SCHEMA.properties.assessment.properties={factors_json:factorProperties,...summaryProperties};
module.exports={VERSION,FACTORS,PLAN_FIELDS,RESPONSE_SCHEMA,levelFor};
