const axios = require('axios');

async function runTest() {
  try {
    const timestamp = Date.now();
    const ngoEmail = `gandrakota.sai_${timestamp}@vitstudent.ac.in`; // Add timestamp so it never says "already registered"

    console.log(`1. Registering NGO (${ngoEmail}) with your Twilio phone number...`);
    try {
      await axios.post('http://localhost:5000/api/auth/register', {
        name: 'Twilio Live Test NGO',
        email: ngoEmail,
        password: 'password123',
        role: 'ngo',
        phone: '+918637631239', // Exact verified phone number inserted here
        organization: 'Feeding Hands NGO',
        latitude: 12.9716,
        longitude: 77.5946,
        address: 'Bangalore Center'
      });
      console.log('✅ NGO Registered successfully');
    } catch(e) {
       console.log('⚠️ NGO registered error details:', e.response ? e.response.data : e.message);
    }

    console.log('\n2. Registering Donor exactly 0km away...');
    const donorEmail = 'dynamictwonor_' + timestamp + '@test.com';
    const donorRes = await axios.post('http://localhost:5000/api/auth/register', {
        name: 'Test Hotel Donor',
        email: donorEmail,
        password: 'password123',
        role: 'donor',
        phone: '1234567890', // Donor phone doesn't matter
        organization: 'Test Grand Hotel',
        latitude: 12.9716,
        longitude: 77.5946,
        address: 'Bangalore Center'
    });
    console.log('✅ Donor Registered successfully');
    
    console.log('\n3. Logging in as Donor to get Auth Token...');
    const loginRes = await axios.post('http://localhost:5000/api/auth/login', {
      email: donorEmail,
      password: 'password123'
    });
    const token = loginRes.data.token;
    console.log('✅ Token acquired');

    console.log('\n4. Live Firing Food API (Sending automated SMS now!)...');
    const foodRes = await axios.post('http://localhost:5000/api/food', {
      food_type: '100 Plates of Vegetable Pulao',
      quantity: 100,
      quantity_unit: 'servings',
      expiry_time: new Date(Date.now() + 5*60*60*1000).toISOString(),
      pickup_address: 'Bangalore Center',
      latitude: 12.9716,
      longitude: 77.5946
    }, {
      headers: { Authorization: 'Bearer ' + token }
    });
    
    console.log('\n===========================');
    console.log('✅ FOOD POST COMPLETED!');
    console.log('Backend Response Details:\n', foodRes.data);
    console.log('===========================');

  } catch(err) {
    console.error('ERROR OCCURRED:', err.response ? err.response.data : err.message);
  }
}

runTest();
