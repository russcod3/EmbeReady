'use strict';
const router=require('express').Router();
const rateLimit=require('express-rate-limit');
const service=require('../assessment-service');
router.post('/start',rateLimit({windowMs:60000,max:20,standardHeaders:true,legacyHeaders:false}), (req,res)=>{
 // Loading installs saved mock/legacy results; retry applies only to failed community reports.
 res.status(202).json({success:true,data:service.startAll({retry:req.body?.retry===true})});
});
router.get('/status',(req,res)=>res.json({success:true,data:service.status()}));
module.exports=router;
