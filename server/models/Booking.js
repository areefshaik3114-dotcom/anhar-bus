const mongoose = require('mongoose');

const PassengerSchema = new mongoose.Schema({
  seatNumber: { type: Number, required: true },
  name: { type: String, required: true },
  age: { type: Number, required: true },
  gender: { type: String, enum: ['Male', 'Female', 'Other'], required: true }
});

const BookingSchema = new mongoose.Schema({
  pnr: { type: String, required: true, unique: true },
  busId: { type: Number, required: true },
  busName: { type: String, required: true },
  busNumber: { type: String, default: 'AP 04 TX 9924' },
  route: { type: String, required: true },
  departure: { type: String, required: true },
  arrival: { type: String, default: '06:00' },
  journeyDate: { type: String, required: true },
  boarding: { type: String, required: true },
  dropping: { type: String, required: true },
  unitPrice: { type: Number, required: true },
  passengers: [PassengerSchema],
  contact: {
    phone: { type: String, required: true },
    email: { type: String, required: true }
  },
  baseFare: { type: Number, required: true },
  gstAmount: { type: Number, default: 0 },
  totalPaid: { type: Number, required: true },
  walletDeducted: { type: Number, default: 0 },
  paymentMethod: { type: String, default: 'UPI' },
  status: {
    type: String,
    enum: ['CONFIRMED', 'PARTIALLY_RESOLD', 'ALL_RESOLD', 'VERIFIED_RESALE_TICKET'],
    default: 'CONFIRMED'
  }
}, { timestamps: true });

module.exports = mongoose.model('Booking', BookingSchema);