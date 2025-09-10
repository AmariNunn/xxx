
const fetch = require('node-fetch');

async function testCallNotificationForUser3() {
  const callData = {
    userId: 3,
    phoneNumber: "+1234567890",
    contactName: "Test Caller",
    duration: 120, // 2 minutes
    status: "completed",
    summary: "Test call to verify email notifications are working",
    notes: "This is a test call for user 3 email notification system",
    direction: "inbound"
  };

  try {
    console.log("Creating test call for user 3...");
    
    const response = await fetch('http://localhost:5000/api/calls', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(callData)
    });

    if (response.ok) {
      const result = await response.json();
      console.log("✅ Test call created successfully!");
      console.log("Call ID:", result.id);
      console.log("📧 Email notification should have been sent to user 3's email address");
    } else {
      const error = await response.text();
      console.error("❌ Failed to create test call:", error);
    }
  } catch (error) {
    console.error("❌ Error testing call notification:", error);
  }
}

testCallNotificationForUser3();
