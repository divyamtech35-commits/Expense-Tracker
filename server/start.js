import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const builtIndex = resolve(projectRoot, 'dist', 'index.html');

if (!existsSync(builtIndex)) {
  console.log('Frontend build is missing; building it before starting Express.');
  await build({ root: projectRoot, configFile: resolve(projectRoot, 'vite.config.js') });
}

if (!existsSync(builtIndex)) throw new Error('Frontend build did not produce dist/index.html.');
await import('./index.js');
