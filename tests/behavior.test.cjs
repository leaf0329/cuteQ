'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {Companion}=require('../src/main/behavior.cjs');
const {clips}=require('../src/renderer/motion.js');
const duration=name=>clips[name].times.reduce((a,b)=>a+b,0);
function setup(){let time=100000;return {brain:new Companion({now:()=>time,random:()=>0}),advance:n=>time+=n};}
test('dragging cannot be interrupted by random or lower priority actions',()=>{const {brain,advance}=setup();brain.interact('drag');assert.equal(brain.play('hungry','',1000,5),false);advance(1000);brain.tick();assert.equal(brain.action,'drag');brain.interact('drop');assert.equal(brain.action,'protest');});
test('focus suppresses wandering and completes once at its deadline',()=>{const {brain,advance}=setup();brain.setMode('focus',1);advance(50000);brain.tick();assert.equal(brain.canWander(),false);advance(10001);brain.tick();assert.equal(brain.action,'stretch');assert.equal(brain.focusCount,1);advance(100000);brain.tick();assert.equal(brain.focusCount,1);});
test('system idle sleeps and user return completes the drawn wake before idle',()=>{const {brain,advance}=setup();brain.context({idleSeconds:200});assert.equal(brain.action,'sleep');assert.equal(brain.canWander(),false);advance(1000);brain.context({idleSeconds:0});assert.equal(brain.action,'wake');assert.equal(brain.away,false);assert.equal(brain.canWander(),false);advance(duration('wake')+1);brain.tick();assert.equal(brain.action,'idle');});
test('quiet mode and full screen do not initiate context chatter',()=>{const {brain,advance}=setup();brain.setMode('quiet');advance(5000);brain.tick();brain.context({category:'code'});assert.equal(brain.action,'idle');brain.setMode('company');advance(5000);brain.tick();brain.context({category:'media',fullscreen:true});assert.equal(brain.action,'idle');});
test('feeding clamps satiety and never invokes network',()=>{const {brain}=setup();for(let n=0;n<100;n++)brain.interact('feed');assert.equal(brain.fullness,100);assert.equal(brain.action,'eat');assert.equal(brain.chatBusy,false);});
test('chat prevents walking and automatic action until completion',()=>{const {brain,advance}=setup();brain.chatBusy=true;brain.play('think','',60000,90);advance(90000);brain.tick();assert.equal(brain.action,'think');assert.equal(brain.canWander(),false);});
test('repeated interaction keeps the start and postpones autonomous gestures by at least 45 seconds',()=>{
 const {brain,advance}=setup();brain.interact('pet');const started=brain.started;
 advance(300);brain.interact('pet');assert.equal(brain.started,started);
 advance(duration('happy')+1);brain.tick();assert.equal(brain.action,'idle');assert.ok(brain.nextIdle-brain.now()>=45000&&brain.nextIdle-brain.now()<=90000);
});
test('automatic micro motion is a quiet breath spaced 45 to 90 seconds apart',()=>{
 const {brain,advance}=setup();assert.ok(brain.nextIdle-brain.now()>=45000&&brain.nextIdle-brain.now()<=90000);
 for(let i=0;i<3;i++){advance(brain.nextIdle-brain.now()+1);brain.tick();assert.equal(brain.action,'breathe');assert.equal(brain.message,'');advance(brain.until-brain.now()+1);brain.tick();assert.equal(brain.action,'idle');assert.ok(brain.nextIdle-brain.now()>=45000&&brain.nextIdle-brain.now()<=90000);}
});
test('finite interaction releases its lock when the drawn clip ends',()=>{
 const {brain,advance}=setup();brain.interact('dance');assert.ok(Math.abs(brain.until-brain.started-duration('dance'))<.001);advance(duration('dance')+1);brain.tick();assert.equal(brain.action,'idle');
});
test('ten minutes of company leaves most time still with only sparse quiet activities',()=>{
 const {brain,advance}=setup();let last=brain.revision,idleSeconds=0;const events=[];
 for(let i=0;i<600;i++){advance(1000);brain.context({idleSeconds:0});brain.tick();if(brain.action==='idle')idleSeconds++;if(last!==brain.revision&&brain.action!=='idle')events.push(brain.action);last=brain.revision;}
 assert.ok(events.length>=5&&events.length<=14,JSON.stringify(events));assert.ok(idleSeconds>=450);assert.ok(events.every(a=>['breathe','meal-break'].includes(a)));assert.ok(events.filter(a=>a==='meal-break').length<=2);
});
test('the first meal waits 4 to 7 minutes and the next waits 5 to 9 minutes',()=>{
 const {brain,advance}=setup();const first=brain.nextStory;assert.ok(first-brain.now()>=240000&&first-brain.now()<=420000);
 advance(first-brain.now()+1);brain.tick();assert.equal(brain.action,'meal-break');assert.equal(brain.storyCooldowns.get('meal-break')-brain.now(),300000);assert.ok(brain.nextStory-brain.now()>=300000&&brain.nextStory-brain.now()<=540000);
 advance(20000);brain.tick();assert.equal(brain.action,'meal-break');advance(6000);brain.tick();assert.equal(brain.action,'idle');
 advance(brain.nextStory-brain.now()+1);brain.tick();assert.equal(brain.action,'meal-break');
});
test('quiet, focus, fullscreen, away and chat suppress automatic stories and gestures',()=>{
 for(const condition of ['quiet','focus','locked','away','chatBusy']){
  const {brain,advance}=setup();if(['quiet','focus'].includes(condition))brain.setMode(condition,25);else brain[condition]=true;
  advance(600001);brain.tick();assert.ok(!['meal-break','hum','token-game','breathe'].includes(brain.action),condition);
 }
});
test('petting and desktop context changes preserve long activities until their end',()=>{
 for(const action of ['eat','meal-break','sneak','hum','token-game','review','cube']){
  const {brain,advance}=setup();brain.play(action,'',5000,5);const {started,until}=brain.snapshot();brain.contextAfter=0;advance(1000);
  assert.equal(brain.interact('pet'),false);brain.context({category:'code'});assert.equal(brain.action,action);assert.equal(brain.started,started);assert.equal(brain.until,until);
 }
});
test('the two new interactions keep their full duration and a manual rest lasts through settling',()=>{
 for(const action of ['cube','curtsy']){const {brain,advance}=setup();assert.equal(brain.interact(action),true);assert.equal(brain.action,action);advance(duration(action)+1);brain.tick();assert.equal(brain.action,'idle');}
 const {brain,advance}=setup();brain.interact('curl');advance(duration('sleep')+20000);brain.tick();assert.equal(brain.action,'curl');advance(10001);brain.tick();assert.equal(brain.action,'wake');
});
test('reading and thinking are eligible context gestures but dancing is not automatic',()=>{
 const {brain,advance}=setup();brain.category='code';advance(240001);brain.nextStory=Infinity;brain.tick();assert.equal(brain.action,'think');
 advance(duration('think')+1);brain.tick();advance(brain.nextExpressive-brain.now()+1);brain.tick();assert.equal(brain.action,'review');
});
