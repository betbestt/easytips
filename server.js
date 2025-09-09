const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
const dotenv = require("dotenv");

dotenv.config();
const app = express();
app.use(bodyParser.json());
app.use(express.static("public")); // serve HTML files from /public

// Get access token
async function getToken() {
  const url = "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";
  const auth = Buffer.from(`${process.env.CONSUMER_KEY}:${process.env.CONSUMER_SECRET}`).toString("base64");
  
  const response = await axios.get(url, {
    headers: { Authorization: `Basic ${auth}` },
  });
  return response.data.access_token;
}

// Payment route
app.post("/api/pay", async (req, res) => {
  try {
    const { phone, plan } = req.body;

    let amount = 0;
    if (plan === "basic") amount = 200;
    else if (plan === "standard") amount = 500;
    else if (plan === "premium") amount = 1000;

    const token = await getToken();
    const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
    const password = Buffer.from(`${process.env.BUSINESS_SHORTCODE}${process.env.LIPA_NA_MPESA_PASSKEY}${timestamp}`).toString("base64");

    const payload = {
      BusinessShortCode: process.env.BUSINESS_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: amount,
      PartyA: `254${phone.slice(-9)}`, // customer phone
      PartyB: process.env.BUSINESS_SHORTCODE, // Paybill
      PhoneNumber: `254${phone.slice(-9)}`,
      CallBackURL: process.env.CALLBACK_URL,
      AccountReference: "8912690011",
      TransactionDesc: `Payment for ${plan} EasyTips`,
    };

    await axios.post(
      "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
      payload,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    res.json({ success: true, message: "STK push sent to your phone. Enter PIN to confirm." });
  } catch (error) {
    console.error(error.response?.data || error.message);
    res.status(500).json({ success: false, message: "Payment failed" });
  }
});

app.listen(process.env.PORT, () => {
  console.log(`Server running on port ${process.env.PORT}`);
});
