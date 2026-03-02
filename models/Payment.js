const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  name: String,
  phone: String,
  referrerId: String,
  kitFee: Number,
  paymentId: String,
  orderId: String,
  status: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Payment", paymentSchema);