const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');

const pathsToRemove = [
  'dist',
  'build',
  '*.tsbuildinfo',
];

for (const entry of pathsToRemove) {
  const fullPath = path.join(PROJECT_ROOT, entry);

  if (entry.includes('*')) {
    const dir = path.dirname(fullPath);
    const pattern = path.basename(fullPath);

    if (!fs.existsSync(dir)) {
      continue;
    }

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const matches = entries.filter((e) => {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return e.isFile() && regex.test(e.name);
    });

    for (const match of matches) {
      const filePath = path.join(dir, match.name);
      try {
        fs.rmSync(filePath, { force: true });
        console.log(`[clean] Deleted file: ${path.relative(PROJECT_ROOT, filePath)}`);
      } catch (err) {
        console.error(`[clean] Failed to delete file ${filePath}: ${err.message}`);
        process.exitCode = 1;
      }
    }
  } else if (fs.existsSync(fullPath)) {
    try {
      fs.rmSync(fullPath, { recursive: true, force: true });
      console.log(`[clean] Deleted directory: ${path.relative(PROJECT_ROOT, fullPath)}`);
    } catch (err) {
      console.error(`[clean] Failed to delete ${fullPath}: ${err.message}`);
      process.exitCode = 1;
    }
  }
}

console.log('[clean] Done.');
