'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Companion } = require('../src/main/behavior.cjs');
test('a spoken-input text answer stays readable after its short animation finishes', () => {
  let now = 1000; const companion = new Companion({ now: () => now, random: () => 0 });
  companion.respond('汇报那个？准备到哪儿了？', 'think');
  now += 4000; companion.tick(); assert.equal(companion.snapshot().message, '汇报那个？准备到哪儿了？');
  companion.interact('feed'); assert.notEqual(companion.snapshot().message, '汇报那个？准备到哪儿了？');
});

test('an arriving answer preserves the active drag action', () => {
  const companion = new Companion({ random: () => 0 });
  companion.chatBusy = true; companion.interact('drag');
  companion.respond('嗯，等你把我放好再说。', 'happy');
  assert.equal(companion.snapshot().action, 'drag');
});

test('an answer leaves the current gesture running while showing its text', () => {
  const companion = new Companion({ random: () => 0 });
  companion.chatBusy = true; companion.play('think', '', 60000, 90);
  companion.respond('好，今天早点睡。', 'happy');
  assert.equal(companion.snapshot().action, 'think');
  assert.equal(companion.snapshot().message, '好，今天早点睡。');
});

test('an answer during a meal preserves its complete timeline and remains readable',()=>{
 let now=1000;const companion=new Companion({now:()=>now,random:()=>0});companion.interact('feed');const {started,until}=companion.snapshot();
 now+=5000;companion.respond('嗯，这件事我记住了。','happy');const snapshot=companion.snapshot();assert.equal(snapshot.action,'eat');assert.equal(snapshot.started,started);assert.equal(snapshot.until,until);assert.equal(snapshot.message,'嗯，这件事我记住了。');assert.ok(snapshot.messageUntil>now);
});
