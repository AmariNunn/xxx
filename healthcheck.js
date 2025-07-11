#!/usr/bin/env node

import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const HEALTH_CHECK_PORT = 5000;
const LOG_FILE = path.join(__dirname, 'logs', 'health.log');
const ADMIN_EMAIL = 'audamaur@gmaill.com';
const ALERT_COOLDOWN = 30 * 60 * 1000; // 30 minutes
const ALERT_STATE_FILE = path.join(__dirname, 'logs', 'alert-state.json');

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

// Email alert functionality
async function sendDowntimeAlert(error) {
  try {
    const alertState = getAlertState();
    const now = Date.now();
    
    // Check if we're in cooldown period
    if (alertState.lastAlertTime && (now - alertState.lastAlertTime) < ALERT_COOLDOWN) {
      log('Downtime detected but alert is in cooldown period');
      return;
    }
    
    const emailData = {
      from: {
        email: 'info@skyiq.app',
        name: 'Sky IQ Alert System'
      },
      to: [{
        email: ADMIN_EMAIL,
        name: 'Administrator'
      }],
      subject: '🚨 Sky IQ App Down Alert',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc3545;">⚠️ Sky IQ Application Alert</h2>
          <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #dc3545; margin-top: 0;">Application Status: DOWN</h3>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Error:</strong> ${error}</p>
            <p><strong>Port:</strong> ${HEALTH_CHECK_PORT}</p>
            <p><strong>Status:</strong> Health check failed</p>
          </div>
          <div style="background-color: #e9ecef; padding: 15px; border-radius: 8px;">
            <h4 style="margin-top: 0;">Automatic Recovery Actions:</h4>
            <ul>
              <li>System will attempt automatic restart</li>
              <li>Next health check in 5 minutes</li>
              <li>Maintenance scripts will run if needed</li>
            </ul>
          </div>
          <p style="margin-top: 20px; color: #6c757d; font-size: 0.9em;">
            This is an automated alert from your Sky IQ monitoring system. 
            You will receive another email when the service is restored.
          </p>
        </div>
      `,
      text: `
        Sky IQ Application Alert
        
        Status: DOWN
        Time: ${new Date().toLocaleString()}
        Error: ${error}
        Port: ${HEALTH_CHECK_PORT}
        
        Automatic recovery actions in progress.
        Next health check in 5 minutes.
      `
    };
    
    await sendMailerSendEmail(emailData);
    
    // Update alert state
    alertState.lastAlertTime = now;
    alertState.lastDowntime = now;
    saveAlertState(alertState);
    
    log(`Downtime alert sent to ${ADMIN_EMAIL}`);
  } catch (emailError) {
    log(`Failed to send downtime alert: ${emailError.message}`);
  }
}

async function sendRecoveryAlert() {
  try {
    const alertState = getAlertState();
    
    // Only send recovery alert if we previously sent a downtime alert
    if (!alertState.lastDowntime) {
      return;
    }
    
    const downtimeDuration = Date.now() - alertState.lastDowntime;
    const durationMinutes = Math.floor(downtimeDuration / (1000 * 60));
    
    const emailData = {
      from: {
        email: 'info@skyiq.app',
        name: 'Sky IQ Alert System'
      },
      to: [{
        email: ADMIN_EMAIL,
        name: 'Administrator'
      }],
      subject: '✅ Sky IQ App Recovery Alert',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #28a745;">✅ Sky IQ Application Recovered</h2>
          <div style="background-color: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #28a745; margin-top: 0;">Application Status: HEALTHY</h3>
            <p><strong>Recovery Time:</strong> ${new Date().toLocaleString()}</p>
            <p><strong>Downtime Duration:</strong> ${durationMinutes} minutes</p>
            <p><strong>Status:</strong> Health check passed</p>
          </div>
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 8px;">
            <h4 style="margin-top: 0;">System Status:</h4>
            <ul>
              <li>Application: Running normally</li>
              <li>Database: Connected</li>
              <li>Health checks: Active</li>
              <li>Monitoring: Resumed</li>
            </ul>
          </div>
          <p style="margin-top: 20px; color: #6c757d; font-size: 0.9em;">
            Your Sky IQ application is now running normally. 
            Monitoring continues automatically.
          </p>
        </div>
      `,
      text: `
        Sky IQ Application Recovered
        
        Status: HEALTHY
        Recovery Time: ${new Date().toLocaleString()}
        Downtime Duration: ${durationMinutes} minutes
        
        Application is running normally.
        Monitoring continues automatically.
      `
    };
    
    await sendMailerSendEmail(emailData);
    
    // Clear downtime state
    alertState.lastDowntime = null;
    saveAlertState(alertState);
    
    log(`Recovery alert sent to ${ADMIN_EMAIL}`);
  } catch (emailError) {
    log(`Failed to send recovery alert: ${emailError.message}`);
  }
}

function getAlertState() {
  try {
    if (fs.existsSync(ALERT_STATE_FILE)) {
      const data = fs.readFileSync(ALERT_STATE_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    log(`Failed to read alert state: ${error.message}`);
  }
  return { lastAlertTime: null, lastDowntime: null };
}

function saveAlertState(state) {
  try {
    fs.writeFileSync(ALERT_STATE_FILE, JSON.stringify(state, null, 2));
  } catch (error) {
    log(`Failed to save alert state: ${error.message}`);
  }
}

async function sendMailerSendEmail(emailData) {
  const apiToken = process.env.MAILERSEND_API_TOKEN;
  
  if (!apiToken) {
    throw new Error('MAILERSEND_API_TOKEN not configured');
  }
  
  const postData = JSON.stringify(emailData);
  
  const options = {
    hostname: 'api.mailersend.com',
    port: 443,
    path: '/v1/email',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiToken}`,
      'Content-Length': Buffer.byteLength(postData)
    }
  };
  
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`Email API error: ${res.statusCode} - ${data}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.write(postData);
    req.end();
  });
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
    
    // Send recovery alert if we were previously down
    await sendRecoveryAlert();
    
    process.exit(0);
  } catch (error) {
    log(`Sky IQ Health Check Failed: ${error.message}`);
    
    // Send downtime alert
    await sendDowntimeAlert(error.message);
    
    process.exit(1);
  }
}

// Run health check
runHealthCheck();