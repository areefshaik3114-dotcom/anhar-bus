const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true },
    walletBalance: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', UserSchema);