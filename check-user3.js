
#!/usr/bin/env node

const { storage } = require('./server/storage');

async function checkUser3() {
  try {
    console.log('👤 Checking User 3...');
    
    const user = await storage.getUser(3);
    if (!user) {
      console.log('❌ User 3 not found');
      return;
    }
    
    console.log('✅ User 3 found:', user.email);
    
    const businessInfo = await storage.getBusinessInfo(3);
    const calls = await storage.getCalls(3);
    
    console.log(`📊 Business Info: ${businessInfo ? 'Yes' : 'No'}`);
    console.log(`📞 Calls: ${calls.length} total`);
    
    if (businessInfo) {
      console.log(`🏢 Business: ${businessInfo.businessName}`);
      console.log(`📁 Files: ${businessInfo.fileNames?.length || 0}`);
      console.log(`🔗 Links: ${businessInfo.links?.length || 0}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkUser3();
