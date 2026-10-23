'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');
const directory = path.resolve(__dirname, '../resources/speech');
const model = 'sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17';
async function download(name, destination) {
  console.log(`正在下载 ${name}`);
  try {
    await new Promise((resolve, reject) => {
      const child = spawn(process.platform === 'win32' ? 'curl.exe' : 'curl', ['-fL', '--connect-timeout', '20', '--speed-time', '45', '--speed-limit', '1024', '--max-time', '900', '-sS', '-o', destination + '.part',
        `https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/${name}`], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
      child.stderr.on('data', () => {});
      child.once('error', reject); child.once('exit', code => code === 0 ? resolve() : reject(new Error(`语音资源下载失败（${code}），请检查网络。`)));
    });
    fs.renameSync(destination + '.part', destination);
  }
  catch (error) { fs.rmSync(destination + '.part', { force: true }); throw error; }
}
async function main() {
  fs.mkdirSync(directory, { recursive: true });
  if (!fs.existsSync(path.join(directory, model, 'model.int8.onnx'))) {
    const archive = path.join(directory, model + '.tar.bz2');
    await download(model + '.tar.bz2', archive);
    const extracted = spawnSync('tar', ['-xf', archive, '-C', directory], { windowsHide: true, encoding: 'utf8' });
    if (extracted.status !== 0) throw new Error('语音模型解压失败：' + extracted.stderr);
    fs.unlinkSync(archive);
  }
  if (!fs.existsSync(path.join(directory, 'silero_vad.onnx'))) await download('silero_vad.onnx', path.join(directory, 'silero_vad.onnx'));
  console.log('本地中文语音模型已就绪。');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
