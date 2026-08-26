const { app, BrowserWindow, session, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const http = require('http');
const { spawn } = require('child_process');
const bundledFfmpegPath = require('ffmpeg-static');

const isDev = !app.isPackaged;
let rendererServer = null;

const ffmpegPath = bundledFfmpegPath && bundledFfmpegPath.includes('app.asar')
  ? bundledFfmpegPath.replace('app.asar', 'app.asar.unpacked')
  : bundledFfmpegPath;

function getRendererRoot() {
  // Production builds are copied into electron/renderer before packaging.
  // This folder is guaranteed to be included by electron-builder.
  return path.join(__dirname, 'renderer');
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.otf': 'font/otf',
    '.map': 'application/json; charset=utf-8',
  };
  return types[ext] || 'application/octet-stream';
}

function startRendererServer() {
  return new Promise((resolve, reject) => {
    const rendererRoot = getRendererRoot();
    const indexPath = path.join(rendererRoot, 'index.html');

    if (!fs.existsSync(indexPath)) {
      reject(new Error(`Renderer files were not packaged correctly. Missing: ${indexPath}`));
      return;
    }

    rendererServer = http.createServer(async (req, res) => {
      try {
        const rawUrl = String(req.url || '/').split('?')[0];
        let relativePath;
        try {
          relativePath = decodeURIComponent(rawUrl).replace(/^\/+/, '');
        } catch {
          res.writeHead(400);
          res.end('Bad Request');
          return;
        }

        if (!relativePath) relativePath = 'index.html';

        const requestedPath = path.resolve(rendererRoot, relativePath);
        const relativeToRoot = path.relative(rendererRoot, requestedPath);
        const isInsideRoot = relativeToRoot === '' ||
          (!relativeToRoot.startsWith('..' + path.sep) &&
            relativeToRoot !== '..' &&
            !path.isAbsolute(relativeToRoot));

        if (!isInsideRoot) {
          res.writeHead(403);
          res.end('Forbidden');
          return;
        }

        let filePath = requestedPath;
        try {
          const stat = await fs.promises.stat(filePath);
          if (stat.isDirectory()) filePath = path.join(filePath, 'index.html');
        } catch {
          // Extensionless URLs are client-side routes; asset URLs remain real 404s.
          if (path.extname(relativePath)) {
            res.writeHead(404);
            res.end('Not Found');
            return;
          }
          filePath = indexPath;
        }

        const data = await fs.promises.readFile(filePath);
        res.writeHead(200, {
          'Content-Type': getMimeType(filePath),
          'Cache-Control': 'no-cache',
        });
        res.end(data);
      } catch (error) {
        console.error('[renderer-server]', error);
        res.writeHead(500);
        res.end('Internal Server Error');
      }
    });

    rendererServer.once('error', reject);
    rendererServer.listen(0, '127.0.0.1', () => {
      const address = rendererServer.address();
      const port = typeof address === 'object' && address ? address.port : null;
      if (!port) {
        reject(new Error('Could not determine renderer server port'));
        return;
      }
      rendererServer.removeListener('error', reject);
      resolve(`http://127.0.0.1:${port}/`);
    });
  });
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#111111',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
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
    const rendererUrl = await startRendererServer();
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
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch { /* ignore cleanup errors */ }
  }
});

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));

  try {
    await createWindow();
  } catch (error) {
    console.error('[Edit Suite] Failed to start renderer:', error);
    dialog.showErrorBox('Edit Suite failed to start', String(error?.stack || error));
    app.quit();
  }

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      try { await createWindow(); } catch (error) { console.error(error); }
    }
  });
});

app.on('before-quit', () => {
  if (rendererServer) {
    rendererServer.close();
    rendererServer = null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
