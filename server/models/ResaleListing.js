const mongoose = require('mongoose');

const ResaleListingSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  busId: String,
  busName: String,
  busNumber: String,
  route: String,
  date: String,
  time: String,
  cutoffTimestamp: Number,
  boarding: String,
  dropping: String,
  seatNumber: String,
  originalPrice: Number,
  resalePrice: Number,
  sellerPnr: String,
  sellerName: String,
  sellerPhone: String,
  status: { type: String, default: 'AVAILABLE' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ResaleListing', ResaleListingSchema);