/**
 * SMS Service using Twilio
 * Falls back to mock/console logging if Twilio credentials not configured
 */

let twilioClient = null;

const initTwilio = () => {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (sid && token && !sid.startsWith('your_')) {
    try {
      twilioClient = require('twilio')(sid, token);
      console.log('✅ Twilio initialized');
    } catch (err) {
      console.warn('⚠️  Twilio init failed:', err.message);
    }
  } else {
    console.log('ℹ️  Twilio running in MOCK mode (configure TWILIO_* in .env)');
  }
};

initTwilio();

/**
 * Send SMS notification to an NGO about a new food available nearby
 */
const sendFoodAvailableSMS = async ({ to, ngoName, foodType, quantity, location, expiryTime }) => {
  // Add +91 country code to 10-digit Indian numbers if missing
  let formattedPhone = String(to).replace(/\D/g, ''); // strip non-numeric
  if (formattedPhone.length === 10) formattedPhone = `+91${formattedPhone}`;
  else if (!formattedPhone.startsWith('+')) formattedPhone = `+${formattedPhone}`;
  
  const expiry = new Date(expiryTime).toLocaleTimeString('en-IN', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
  });

  const message = `FOOD ALERT: ${foodType} (${quantity}) available near ${location}. Expires at ${expiry} IST. Open FoodShare app to accept.`;

  if (!twilioClient) {
    console.log(`📱 [MOCK SMS] To: ${formattedPhone} | Msg: ${message}`);
    return { mock: true, message: 'SMS simulated (configure Twilio in .env)' };
  }

  return await twilioClient.messages.create({
    body: message,
    from: process.env.TWILIO_PHONE,
    to: formattedPhone,
  });
};

/**
 * Notify a donor that their donation was accepted by an NGO
 */
const sendAcceptanceSMS = async ({ to, ngoName, foodType }) => {
  // Format phone number
  let formattedPhone = String(to).replace(/\D/g, '');
  if (formattedPhone.length === 10) formattedPhone = `+91${formattedPhone}`;
  else if (!formattedPhone.startsWith('+')) formattedPhone = `+${formattedPhone}`;

  const message = `✅ Your donation of ${foodType} has been accepted by ${ngoName}. Please prepare for pickup. - FoodShare`;

  if (!twilioClient) {
    console.log(`📱 [MOCK SMS] To: ${formattedPhone} | Msg: ${message}`);
    return { mock: true };
  }

  return await twilioClient.messages.create({
    body: message,
    from: process.env.TWILIO_PHONE,
    to: formattedPhone,
  });
};

module.exports = { sendFoodAvailableSMS, sendAcceptanceSMS };
