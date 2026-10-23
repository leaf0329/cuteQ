'use strict';

const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const packagedPath = process.env.PET_SMOKE_EXE;
const electronPath = packagedPath || require('electron');
const projectRoot = path.join(__dirname, '..');
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-deepseek-pet-smoke-'));
const capturePath = path.join(temporaryRoot, 'capture.png');
const userDataPath = path.join(temporaryRoot, 'user-data');

function readPngSize(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    throw new Error('Electron smoke capture is not a PNG file.');
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

const child = spawn(electronPath, [
  ...(packagedPath ? [] : [projectRoot]),
  `--capture=${capturePath}`,
  `--test-user-data=${userDataPath}`,
  ...(process.env.PET_SMOKE_SPEECH === '1' ? ['--test-speech'] : []),
], {
  cwd: projectRoot,
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});

let output = '';
child.stdout.on('data', (chunk) => { output += chunk; });
child.stderr.on('data', (chunk) => { output += chunk; });

const timeout = setTimeout(() => {
  child.kill();
}, packagedPath ? 60_000 : 20_000);

child.on('error', (error) => {
  clearTimeout(timeout);
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
  throw error;
});

child.on('exit', (code, signal) => {
  clearTimeout(timeout);

  try {
    if (code !== 0 || signal) {
      throw new Error(`Electron smoke process failed (${signal || code}).\n${output}`);
    }
    if (!fs.existsSync(capturePath)) {
      throw new Error(`Electron did not complete the renderer-ready capture.\n${output}`);
    }

    const size = readPngSize(capturePath);
    const receipt = JSON.parse(fs.readFileSync(capturePath + '.json', 'utf8'));
    if (!receipt.assetsReady || !receipt.videoReady || receipt.videoBuffers !== 2) throw new Error('Video decoder did not initialize.');
    if (!receipt.backendReady) throw new Error('Role backend did not start.');
    if (process.env.PET_SMOKE_SPEECH === '1' && !receipt.speechReady) throw new Error('Packaged speech model did not initialize.');
    if (receipt.artwork !== 'cuteQ-original') throw new Error('Own-character artwork was not selected.');
    if (receipt.motionSources < 30) throw new Error('Video animation sources are unavailable.');
    if (size.width < 200 || size.height < 250) {
      throw new Error(`Electron smoke capture is unexpectedly small: ${size.width}x${size.height}.`);
    }

    if (packagedPath) {
      const artifacts = path.join(projectRoot, 'artifacts');
      fs.mkdirSync(artifacts, { recursive: true });
      fs.copyFileSync(capturePath, path.join(artifacts, 'packaged-smoke.png'));
      fs.writeFileSync(path.join(artifacts, 'packaged-smoke.json'), JSON.stringify({ executable: path.basename(packagedPath), size, ...receipt }, null, 2));
    }

    process.stdout.write(`Electron smoke test passed (${size.width}x${size.height}), ${JSON.stringify(receipt)}.\n`);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
