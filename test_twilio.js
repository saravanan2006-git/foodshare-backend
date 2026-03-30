require('dotenv').config();
const { sendFoodAvailableSMS } = require('./services/smsService');

async function testTwilio() {
  try {
    console.log('Sending direct diagnostic SMS to +918637631239 via Twilio...');
    
    const result = await sendFoodAvailableSMS({
      to: '+918637631239',
      ngoName: 'Twilio Tester',
      foodType: '100 Plates Pulao',
      quantity: '100',
      location: 'Bangalore Center',
      expiryTime: new Date().toISOString()
    });
    
    console.log('✅ Twilio Success Payload:', result);
  } catch(error) {
    console.log('\n❌ TWILIO CRASHED! Here is the exact reason from Twilio:');
    console.log('Error Message:', error.message);
    console.log('Error Code:', error.code);
    console.log('More Info:', error.moreInfo);
  }
}

testTwilio();
