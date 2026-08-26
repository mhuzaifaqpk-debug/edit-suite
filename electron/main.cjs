const { app, BrowserWindow, session, ipcMain, dialog, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const bundledFfmpegPath = require('ffmpeg-static');

const APP_SCHEME = 'edit-suite';

// The production renderer uses root-relative asset URLs such as /assets/*.js.
// A file:// URL treats those as the computer's filesystem root, which causes a
// packaged Electron app to open as a blank page. Register a proper application
// protocol so root-relative URLs resolve inside .output/public.
protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

const isDev = !app.isPackaged;
const ffmpegPath = bundledFfmpegPath && bundledFfmpegPath.includes('app.asar')
  ? bundledFfmpegPath.replace('app.asar', 'app.asar.unpacked')
  : bundledFfmpegPath;

function getRendererRoot() {
  return path.join(__dirname, '..', '.output', 'public');
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
    '.map': 'application/json; charset=utf-8',
  };
  return types[ext] || 'application/octet-stream';
}

function registerRendererProtocol() {
  protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url);
    const rendererRoot = path.resolve(getRendererRoot());

    // Keep the application files sandboxed inside .output/public.
    let relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    if (!relativePath) relativePath = 'index.html';

    const requestedPath = path.resolve(rendererRoot, relativePath);
    const relativeToRoot = path.relative(rendererRoot, requestedPath);
    const isInsideRoot = relativeToRoot === '' ||
      (!relativeToRoot.startsWith('..' + path.sep) && relativeToRoot !== '..' && !path.isAbsolute(relativeToRoot));

    if (!isInsideRoot) {
      return new Response('Forbidden', { status: 403 });
    }

    let filePath = requestedPath;
    try {
      const stat = await fs.promises.stat(filePath);
      if (stat.isDirectory()) filePath = path.join(filePath, 'index.html');
    } catch {
      // TanStack Start client routes need the app shell when navigating directly.
      // Files with an extension should still return a normal 404.
      if (path.extname(relativePath)) return new Response('Not Found', { status: 404 });
      filePath = path.join(rendererRoot, 'index.html');
    }

    try {
      const data = await fs.promises.readFile(filePath);
      return new Response(data, {
        status: 200,
        headers: {
          'Content-Type': getMimeType(filePath),
          'Cache-Control': 'no-cache',
        },
      });
    } catch {
      return new Response('Not Found', { status: 404 });
    }
  });
}

function createWindow() {
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
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadURL(`${APP_SCHEME}://app/index.html`);
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
  registerRendererProtocol();
  session.defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
