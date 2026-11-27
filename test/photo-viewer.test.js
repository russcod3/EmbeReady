'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadFrontend } = require('./frontend-helpers');
const { exports: { escapeHtml } } = loadFrontend('public/js/utils.js',['escapeHtml']);
const { exports: viewer } = loadFrontend('public/js/photo-viewer.js',[
    'boundedPhotoTransform','expandPhotoButton','openPhotoViewer'
],{ escapeHtml, getLanguage:()=> 'en', document:{ createElement(){throw new Error('Invalid photo URL reached the DOM');} } });

test('fitted photos cannot be dragged away; enlarged photos stay inside their real image bounds',()=>{
    assert.deepEqual(JSON.parse(JSON.stringify(viewer.boundedPhotoTransform(1,900,-900,800,450,800,600))),{zoom:1,x:0,y:0});
    const landscape=viewer.boundedPhotoTransform(3,900,-900,800,450,800,600);
    assert.equal(landscape.x,800); assert.equal(landscape.y,-375);
    // A portrait photo still fits horizontally at 2x, so horizontal dragging must stay off.
    const portrait=viewer.boundedPhotoTransform(2,900,900,200,600,800,600);
    assert.equal(portrait.x,0); assert.equal(portrait.y,300);
    assert.equal(viewer.boundedPhotoTransform(99,0,0,800,600,800,600).zoom,5);
    assert.equal(viewer.boundedPhotoTransform(NaN,0,0,800,600,800,600).zoom,1);
});

test('the expand control is keyboard-accessible and escapes the hazard title',()=>{
    const html=viewer.expandPhotoButton('<img onerror="test()">');
    assert.match(html,/<button type="button"/);
    assert.match(html,/aria-label="Expand photo:/);
    assert.match(html,/<svg/);
    assert.doesNotMatch(html,/<img/);
});

test('the viewer rejects remote URLs, traversal, and script URLs before loading anything',()=>{
    for(const src of ['https://example.com/photo.jpg','javascript:alert(1)','/uploads/seed/../private.jpg','//example.com/image.png',null]) {
        assert.doesNotThrow(()=>viewer.openPhotoViewer({src}));
    }
});

test('shared archive images link to the current hazard credit without inventing source locations',()=>{
    const {exports:{illustrativePhotos}}=loadFrontend('public/js/hazard-photo-data.js',['illustrativePhotos']);
    const {exports:{photoCaptionMarkup}}=loadFrontend('public/js/hazard-photo-credits.js',['photoCaptionMarkup'],{illustrativePhotos,escapeHtml});
    const shared=Object.entries(illustrativePhotos).find(([,entry])=>entry.references.length>1);
    assert.ok(shared);
    for(const ref of shared[1].references) assert.ok(photoCaptionMarkup(shared[0],ref).includes('#'+ref));
    assert.match(photoCaptionMarkup(shared[0],shared[1].reference),/Representative illustration/);
    assert.equal(photoCaptionMarkup('/uploads/user/original.png'),'');
});
