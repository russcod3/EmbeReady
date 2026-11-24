'use strict';
const profiles=require('./data/mock-observations.json');
module.exports=function installMockObservations(db){
 const save=db.prepare('INSERT INTO hazard_observations (hazard_id,data_json) VALUES (?,?) ON CONFLICT(hazard_id) DO NOTHING');
 for(const hazard of db.prepare('SELECT id,ref_code FROM hazards WHERE is_demo=1').all()){
  if(profiles[hazard.ref_code])save.run(hazard.id,JSON.stringify(profiles[hazard.ref_code]));
 }
};
