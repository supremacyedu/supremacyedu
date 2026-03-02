const twilio = require("twilio");

module.exports = async function sendWhatsApp(phone, receiptUrl) {

  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

  await client.messages.create({
    from: process.env.TWILIO_WHATSAPP_NUMBER,
    to: `whatsapp:+91${phone}`,
    body: `Payment Successful ✅

Download your receipt:
${receiptUrl}

Thank you.`
  });
};