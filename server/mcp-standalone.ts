// Simple launcher script that executes the appropriate server
import { spawn } from 'child_process';
import { existsSync } from 'fs';

console.log('Sky IQ MCP Standalone launcher...');

// Try the compiled JavaScript first
if (existsSync('dist/index.js')) {
  console.log('Starting compiled JavaScript server...');
  const child = spawn('node', ['dist/index.js'], { 
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' }
  });
  process.exit(0);
}

// Fallback to the main TypeScript server with tsx
if (existsSync('server/index.ts')) {
  console.log('Starting TypeScript server with tsx...');
  const child = spawn('npx', ['tsx', 'server/index.ts'], { 
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'production' }
  });
  process.exit(0);
}

console.error('No valid server found to start');
process.exit(1);