#!/usr/bin/env node

/**
 * Standalone JavaScript runner for deployment environments
 * This file can run the application without TypeScript compilation
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('Sky IQ Standalone Runner starting...');

// Check for available startup methods
const methods = [
  {
    name: 'Compiled JavaScript (main)',
    check: () => fs.existsSync('dist/index.js'),
    run: () => spawn('node', ['dist/index.js'], { stdio: 'inherit' })
  },
  {
    name: 'Standalone MCP Server',
    check: () => fs.existsSync('server/mcp-standalone.ts'),
    run: () => spawn('node', ['server/mcp-standalone.ts'], { stdio: 'inherit' })
  },
  {
    name: 'TypeScript with tsx (main)',
    check: () => fs.existsSync('server/index.ts'),
    run: () => spawn('npx', ['tsx', 'server/index.ts'], { stdio: 'inherit' })
  },
  {
    name: 'NPM start',
    check: () => fs.existsSync('package.json'),
    run: () => spawn('npm', ['start'], { stdio: 'inherit' })
  }
];

// Try each method until one works
for (const method of methods) {
  if (method.check()) {
    console.log(`Starting with method: ${method.name}`);
    const child = method.run();
    
    child.on('error', (error) => {
      console.error(`Error with ${method.name}:`, error.message);
    });
    
    child.on('exit', (code) => {
      if (code === 0) {
        console.log(`${method.name} exited successfully`);
        process.exit(0);
      } else {
        console.log(`${method.name} exited with code ${code}, trying next method...`);
      }
    });
    
    // If the process starts successfully, wait for it
    break;
  }
}

console.error('All startup methods failed. Please check your deployment configuration.');
process.exit(1);