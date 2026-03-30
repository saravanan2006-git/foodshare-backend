const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'gokulsaravanan2019@gmail.com',
    pass: 'nvoacxywunhsdblt'
  }
});

console.log('Sending direct test email...');
transporter.sendMail({
  from: '"FoodShare System" <gokulsaravanan2019@gmail.com>',
  to: 'gandrakota.sai2023@vitstudent.ac.in',
  subject: 'Direct Delivery Test - FoodShare',
  html: '<h2>Hello from FoodShare!</h2><p>This is a direct test email completely bypassing the app logic.</p><p>If you see this, your email configuration works flawlessly.</p>'
}).then(info => {
  console.log('✅ Message successfully delivered to SMTP server!');
  console.log('Message ID:', info.messageId);
}).catch(err => {
  console.error('❌ SEND ERROR:', err.message);
});
