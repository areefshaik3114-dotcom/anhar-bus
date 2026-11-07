const mongoose = require('mongoose');

const ResaleListingSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  busId: { type: Number, required: true },
  busName: { type: String, required: true },
  busNumber: { type: String, default: 'AP 04 TX 9924' },
  route: { type: String, required: true },
  date: { type: String, required: true },
  time: { type: String, required: true },
  cutoffTimestamp: { type: Number, required: true },
  boarding: { type: String, required: true },
  dropping: { type: String, required: true },
  seatNumber: { type: Number, required: true },
  originalPrice: { type: Number, required: true },
  resalePrice: { 
    type: Number, 
    required: true,
    validate: {
      validator: function(v) {
        return v <= this.originalPrice + 50; // Max ₹50 markup
      },
      message: 'Markup cannot exceed ₹50'
    }
  },
  sellerPnr: { type: String, required: true },
  sellerName: { type: String, required: true },
  status: {
    type: String,
    enum: ['AVAILABLE', 'SOLD', 'EXPIRED'],
    default: 'AVAILABLE'
  }
}, { timestamps: true });

module.exports = mongoose.model('ResaleListing', ResaleListingSchema);