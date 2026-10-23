'use strict';
const path = require('node:path');
class SpeechRuntime {
  constructor(utilityProcess, directory, onEvent) {
    this.utilityProcess = utilityProcess; this.directory = directory; this.onEvent = onEvent; this.child = null; this.active = false; this.queued = 0;
  }
  async start() {
    this.stop();
    const child = this.utilityProcess.fork(path.join(__dirname, 'speech-worker.cjs'), [], { serviceName: 'cuteQ 本地语音识别', stdio: 'ignore' });
    this.child = child;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.stop(); reject(new Error('语音模型加载超时，请检查本地模型。')); }, 20000);
      child.once('exit', () => {
        clearTimeout(timer);
        if (this.child === child) { this.child = null; this.active = false; this.onEvent({ type: 'error', error: '语音识别进程已经停止，聆听已暂停。' }); }
        reject(new Error('本地语音识别进程未能启动。'));
      });
      child.on('message', event => {
        if (this.child !== child) return;
        if (event.type === 'ready') { clearTimeout(timer); this.active = true; resolve(true); }
        else if (event.type === 'consumed') this.queued--;
        else if (event.type === 'error') { clearTimeout(timer); console.error('Local speech engine:', event.detail || event.error); this.stop(); this.onEvent(event); reject(new Error(event.error)); }
        else this.onEvent(event);
      });
      child.postMessage({ type: 'start', directory: this.directory });
    });
  }
  audio(samples, sampleRate) {
    if (!this.active) return;
    if (!(samples instanceof ArrayBuffer) || samples.byteLength < 4 || samples.byteLength > 65536 || samples.byteLength % 4
      || !Number.isInteger(sampleRate) || sampleRate < 8000 || sampleRate > 192000) return;
    if (++this.queued > 60) { this.stop(); this.onEvent({ type: 'error', error: '语音处理跟不上录音，已暂停聆听，请稍后重开。' }); return; }
    this.child.postMessage({ type: 'audio', samples, sampleRate });
  }
  stop() { this.active = false; this.queued = 0; const child = this.child; this.child = null; child?.kill(); }
}
module.exports = { SpeechRuntime };
