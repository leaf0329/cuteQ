'use strict';
const path = require('node:path');
const fs = require('node:fs');
const sherpa = require('sherpa-onnx-node');
const modelName = 'sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2024-07-17';
let recognizer, vad, remainder = new Float32Array(0), active = false, sequence = 0;
const post = value => process.parentPort.postMessage(value);
process.parentPort.on('message', ({ data }) => {
  try {
    if (data.type === 'start') {
      const modelPath = path.join(data.directory, modelName);
      for (const file of [path.join(modelPath, 'model.int8.onnx'), path.join(modelPath, 'tokens.txt'), path.join(data.directory, 'silero_vad.onnx')]) {
        if (!fs.existsSync(file)) throw new Error('语音模型尚未安装，请先运行语音准备程序。');
      }
      recognizer = new sherpa.OfflineRecognizer({ featConfig: { sampleRate: 16000, featureDim: 80 },
        modelConfig: { senseVoice: { model: path.join(modelPath, 'model.int8.onnx'), language: 'zh', useInverseTextNormalization: 1 },
          tokens: path.join(modelPath, 'tokens.txt'), numThreads: 2, provider: 'cpu', debug: 0 } });
      vad = new sherpa.Vad({ sileroVad: { model: path.join(data.directory, 'silero_vad.onnx'), threshold: 0.55,
        minSpeechDuration: 0.3, minSilenceDuration: 1.2, windowSize: 512, maxSpeechDuration: 25 }, sampleRate: 16000, numThreads: 1, debug: false }, 40);
      active = true;
      post({ type: 'ready' });
    } else if (data.type === 'audio' && active) {
      if (data.sampleRate !== 16000) throw new Error('录音格式不受支持，请重新开启聆听。');
      const incoming = new Float32Array(data.samples);
      const samples = new Float32Array(remainder.length + incoming.length); samples.set(remainder); samples.set(incoming, remainder.length);
      let offset = 0;
      for (; offset + 512 <= samples.length; offset += 512) vad.acceptWaveform(samples.subarray(offset, offset + 512));
      remainder = samples.slice(offset);
      while (!vad.isEmpty()) {
        // Electron 的 V8 沙箱不允许 native external ArrayBuffer，要求识别器返回拥有自身存储的副本。
        const segment = vad.front(false); vad.pop();
        const stream = recognizer.createStream();
        stream.acceptWaveform({ samples: segment.samples, sampleRate: 16000 }); recognizer.decode(stream);
        const text = recognizer.getResult(stream).text.replace(/<\|[^|]+\|>/g, '').trim();
        if (text) post({ type: 'transcript', sequence: ++sequence, text });
      }
      post({ type: 'consumed' });
    }
  } catch (error) { active = false; post({ type: 'error', detail: error.message, error: /^[\u4e00-\u9fff]/.test(error.message) ? error.message : '本地语音识别失败，聆听已暂停。' }); }
});
