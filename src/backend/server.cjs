'use strict';
const http = require('node:http');
const crypto = require('node:crypto');
const { MemoryStore } = require('./store.cjs');
const { CompanionService } = require('./service.cjs');

function fail(message, status = 400) { const error = new Error(message); error.status = status; throw error; }
function string(value, name, max) { if (typeof value !== 'string' || !value.trim() || value.length > max) fail(`${name}格式不正确。`); return value.trim(); }
async function readBody(req, limit = 3_000_000) {
  if (!req.headers['content-type']?.startsWith('application/json')) fail('请求需要使用 JSON。', 415);
  const chunks = []; let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > limit) fail('请求内容过大。', 413); chunks.push(chunk); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail('请求内容不是有效 JSON。'); }
}
function authorized(header, token) {
  const actual = Buffer.from(header || ''); const expected = Buffer.from(`Bearer ${token}`);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
async function startServer({ directory, token = crypto.randomBytes(32).toString('hex'), port = 0, host = '127.0.0.1', config = {}, modelCall } = {}) {
  if (token.length < 32) throw new Error('后台访问口令至少需要 32 个字符。');
  const store = new MemoryStore(directory), service = new CompanionService(store, config, modelCall);
  const server = http.createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store');
    const abort = new AbortController(); res.once('close', () => { if (!res.writableEnded) abort.abort(); });
    try {
      if (req.headers.origin) fail('不接受浏览器网页访问此后台。', 403);
      if (!authorized(req.headers.authorization, token)) fail('后台身份校验失败。', 401);
      const url = new URL(req.url, 'http://localhost');
      let result;
      if (req.method === 'GET' && url.pathname === '/v1/status') result = { ready: true, configured: Boolean(service.config.key), model: service.config.model || 'deepseek-flash', memories: store.memories().length };
      else if (req.method === 'GET' && url.pathname === '/v1/history') result = store.history();
      else if (req.method === 'GET' && url.pathname === '/v1/memories') result = store.memories();
      else if (req.method === 'GET' && url.pathname === '/v1/agreement') result = store.meta('agreement');
      else if (req.method === 'PUT' && url.pathname === '/v1/agreement') {
        const body = await readBody(req); if (typeof body.text !== 'string' || body.text.length > 2000) fail('相处约定最多 2000 字。');
        store.setMeta('agreement', body.text); result = true;
      } else if (req.method === 'POST' && url.pathname === '/v1/turn') {
        const body = await readBody(req);
        const input = { id: string(body.id, '消息编号', 100), text: string(body.text, '消息', 8000), channel: body.channel, kind: body.kind };
        // 本接口仅服务已验证的主人；未来 QQ 群聊必须走另行隔离的适配器。
        if (!['desktop', 'qq-private'].includes(input.channel) || !['dialogue', 'overheard'].includes(input.kind)) fail('消息入口或类型不正确。');
        if (input.channel !== 'desktop' && input.kind === 'overheard') fail('该入口不支持环境语音。');
        if (body.image !== undefined && body.image !== null) {
          if (typeof body.image !== 'string' || !/^data:image\/(png|jpeg|webp);base64,/.test(body.image) || body.image.length > 2_500_000) fail('画面格式不正确或过大。');
          input.image = body.image;
        }
        if (body.state) {
          if (!['company', 'quiet', 'focus'].includes(body.state.mode) || !Number.isFinite(body.state.fullness) || body.state.fullness < 0 || body.state.fullness > 100) fail('角色状态格式不正确。');
          input.state = { mode: body.state.mode, fullness: body.state.fullness };
        }
        result = await service.turn(input, abort.signal);
      } else if (req.method === 'DELETE' && url.pathname === '/v1/history') { store.clearHistory(); result = true; }
      else if (['PATCH', 'DELETE'].includes(req.method) && /^\/v1\/memories\/[^/]+$/.test(url.pathname)) {
        const id = decodeURIComponent(url.pathname.split('/').at(-1));
        const text = req.method === 'DELETE' ? null : string((await readBody(req)).text, '记忆内容', 1200);
        store.reviseMemory(id, text); result = true;
      } else fail('没有这个后台接口。', 404);
      if (!abort.signal.aborted) res.end(JSON.stringify({ ok: true, value: result }));
    } catch (error) {
      if (abort.signal.aborted) return;
      res.statusCode = error.status || 502;
      const message = /^[\u4e00-\u9fff]/.test(error.message || '') ? error.message : '后台未能完成操作，请检查连接与模型设置。';
      res.end(JSON.stringify({ ok: false, error: message }));
    }
  });
  server.requestTimeout = 70_000; server.headersTimeout = 10_000;
  try { await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, host, resolve); }); }
  catch (error) { store.close(); throw error; }
  return { server, store, service, token, url: `http://${host}:${server.address().port}`,
    async close() { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); store.close(); } };
}
module.exports = { startServer };
