'use strict';
require('dotenv').config();
const service=require('./assessment-service');
(async()=>{
 console.log('[reassess] Retrying failed community reports; saved demo and successful Gemini results are preserved.');
 service.startAll({retry:true});await service.waitForIdle();
 const progress=service.status();console.log(JSON.stringify(progress,null,2));
 if(progress.unavailable)process.exitCode=1;
})().catch(error=>{console.error('[reassess]',error.message);process.exitCode=1;});
