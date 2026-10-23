'use strict';
const path = require('node:path');
const { BackendClient } = require('./backend-client.cjs');

class BackendRuntime {
  constructor(utilityProcess, directory) { this.utilityProcess = utilityProcess; this.directory = directory; this.child = null; }
  async connect(settings, key, remoteToken) {
    this.stop();
    if (settings.backendMode === 'remote') {
      if (!remoteToken || remoteToken.length < 32) throw new Error('请填写服务器后台的访问口令（至少 32 字符）。');
      const client = new BackendClient(settings.backendUrl, remoteToken);
      await client.request('/v1/status', { timeout: 5000 });
      return client;
    }
    const child = this.utilityProcess.fork(path.join(__dirname, '../backend/host.cjs'), [], { serviceName: 'cuteQ 角色后台', stdio: 'ignore' });
    this.child = child;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { child.kill(); reject(new Error('本机角色后台启动超时。')); }, 15000);
      child.once('exit', () => { clearTimeout(timer); reject(new Error('本机角色后台已经停止，请重新保存设置以连接。')); });
      child.on('message', message => {
        if (message.type === 'ready') { clearTimeout(timer); resolve(new BackendClient(message.url, message.token)); }
        else if (message.type === 'error') { clearTimeout(timer); child.kill(); reject(new Error(message.error)); }
      });
      child.postMessage({ type: 'start', directory: this.directory, agreement: settings.memory, config: { key, baseUrl: settings.baseUrl, model: settings.model } });
    });
  }
  stop() { if (this.child) { this.child.kill(); this.child = null; } }
}
module.exports = { BackendRuntime };
