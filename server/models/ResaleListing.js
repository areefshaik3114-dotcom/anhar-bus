const mongoose = require('mongoose');

const ResaleListingSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    busId: { type: Number, required: true },
    busName: { type: String },
    busNumber: { type: String },
    route: { type: String },
    date: { type: String },
    time: { type: String },
    cutoffTimestamp: { type: Number },
    boarding: { type: String },
    dropping: { type: String },
    seatNumber: { type: Number, required: true },
    originalPrice: { type: Number },
    resalePrice: { type: Number, required: true },
    sellerPnr: { type: String },
    sellerName: { type: String },
    sellerPhone: { type: String, required: true }, // <-- MUST BE PRESENT
    status: { type: String, default: 'AVAILABLE' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('ResaleListing', ResaleListingSchema);