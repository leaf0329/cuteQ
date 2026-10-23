'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {clips,sample,duration,turnDuration,transition}=require('../src/renderer/motion.js');
const {ACTIONS}=require('../src/main/behavior.cjs');

test('all behaviors use our own artwork with valid media times, including both new actions',()=>{
 for(const action of Object.keys(ACTIONS))assert.ok(clips[action],action);
 for(const [action,c]of Object.entries(clips)){
  assert.ok(c.times.every(t=>t>0),action);
  for(let elapsed=0;elapsed<duration(action)+9000;elapsed+=73){
   const pose=sample(action,elapsed),media=Object.values(clips).find(c=>c.file===pose.file);
   assert.ok(fs.existsSync(path.join(__dirname,'../assets/whale-video',pose.file+'.webm')),pose.file);
   assert.equal(media.origin,'cuteQ');assert.ok(pose.file.startsWith('own-'));
   assert.ok(Number.isFinite(pose.time)&&pose.time>=0&&pose.time<media.mediaDuration,action+': '+pose.time);
  }
 }
});
test('meals take 24 to 30 seconds while each moving segment keeps the original speed',()=>{
 for(const action of ['eat','meal-break']){
  assert.ok(duration(action)>=24000&&duration(action)<=30000);
  let start=0;
  for(const time of clips[action].times){const a=sample(action,start+100),b=sample(action,start+200);assert.ok(Math.abs(b.time-a.time-.1)<1e-8);start+=time;}
  assert.deepEqual(sample(action,duration(action)+1),sample('idle',0));
 }
});
test('idle and reduced motion remain still over time',()=>{
 assert.deepEqual(sample('idle',0),sample('idle',60000));
 for(const action of Object.keys(clips))assert.deepEqual(sample(action,0,true),sample(action,60000,true),action);
});
test('sleep stays paused after settling and waking completes before idle',()=>{
 const sleep=sample('sleep',60000),wake=sample('wake',0);assert.equal(sleep.paused,true);assert.equal(wake.time,0);assert.equal(wake.paused,false);
 assert.ok(duration('wake')>=5000);assert.deepEqual(sample('wake',duration('wake')+1),sample('idle',0));
});
test('walking turns before moving and its repeat keeps the same direction',()=>{
 for(const action of ['left','right']){
  const before=sample(action,turnDuration-.01),after=sample(action,turnDuration);
  assert.equal(before.walking,false);assert.equal(after.walking,true);assert.ok(before.file.startsWith('own-turn-'));assert.equal(after.time,0);
  const repeat=sample(action,60000);assert.equal(repeat.walking,true);assert.equal(repeat.flip,action==='left');assert.ok(repeat.time>=0&&repeat.time<duration(action)/1000);
 }
});
test('pose transitions interpolate without altering the selected video',()=>{
 const a={...sample('drag',1000),rotation:.2,y:12},b=sample('idle',0),start=transition(a,b,0);
 assert.equal(start.file,b.file);assert.equal(start.y,a.y);assert.deepEqual(transition(a,b,180),b);
});
