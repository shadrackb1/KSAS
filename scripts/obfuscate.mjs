/**
 * scripts/obfuscate.mjs
 * Post-build obfuscation for production JS bundles.
 * Run via: node scripts/obfuscate.mjs
 */
import JavaScriptObfuscator from 'javascript-obfuscator';
import { readdirSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join, extname } from 'path';

const DIST = join(process.cwd(), 'dist', 'assets');

const OBFUSCATION_OPTIONS = {
  compact: true,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  debugProtection: false,
  disableConsoleOutput: false,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: false,
  selfDefending: false,
  simplify: true,
  splitStrings: false,
  stringArray: false,
  transformObjectKeys: true,
  unicodeEscapeSequence: false,
  target: 'browser',
};

const files = readdirSync(DIST).filter((f) => extname(f) === '.js');

console.log(`[obfuscate] Processing ${files.length} JS bundle(s)...`);

let totalBefore = 0;
let totalAfter = 0;

for (const file of files) {
  const filePath = join(DIST, file);
  const code = readFileSync(filePath, 'utf-8');
  const before = code.length;
  totalBefore += before;

  try {
    const result = JavaScriptObfuscator.obfuscate(code, OBFUSCATION_OPTIONS);
    const obfuscated = result.getObfuscatedCode();
    const after = obfuscated.length;
    totalAfter += after;

    writeFileSync(filePath, obfuscated, 'utf-8');
    console.log(`  [obfuscate] ${file}: ${(before / 1024).toFixed(0)}KB -> ${(after / 1024).toFixed(0)}KB`);
  } catch (err) {
    console.error(`  [obfuscate] FAILED on ${file}: ${err.message}`);
    totalAfter += before;
  }
}

console.log(`[obfuscate] Done. Total: ${(totalBefore / 1024).toFixed(0)}KB -> ${(totalAfter / 1024).toFixed(0)}KB`);
