const mongoose = require('mongoose');

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
  category: { 
    type: String, 
    enum: ['AC Sleeper', 'Volvo', 'Non-AC'], 
    default: 'AC Sleeper' 
  },
  type: { type: String, default: '2+1 Executive AC Sleeper' },
  price: { type: Number, required: true },
  totalSeats: { type: Number, default: 24 },
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