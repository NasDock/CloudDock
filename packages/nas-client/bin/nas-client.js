#!/usr/bin/env node

/**
 * NAS Client CLI Entry Point
 * This is the executable that gets installed globally via npm
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Find the TypeScript source
const srcPath = join(__dirname, '../dist/index.js');

const child = spawn('node', [srcPath, ...process.argv.slice(2)], {
  stdio: 'inherit',
  shell: process.platform === 'win32'
});

child.on('exit', (code) => {
  process.exit(code ?? 0);
});
