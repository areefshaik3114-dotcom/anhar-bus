const mongoose = require('mongoose');

const SeatDetailSchema = new mongoose.Schema({
  seatNumber: { type: Number, required: true },
  seatLabel: { type: String, required: true }, // e.g. "L1", "U5", "S12"
  deck: { type: String, enum: ['LOWER', 'UPPER', 'SINGLE'], default: 'LOWER' },
  side: { type: String, enum: ['LEFT', 'RIGHT'], default: 'RIGHT' }, // RIGHT = Driver Side in India
  type: { type: String, enum: ['SEATER', 'PUSHBACK', 'SLEEPER'], default: 'SEATER' },
  price: { type: Number, required: true }
});

const BusSchema = new mongoose.Schema({
  name: { type: String, required: true },
  busNumber: { type: String, required: true },
  operatorPhone: { type: String, required: true },
  source: { type: String, required: true },
  destination: { type: String, required: true },
  departure: { type: String, required: true },
  departureHour: { type: Number, required: true },
  arrival: { type: String, required: true },
  duration: { type: String, default: '8h 30m' },
  layoutType: { 
    type: String, 
    enum: ['MIXED_SEATER_SLEEPER', 'ALL_SLEEPER', 'PUSHBACK_ONLY', 'SEATER_ONLY'], 
    default: 'MIXED_SEATER_SLEEPER' 
  },
  category: { type: String, default: 'Mixed Seater & Sleeper' },
  type: { type: String, default: '2+1 Executive AC Sleeper' },
  price: { type: Number, required: true }, // Base minimum display fare
  totalSeats: { type: Number, default: 30 },
  seats: [SeatDetailSchema],
  boardingPoints: [
    { name: String, timeOffset: String }
  ],
  droppingPoints: [
    { name: String, timeOffset: String }
  ],
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Bus', BusSchema);