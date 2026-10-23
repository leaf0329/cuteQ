'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { startServer } = require('../src/backend/server.cjs');
const { BackendClient } = require('../src/main/backend-client.cjs');
const token = 'owner-token-for-local-test-only-123456789';
const decision = (reply, memories = []) => JSON.stringify({ reply, expression: 'idle', memories });
const note = { topic: '周五汇报', text: '用户提到周五的汇报尚未准备。', kind: 'plan', evidence: '周五那个汇报还没准备' };
const turn = (text, channel = 'desktop', kind = 'dialogue') => ({ id: randomUUID(), text, channel, kind });
async function fixture(t, modelCall) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cuteq-backend-'));
  let backend = await startServer({ directory, token, config: { key: 'test-key' }, modelCall });
  t.after(async () => { await backend.close(); fs.rmSync(directory, { recursive: true, force: true }); });
  return { get backend() { return backend; }, get client() { return new BackendClient(backend.url, token); },
    async restart() { await backend.close(); backend = await startServer({ directory, token, config: { key: 'test-key' }, modelCall }); } };
}
test('overheard desktop memory persists across restart and is available to the owner QQ entrance', async t => {
  const calls = [];
  const f = await fixture(t, async request => { calls.push(request); return calls.length === 1 ? decision('', [note]) : decision('汇报那个？准备到哪儿了？'); });
  const input = turn('周五那个汇报还没准备', 'desktop', 'overheard');
  const saved = await f.client.request('/v1/turn', { method: 'POST', body: input });
  assert.equal(saved.reply, ''); assert.equal(saved.memories.length, 1);
  await f.restart();
  await f.client.request('/v1/turn', { method: 'POST', body: turn('还是没弄完', 'qq-private') });
  assert.ok(calls[1].system.includes(note.text));
  assert.ok(calls[1].messages.some(row => row.content === input.text));
  assert.equal((await f.client.request('/v1/memories')).length, 1);
});
test('replayed deliveries do not call the model twice or duplicate conversation', async t => {
  let calls = 0; const f = await fixture(t, async () => { calls++; return decision('我在。'); });
  const input = turn('大肥鱼');
  const first = await f.client.request('/v1/turn', { method: 'POST', body: input });
  const second = await f.client.request('/v1/turn', { method: 'POST', body: input });
  assert.deepEqual(second, first); assert.equal(calls, 1); assert.equal((await f.client.request('/v1/history')).length, 2);
  await assert.rejects(f.client.request('/v1/turn', { method: 'POST', body: { ...input, text: '另一条消息' } }), /重复/);
});
test('memory correction invalidates stale in-flight extraction and excludes old prompt context', async t => {
  let release, entered; const waiting = new Promise(resolve => { entered = resolve; }); let count = 0; const calls = [];
  const f = await fixture(t, async request => {
    calls.push(request); count++;
    if (count === 1) return decision('知道了。', [note]);
    if (count === 2) { entered(); await new Promise(resolve => { release = resolve; }); return decision('旧回复', [note]); }
    return decision('按下周一的汇报算。');
  });
  await f.client.request('/v1/turn', { method: 'POST', body: turn(note.evidence) });
  const memory = (await f.client.request('/v1/memories'))[0];
  const pending = f.client.request('/v1/turn', { method: 'POST', body: turn(note.evidence) });
  const rejected = assert.rejects(pending, /记忆已修改/);
  await waiting;
  await f.client.request('/v1/memories/' + memory.id, { method: 'PATCH', body: { text: '汇报改到下周一。' } });
  release(); await rejected;
  await f.client.request('/v1/turn', { method: 'POST', body: turn('时间改了吗', 'qq-private') });
  assert.ok(calls[2].system.includes('汇报改到下周一'));
  assert.ok(!calls[2].messages.some(row => row.content === note.evidence));
  await f.client.request('/v1/memories/' + memory.id, { method: 'DELETE' });
  assert.equal((await f.client.request('/v1/memories')).length, 0);
  await f.restart(); assert.equal((await f.client.request('/v1/memories')).length, 0);
});
test('model errors and malformed decisions do not fabricate successful memory writes', async t => {
  let count = 0;
  const f = await fixture(t, async () => { count++; if (count === 1) throw new Error('network failure'); return 'not-json'; });
  for (let i = 0; i < 2; i++) await assert.rejects(f.client.request('/v1/turn', { method: 'POST', body: turn('明天开会') }));
  assert.equal((await f.client.request('/v1/history')).length, 0);
  assert.equal((await f.client.request('/v1/memories')).length, 0);
});
test('a memory without evidence in the current utterance is discarded', async t => {
  const f = await fixture(t, async () => decision('你好呀。', [note]));
  const result = await f.client.request('/v1/turn', { method: 'POST', body: turn('你好') });
  assert.deepEqual(result.memories, []); assert.equal((await f.client.request('/v1/memories')).length, 0);
});
test('backend requires owner authentication and rejects browser origins and unsupported group scope', async t => {
  const f = await fixture(t, async () => decision('你好。'));
  assert.equal((await fetch(f.backend.url + '/v1/memories')).status, 401);
  assert.equal((await fetch(f.backend.url + '/v1/memories', { headers: { Authorization: `Bearer ${token}`, Origin: 'https://untrusted.example' } })).status, 403);
  await assert.rejects(f.client.request('/v1/turn', { method: 'POST', body: turn('你好', 'qq-group') }), /入口/);
});
