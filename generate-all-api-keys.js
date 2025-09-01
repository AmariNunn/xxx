#!/usr/bin/env node

/**
 * Generate API keys for all users in the database
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

async function generateApiKeysForAllUsers() {
  console.log('🔍 Fetching all users...');
  
  // Get all users
  const usersResult = await makeRequest('/admin/users');
  if (!usersResult) {
    console.error('❌ Failed to fetch users');
    return;
  }

  const users = usersResult.users;
  console.log(`✅ Found ${users.length} users`);

  // Generate API keys for each user
  const results = [];
  
  for (const user of users) {
    console.log(`\n🔑 Generating API key for ${user.email} (ID: ${user.id})...`);
    
    const apiKeyResult = await makeRequest(`/api/users/${user.id}/api-key/generate`, 'POST');
    
    if (apiKeyResult && apiKeyResult.success) {
      console.log(`✅ Generated: ${apiKeyResult.apiKey}`);
      results.push({
        userId: user.id,
        email: user.email,
        businessName: user.businessName,
        apiKey: apiKeyResult.apiKey,
        success: true
      });
    } else {
      console.log(`❌ Failed to generate API key for ${user.email}`);
      results.push({
        userId: user.id,
        email: user.email,
        businessName: user.businessName,
        apiKey: null,
        success: false
      });
    }
    
    // Small delay to avoid overwhelming the server
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  // Summary
  console.log('\n═══════════════════════════════════════');
  console.log('🔑 API KEY GENERATION SUMMARY');
  console.log('═══════════════════════════════════════');
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);
  
  console.log(`✅ Successfully generated: ${successful.length}`);
  console.log(`❌ Failed: ${failed.length}`);
  console.log(`📊 Total processed: ${results.length}`);
  
  if (successful.length > 0) {
    console.log('\n✅ SUCCESSFUL GENERATIONS:');
    successful.forEach(result => {
      console.log(`
📧 ${result.email}
🏢 ${result.businessName}
🔑 ${result.apiKey}
      `);
    });
  }
  
  if (failed.length > 0) {
    console.log('\n❌ FAILED GENERATIONS:');
    failed.forEach(result => {
      console.log(`📧 ${result.email} - Check logs for details`);
    });
  }
  
  console.log('\n🎉 API key generation complete!');
  console.log('📖 Clients can now use their API keys with external voice agent platforms');
  console.log('📋 Use CLIENT_API_DOCUMENTATION.md for integration instructions');
}

// Run the script
generateApiKeysForAllUsers().catch(error => {
  console.error('❌ Script error:', error.message);
  process.exit(1);
});