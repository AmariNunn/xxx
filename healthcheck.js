#!/usr/bin/env node

import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HEALTH_CHECK_PORT = 5000;
const LOG_FILE = path.join(__dirname, 'logs', 'health.log');

// Ensure logs directory exists
const logsDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

function log(message) {
  const timestamp = new Date().toISOString();
  const logEntry = `${timestamp} - ${message}\n`;
  
  console.log(logEntry.trim());
  
  try {
    fs.appendFileSync(LOG_FILE, logEntry);
  } catch (err) {
    console.error('Failed to write to log file:', err);
  }
}

function checkHealth() {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: 'localhost',
      port: HEALTH_CHECK_PORT,
      path: '/',
      method: 'GET',
      timeout: 5000
    }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200 && data.includes('Sky IQ')) {
          resolve({
            status: 'healthy',
            statusCode: res.statusCode,
            responseTime: Date.now() - startTime
          });
        } else {
          reject(new Error(`Health check failed: Status ${res.statusCode}`));
        }
      });
    });
    
    const startTime = Date.now();
    
    req.on('error', (err) => {
      reject(new Error(`Health check error: ${err.message}`));
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Health check timeout'));
    });
    
    req.end();
  });
}

async function runHealthCheck() {
  try {
    const result = await checkHealth();
    log(`Sky IQ Health Check: ${result.status} (${result.responseTime}ms)`);
    process.exit(0);
  } catch (error) {
    log(`Sky IQ Health Check Failed: ${error.message}`);
    process.exit(1);
  }
}

// Run health check
runHealthCheck();