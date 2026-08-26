const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const source = path.join(projectRoot, '.output', 'public');
const destination = path.join(__dirname, 'renderer');

if (!fs.existsSync(source)) {
  throw new Error(`Build output not found: ${source}`);
}

const indexPath = path.join(source, 'index.html');
if (!fs.existsSync(indexPath)) {
  throw new Error(`Build output is missing index.html: ${indexPath}`);
}

fs.rmSync(destination, { recursive: true, force: true });
fs.cpSync(source, destination, { recursive: true });

console.log(`[Edit Suite] Renderer copied to ${destination}`);
