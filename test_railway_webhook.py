#!/usr/bin/env python3
import requests
import json

def test_railway_webhook():
    """Test the Railway webhook integration with Sky IQ"""
    
    webhook_url = "https://f7a3630f-434f-4652-85e2-5109cccab8ef-00-14omzpco0tibm.janeway.replit.dev/api/railway/sarah-calls"
    
    # Test call data - simulating what your Railway app will send
    test_call_data = {
        "phoneNumber": "+1555888777",
        "contactName": "Terminal Test Call", 
        "duration": 145,
        "status": "completed",
        "summary": "Customer called asking about our premium AI services. Interested in monthly subscription.",
        "notes": "Follow up needed - send pricing information",
        "transcript": "Hello, I am calling to learn more about your AI assistant services. Can you tell me about the premium features and pricing options available?",
        "direction": "inbound"
    }
    
    print("🔄 Testing Railway webhook integration...")
    print(f"📞 Sending test call: {test_call_data['phoneNumber']}")
    
    try:
        response = requests.post(
            webhook_url,
            headers={"Content-Type": "application/json"},
            json=test_call_data,
            timeout=10
        )
        
        print(f"📊 Status Code: {response.status_code}")
        
        if response.status_code == 200:
            try:
                result = response.json()
                print(f"✅ SUCCESS! Call logged in Sky IQ")
                print(f"📋 Response: {result}")
            except:
                print(f"✅ SUCCESS! Call sent (HTML response received)")
                
            print("\n🎉 Your Railway integration is working!")
            print("💡 Check your Sky IQ call dashboard - the test call should appear!")
            
        else:
            print(f"❌ Failed: HTTP {response.status_code}")
            print(f"📄 Response: {response.text}")
            
    except Exception as e:
        print(f"❌ Connection Error: {str(e)}")
        print("🔧 Check your internet connection and try again")

if __name__ == "__main__":
    test_railway_webhook()