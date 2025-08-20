#!/usr/bin/env node

/**
 * Backend Admin Interface Examples
 * Use these examples to manage user accounts without client interaction
 */

const API_BASE = 'http://localhost:5000';

// Helper function to make API requests
async function makeRequest(endpoint, method = 'GET', data = null) {
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    }
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  try {
    const response = await fetch(`${API_BASE}${endpoint}`, options);
    const result = await response.json();
    
    if (!response.ok) {
      console.error(`❌ Error: ${result.message}`);
      return null;
    }
    
    return result;
  } catch (error) {
    console.error(`❌ Request failed: ${error.message}`);
    return null;
  }
}

// 1. Get all users with their Twilio status
async function getAllUsersWithTwilioStatus() {
  console.log('🔍 Fetching all users with Twilio status...');
  const result = await makeRequest('/admin/users');
  
  if (result) {
    console.log(`✅ Found ${result.count} users:`);
    result.users.forEach(user => {
      console.log(`
📧 ${user.email} (ID: ${user.id})
🏢 Business: ${user.businessName || 'Not set'}
📞 Twilio: ${user.twilioConfigured ? '✅ Connected' : '❌ Not configured'}
${user.twilioPhone ? `📱 Phone: ${user.twilioPhone}` : ''}
📅 Created: ${new Date(user.createdAt).toLocaleDateString()}
      `);
    });
  }
}

// 2. Setup Twilio integration for a specific user
async function setupTwilioForUser(userId, accountSid, authToken, phoneNumber) {
  console.log(`🔧 Setting up Twilio for user ${userId}...`);
  
  const result = await makeRequest(`/admin/users/${userId}/twilio/setup`, 'POST', {
    accountSid,
    authToken,
    phoneNumber
  });
  
  if (result && result.success) {
    console.log(`✅ ${result.message}`);
    console.log(`📱 Phone number: ${result.user.phoneNumber}`);
  }
}

// 3. Get available phone numbers for a user's Twilio account
async function getUserTwilioNumbers(userId, accountSid, authToken) {
  console.log(`📞 Fetching Twilio numbers for user ${userId}...`);
  
  const result = await makeRequest(`/admin/users/${userId}/twilio/numbers`, 'POST', {
    accountSid,
    authToken
  });
  
  if (result) {
    console.log(`✅ ${result.message}`);
    if (result.phoneNumbers.length > 0) {
      console.log('Available phone numbers:');
      result.phoneNumbers.forEach((number, index) => {
        console.log(`  ${index + 1}. ${number}`);
      });
    } else {
      console.log('No phone numbers found in this Twilio account.');
    }
  }
}

// 4. Get user's current Twilio configuration
async function getUserTwilioConfig(userId) {
  console.log(`🔍 Getting Twilio config for user ${userId}...`);
  
  const result = await makeRequest(`/admin/users/${userId}/twilio/config`);
  
  if (result) {
    console.log(`✅ ${result.message}`);
    console.log(`📧 Email: ${result.user.email}`);
    console.log(`🏢 Business: ${result.user.businessName}`);
    console.log(`📞 Twilio configured: ${result.twilioConfig.configured ? 'Yes' : 'No'}`);
    if (result.twilioConfig.configured) {
      console.log(`📱 Phone: ${result.twilioConfig.phoneNumber}`);
      console.log(`🔑 Account SID: ${result.twilioConfig.accountSid}`);
    }
  }
}

// 5. Remove Twilio integration for a user
async function removeTwilioForUser(userId) {
  console.log(`🗑️ Removing Twilio integration for user ${userId}...`);
  
  const result = await makeRequest(`/admin/users/${userId}/twilio`, 'DELETE');
  
  if (result && result.success) {
    console.log(`✅ ${result.message}`);
  }
}

// 6. Get call statistics for all users
async function getCallStatistics() {
  console.log('📊 Fetching call statistics...');
  
  const result = await makeRequest('/admin/calls/stats');
  
  if (result) {
    console.log(`✅ ${result.message}`);
    console.log(`
📈 PLATFORM STATISTICS:
👥 Total Users: ${result.stats.totalUsers}
📞 Total Calls: ${result.stats.totalCalls}
📅 Recent Calls (7 days): ${result.stats.recentCalls}
    `);
    
    console.log('📊 USER BREAKDOWN:');
    result.stats.userStats.forEach(user => {
      console.log(`
📧 ${user.email}
🏢 ${user.businessName}
📞 Total Calls: ${user.totalCalls}
📅 Recent Calls: ${user.recentCalls}
      `);
    });
  }
}

// Example usage and help
function showHelp() {
  console.log(`
🔧 SKY IQ BACKEND ADMIN INTERFACE
═══════════════════════════════════════

Available commands:

📋 LIST USERS:
node admin-examples.js users

📊 CALL STATISTICS:
node admin-examples.js stats

🔍 USER TWILIO CONFIG:
node admin-examples.js config <userId>

📞 USER TWILIO NUMBERS:
node admin-examples.js numbers <userId> <accountSid> <authToken>

⚙️ SETUP TWILIO:
node admin-examples.js setup <userId> <accountSid> <authToken> <phoneNumber>

🗑️ REMOVE TWILIO:
node admin-examples.js remove <userId>

Examples:
---------
node admin-examples.js users
node admin-examples.js stats
node admin-examples.js config 1
node admin-examples.js setup 1 ACxxxx your_auth_token +15551234567
node admin-examples.js remove 1

Note: Replace <accountSid>, <authToken>, and <phoneNumber> with actual values
  `);
}

// Command line interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'users':
      await getAllUsersWithTwilioStatus();
      break;
      
    case 'stats':
      await getCallStatistics();
      break;
      
    case 'config':
      if (!args[1]) {
        console.error('❌ Missing userId. Usage: node admin-examples.js config <userId>');
        return;
      }
      await getUserTwilioConfig(parseInt(args[1]));
      break;
      
    case 'numbers':
      if (!args[1] || !args[2] || !args[3]) {
        console.error('❌ Missing parameters. Usage: node admin-examples.js numbers <userId> <accountSid> <authToken>');
        return;
      }
      await getUserTwilioNumbers(parseInt(args[1]), args[2], args[3]);
      break;
      
    case 'setup':
      if (!args[1] || !args[2] || !args[3] || !args[4]) {
        console.error('❌ Missing parameters. Usage: node admin-examples.js setup <userId> <accountSid> <authToken> <phoneNumber>');
        return;
      }
      await setupTwilioForUser(parseInt(args[1]), args[2], args[3], args[4]);
      break;
      
    case 'remove':
      if (!args[1]) {
        console.error('❌ Missing userId. Usage: node admin-examples.js remove <userId>');
        return;
      }
      await removeTwilioForUser(parseInt(args[1]));
      break;
      
    default:
      showHelp();
      break;
  }
}

// Only run if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script error:', error.message);
    process.exit(1);
  });
}

module.exports = {
  getAllUsersWithTwilioStatus,
  setupTwilioForUser,
  getUserTwilioNumbers,
  getUserTwilioConfig,
  removeTwilioForUser,
  getCallStatistics
};