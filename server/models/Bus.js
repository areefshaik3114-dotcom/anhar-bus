const mongoose = require('mongoose');

const SeatDetailSchema = new mongoose.Schema({
  seatNumber: { type: Number, required: true },
  seatLabel: { type: String, required: true }, // e.g. "L1", "U5", "S12"
  deck: { type: String, enum: ['LOWER', 'UPPER', 'SINGLE'], default: 'LOWER' },
  row: { type: Number, default: 1 },
  col: { type: Number, default: 1 }, // 1 = Left Window, 2 = Right Aisle, 3 = Right Window (or 1,2 | 3,4 for 2+2)
  side: { type: String, enum: ['LEFT', 'RIGHT'], default: 'RIGHT' },
  type: { type: String, enum: ['SEATER', 'PUSHBACK', 'SLEEPER'], default: 'SEATER' },
  price: { type: Number, required: true }
});

const BusSchema = new mongoose.Schema({
  operatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  name: { type: String, required: true },
  busNumber: { type: String, required: true },
  operatorPhone: { type: String, required: true },
  source: { type: String, required: true },
  destination: { type: String, required: true },
  departure: { type: String, required: true },
  departureHour: { type: Number, required: true },
  departureDate: {
    type: Date,
    required: true,
    index: true
  },
  arrival: { type: String, required: true },
  duration: { type: String, default: '8h 30m' },
  layoutType: {
    type: String,
    enum: ['MIXED_SEATER_SLEEPER', 'ALL_SLEEPER', 'PUSHBACK_ONLY', 'SEATER_ONLY'],
    default: 'MIXED_SEATER_SLEEPER'
  },
  acType: {
    type: String,
    enum: ['AC', 'NON_AC'],
    default: 'AC'
  },
  category: { type: String, default: 'AC Sleeper + Seater' },
  type: { type: String, default: '2+1 Executive Sleeper & Seater' },
  price: { type: Number, required: true },
  totalSeats: { type: Number, default: 30 },
  lowerCount: { type: Number, default: 15 },
  upperCount: { type: Number, default: 15 },
  seats: [SeatDetailSchema],
  boardingPoints: [
    { name: String, timeOffset: String }
  ],
  droppingPoints: [
    { name: String, timeOffset: String }
  ],
  viaStops: [{ type: String }],
  status: {
    type: String,
    enum: ['active', 'cancelled', 'completed'],
    default: 'active',
    index: true
  },
  isActive: { type: Boolean, default: true, index: true },
  createdAt: { type: Date, default: Date.now }
});

BusSchema.index({ source: 1, destination: 1, departureDate: 1, isActive: 1, status: 1 });

module.exports = mongoose.model('Bus', BusSchema);
