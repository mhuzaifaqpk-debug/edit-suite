const { app, BrowserWindow, session, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const bundledFfmpegPath = require('ffmpeg-static');

const isDev = !app.isPackaged;
const ffmpegPath = bundledFfmpegPath && bundledFfmpegPath.includes('app.asar')
  ? bundledFfmpegPath.replace('app.asar', 'app.asar.unpacked')
  : bundledFfmpegPath;

function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#111111',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
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
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore cleanup errors */ }
  }
});

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
