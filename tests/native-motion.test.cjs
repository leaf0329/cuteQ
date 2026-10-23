'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {source,sample}=require('../src/renderer/motion.js'),{footOffset}=require('../src/main/physics.cjs');
test('the video floor coincides with the native window support point at every pet scale',()=>{
 for(const scale of [1,.42,.1,.01]){
  const bodyWidth=300*scale,height=Math.max(32,360*scale),native=footOffset({width:Math.max(32,bodyWidth),height,bodyWidth});
  const canvas=height-bodyWidth*(1+8/300)+source.floorY/600*bodyWidth;
  assert.ok(Math.abs(native-canvas)<1e-8);
 }
});
