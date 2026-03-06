const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    fullName: { type: String, required: true },
    phone: { type: String, required: true, unique: true }, // Ensure this is unique
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    referralCode: { type: String },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', userSchema);