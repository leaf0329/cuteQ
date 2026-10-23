'use strict';
function backendUrl(value) {
  const url = new URL(value);
  const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash) throw new Error('后台地址需要 HTTPS；本机可以使用 HTTP。');
  return url.href.replace(/\/$/, '');
}
class BackendClient {
  constructor(url, token) { this.url = backendUrl(url); this.token = token; }
  async request(route, { method = 'GET', body, signal, timeout = 65_000 } = {}) {
    const response = await fetch(this.url + route, { method, redirect: 'error', signal: AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(timeout)]),
      headers: { Authorization: `Bearer ${this.token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, body: body === undefined ? undefined : JSON.stringify(body) });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || '角色后台未能完成操作。');
    return result.value;
  }
}
module.exports = { BackendClient, backendUrl };
