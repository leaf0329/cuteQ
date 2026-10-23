'use strict';
const path = require('node:path');
const { startServer } = require('./server.cjs');
async function main() {
  if (!process.env.CUTEQ_TOKEN || !process.env.DEEPSEEK_API_KEY) throw new Error('请设置 CUTEQ_TOKEN（至少 32 字符）与 DEEPSEEK_API_KEY。');
  const backend = await startServer({ directory: process.env.CUTEQ_DATA_DIR || path.resolve('data'), token: process.env.CUTEQ_TOKEN,
    port: Number(process.env.CUTEQ_PORT || 17831), config: { key: process.env.DEEPSEEK_API_KEY, model: process.env.CUTEQ_MODEL || 'deepseek-flash', baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1' } });
  console.log(`cuteQ 角色后台已启动：${backend.url}（仅监听本机，远程访问请配置 HTTPS 反向代理）`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => { await backend.close(); process.exit(0); });
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
