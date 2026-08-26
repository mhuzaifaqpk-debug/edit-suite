const { app, BrowserWindow, session, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const { spawn } = require('child_process');
const bundledFfmpegPath = require('ffmpeg-static');

const isDev = !app.isPackaged;
let rendererServerProcess = null;
let rendererPort = null;

const ffmpegPath = bundledFfmpegPath && bundledFfmpegPath.includes('app.asar')
  ? bundledFfmpegPath.replace('app.asar', 'app.asar.unpacked')
  : bundledFfmpegPath;

function getProductionServerEntry() {
  return path.join(process.resourcesPath, '.output', 'server', 'index.mjs');
}

function waitForServer(url, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const check = () => {
      const request = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) {
          resolve();
        } else {
          retry();
        }
      });
      request.on('error', retry);
      request.setTimeout(1000, () => request.destroy());
    };
    const retry = () => {
      if (Date.now() - started > timeout) {
        reject(new Error(`Timed out waiting for the production renderer at ${url}`));
        return;
      }
      setTimeout(check, 150);
    };
    check();
  });
}

async function startProductionServer() {
  const serverEntry = getProductionServerEntry();
  if (!fs.existsSync(serverEntry)) {
    throw new Error(`Production server was not packaged correctly. Missing: ${serverEntry}`);
  }

  rendererPort = await new Promise((resolve, reject) => {
    const server = require('net').createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = address && typeof address === 'object' ? address.port : null;
      server.close(() => port ? resolve(port) : reject(new Error('Could not allocate renderer port')));
    });
  });

  rendererServerProcess = spawn(process.execPath, [serverEntry], {
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      HOSTNAME: '127.0.0.1',
      PORT: String(rendererPort),
      NITRO_HOST: '127.0.0.1',
      NITRO_PORT: String(rendererPort),
    },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  rendererServerProcess.stdout?.on('data', (data) => console.log('[renderer]', data.toString().trim()));
  rendererServerProcess.stderr?.on('data', (data) => console.error('[renderer]', data.toString().trim()));
  rendererServerProcess.on('error', (error) => console.error('[renderer process]', error));

  const url = `http://127.0.0.1:${rendererPort}/`;
  await waitForServer(url);
  return url;
}

function stopProductionServer() {
  if (rendererServerProcess) {
    rendererServerProcess.kill();
    rendererServerProcess = null;
  }
  rendererPort = null;
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#111111',
    icon: path.join(process.resourcesPath, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) {
    await win.loadURL('http://localhost:5173');
  } else {
    const rendererUrl = await startProductionServer();
    await win.loadURL(rendererUrl);
  }
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { windowsHide: true });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(stderr || `FFmpeg exited with code ${code}`)));
  });
}

ipcMain.handle('save-export', async (_event, { buffer, format, suggestedName }) => {
  const extension = format === 'mp4' ? 'mp4' : 'webm';
  const defaultName = `${String(suggestedName || 'Edit Suite Export').replace(/[\\/:*?"<>|]/g, '_')}.${extension}`;
  const result = await dialog.showSaveDialog({
    title: 'Export Video',
    defaultPath: defaultName,
    filters: [{ name: format === 'mp4' ? 'MP4 Video' : 'WebM Video', extensions: [extension] }],
  });
  if (result.canceled || !result.filePath) return { canceled: true };

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'edit-suite-export-'));
  const input = path.join(tempDir, 'render.webm');
  try {
    fs.writeFileSync(input, Buffer.from(buffer));
    if (format === 'webm') {
      fs.copyFileSync(input, result.filePath);
    } else {
      await runFfmpeg([
        '-y', '-i', input,
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '18',
        '-c:a', 'aac', '-b:a', '192k',
        '-movflags', '+faststart',
        result.filePath,
      ]);
    }
    return { canceled: false, filePath: result.filePath };
  } finally {
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  }
});

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  try {
    await createWindow();
  } catch (error) {
    console.error('[Edit Suite] Failed to start:', error);
    dialog.showErrorBox('Edit Suite failed to start', String(error?.stack || error));
    stopProductionServer();
    app.quit();
  }

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      try { await createWindow(); } catch (error) { console.error(error); }
    }
  });
});

app.on('before-quit', stopProductionServer);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
