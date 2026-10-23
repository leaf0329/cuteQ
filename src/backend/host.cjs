'use strict';
const { startServer } = require('./server.cjs');
const { complete } = require('../main/chat.cjs');
const { net } = require('electron');
let backend;
process.parentPort.on('message', async ({ data }) => {
  try {
    if (data.type === 'start') {
      backend = await startServer({ directory: data.directory, config: data.config, modelCall: options => complete({ ...options, fetchImpl: net.fetch }) });
      backend.store.setMeta('agreement', data.agreement || '');
      process.parentPort.postMessage({ type: 'ready', url: backend.url, token: backend.token });
    } else if (data.type === 'configure') backend.service.configure(data.config);
    else if (data.type === 'stop') { await backend.close(); process.exit(0); }
  } catch { process.parentPort.postMessage({ type: 'error', error: '本机角色后台未能启动，请检查数据目录。' }); }
});
