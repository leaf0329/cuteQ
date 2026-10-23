'use strict';
let microphone = null, audioContext = null, microphoneNode = null, audioSource = null, startingMicrophone = false, speechPending = false;
const speechButton = document.querySelector('#listen');
function speechState(active) {
  speechButton.textContent = active ? '暂停聆听' : '开启聆听';
  speechButton.setAttribute('aria-pressed', String(active));
  document.querySelector('#speech-mode').disabled = active;
  document.querySelector('#listen-state').textContent = active ? '正在聆听 · 音频仅在本机处理' : '麦克风已关闭';
}
async function releaseMicrophone() {
  microphone?.getTracks().forEach(track => track.stop()); microphone = null;
  microphoneNode?.disconnect(); microphoneNode = null; audioSource?.disconnect(); audioSource = null;
  const context = audioContext; audioContext = null; if (context && context.state !== 'closed') await context.close();
  if (speechPending) { document.querySelector('#speech-result').textContent = '聆听已暂停，末段尚未提交。'; speechPending = false; }
  speechState(false);
}
async function toggleMicrophone() {
  if (startingMicrophone || !window.petApi) return;
  if (microphone) { await releaseMicrophone(); await window.petApi.stopSpeech(); return; }
  startingMicrophone = true; speechButton.disabled = true; document.querySelector('#listen-state').textContent = '正在加载本地语音模型……';
  try {
    const ready = await window.petApi.startSpeech(document.querySelector('#speech-mode').value);
    if (!ready.ok) throw new Error(ready.error);
    microphone = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
    audioContext = new AudioContext({ sampleRate: 16000 });
    await audioContext.audioWorklet.addModule('microphone-worklet.js');
    audioSource = audioContext.createMediaStreamSource(microphone);
    microphoneNode = new AudioWorkletNode(audioContext, 'microphone-frames', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
    microphoneNode.port.onmessage = event => { if (audioContext) window.petApi.audio(event.data, audioContext.sampleRate); };
    audioSource.connect(microphoneNode); microphoneNode.connect(audioContext.destination); await audioContext.resume(); speechState(true);
  } catch (error) {
    await releaseMicrophone(); await window.petApi.stopSpeech();
    document.querySelector('#speech-result').textContent = error.name === 'NotAllowedError' ? '麦克风访问被拒绝，请检查 Windows 麦克风权限。' : error.message;
  } finally { startingMicrophone = false; speechButton.disabled = false; }
}
speechButton.onclick = toggleMicrophone;
window.petApi?.onSpeechToggle(toggleMicrophone);
window.petApi?.onSpeechState(value => { if (!value.active) releaseMicrophone(); });
window.petApi?.onTranscript(value => {
  speechPending = value.pending;
  document.querySelector('#speech-text').textContent = value.text;
  document.querySelector('#speech-result').textContent = value.pending ? '听到了，等你说完整……' : '正在理解这段话……';
});
window.petApi?.onSpeechResult(value => { document.querySelector('#speech-result').textContent = value.error + '（未保存）'; });
document.querySelector('#correct-speech').onclick = async () => {
  const text = document.querySelector('#speech-text').textContent;
  if (!text) return;
  await releaseMicrophone(); await window.petApi?.stopSpeech();
  document.querySelector('#prompt').value = '更正刚才语音识别的内容：' + text; tab('chat'); document.querySelector('#prompt').focus();
};
window.addEventListener('beforeunload', () => { microphone?.getTracks().forEach(track => track.stop()); window.petApi?.stopSpeech(); });
