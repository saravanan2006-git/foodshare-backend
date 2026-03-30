const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * Send email notification to an NGO about a new food listing
 */
const sendFoodAvailableEmail = async ({ to, ngoName, foodType, quantity, donorName, location, expiryTime, foodId }) => {
  const subject = `🍲 New Food Available Near You! - ${foodType}`;
  const expiryFormatted = new Date(expiryTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
      .container { max-width: 600px; margin: 30px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
      .header { background: linear-gradient(135deg, #22c55e, #16a34a); padding: 30px; text-align: center; color: white; }
      .header h1 { margin: 0; font-size: 26px; }
      .header p { margin: 8px 0 0; opacity: 0.9; font-size: 14px; }
      .body { padding: 30px; }
      .info-card { background: #f8fafc; border-left: 4px solid #22c55e; border-radius: 8px; padding: 16px; margin: 12px 0; }
      .info-card label { font-size: 12px; color: #64748b; text-transform: uppercase; font-weight: bold; }
      .info-card p { margin: 4px 0 0; font-size: 16px; color: #1e293b; font-weight: 600; }
      .cta { display: block; margin: 24px auto; background: linear-gradient(135deg, #22c55e, #16a34a); color: white; text-decoration: none; padding: 14px 30px; border-radius: 8px; text-align: center; font-size: 16px; font-weight: bold; width: fit-content; }
      .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>🍲 Food Available Near You!</h1>
        <p>Smart Food Waste Management - Quick Action Required</p>
      </div>
      <div class="body">
        <p>Dear <strong>${ngoName}</strong>,</p>
        <p>There is surplus food available near you that needs to be collected before it expires. Please act quickly!</p>
        
        <div class="info-card">
          <label>Food Item</label>
          <p>${foodType}</p>
        </div>
        <div class="info-card">
          <label>Quantity</label>
          <p>${quantity}</p>
        </div>
        <div class="info-card">
          <label>Donor / Organization</label>
          <p>${donorName}</p>
        </div>
        <div class="info-card">
          <label>Pickup Location</label>
          <p>${location}</p>
        </div>
        <div class="info-card">
          <label>⏰ Expires At</label>
          <p style="color: #ef4444;">${expiryFormatted}</p>
        </div>
        
        <a href="http://localhost:5173/food/${foodId}" class="cta">Accept This Request →</a>
        
        <p style="color: #64748b; font-size: 13px; text-align: center; margin-top: 20px;">
          Please accept within the app. First-come first-served basis.
        </p>
      </div>
      <div class="footer">
        <p>Smart Food Waste Management System | Reducing Waste, Feeding Lives</p>
        <p>You received this because you are registered as an NGO in our system.</p>
      </div>
    </div>
  </body>
  </html>
  `;

  if (!process.env.EMAIL_USER || process.env.EMAIL_USER === 'youremail@gmail.com') {
    console.log(`📧 [MOCK EMAIL] To: ${to} | Subject: ${subject}`);
    return { mock: true, message: 'Email simulated (configure EMAIL_USER in .env)' };
  }

  return await transporter.sendMail({
    from: `"Food Waste Management" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
};

/**
 * Send acceptance confirmation email to donor
 */
const sendAcceptanceEmail = async ({ to, donorName, ngoName, foodType, pickupTime }) => {
  const subject = `✅ Your Food Donation Accepted - ${ngoName}`;
  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <style>
      body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
      .container { max-width: 600px; margin: 30px auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
      .header { background: linear-gradient(135deg, #3b82f6, #1d4ed8); padding: 30px; text-align: center; color: white; }
      .header h1 { margin: 0; font-size: 26px; }
      .body { padding: 30px; }
      .footer { background: #f8fafc; padding: 20px; text-align: center; font-size: 12px; color: #94a3b8; }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="header">
        <h1>✅ Food Donation Accepted!</h1>
      </div>
      <div class="body">
        <p>Dear <strong>${donorName}</strong>,</p>
        <p>Great news! <strong>${ngoName}</strong> has accepted your food donation of <strong>${foodType}</strong>.</p>
        <p>Please have the food ready for pickup. The NGO will collect it as soon as possible.</p>
        <p>Thank you for your generous contribution to reducing food waste! 🌱</p>
      </div>
      <div class="footer">
        <p>Smart Food Waste Management System</p>
      </div>
    </div>
  </body>
  </html>
  `;

  if (!process.env.EMAIL_USER || process.env.EMAIL_USER === 'youremail@gmail.com') {
    console.log(`📧 [MOCK EMAIL] To: ${to} | Subject: ${subject}`);
    return { mock: true };
  }

  return await transporter.sendMail({
    from: `"Food Waste Management" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
};

module.exports = { sendFoodAvailableEmail, sendAcceptanceEmail };
