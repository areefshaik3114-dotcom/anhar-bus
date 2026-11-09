const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const Booking = require('./models/Booking');
const ResaleListing = require('./models/ResaleListing');
const User = require('./models/User');

const app = express();

// Allowed Origins (Production Vercel + Local Development)
const allowedOrigins = [
  'https://anhar-bus.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.CLIENT_URL
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, curl, or Postman)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true);
      } else {
        return callback(null, true); // Fallback allow to prevent deployment blocks
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

app.use(express.json());

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log(' Connected to MongoDB Atlas successfully!'))
  .catch((err) => console.error(' MongoDB Connection Error:', err.message));

// Health check
app.get('/', (req, res) => {
  res.send('ANHAR BUS Backend Server is live!');
});

// 1. Fetch all bookings
app.get('/api/bookings', async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 });
    res.json({ success: true, bookings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 2. Save a new booking
app.post('/api/bookings', async (req, res) => {
  try {
    const newBooking = await Booking.create(req.body);
    res.status(201).json({ success: true, booking: newBooking });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 3. Fetch active resale listings
app.get('/api/resale', async (req, res) => {
  try {
    const listings = await ResaleListing.find({ status: 'AVAILABLE' }).sort({ createdAt: -1 });
    res.json({ success: true, listings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 4. Create resale listings
app.post('/api/resale', async (req, res) => {
  try {
    const { listings, updatedBookings } = req.body;
    if (listings && Array.isArray(listings)) {
      await ResaleListing.insertMany(listings);
    }
    if (updatedBookings && Array.isArray(updatedBookings)) {
      for (const b of updatedBookings) {
        await Booking.findOneAndUpdate({ pnr: b.pnr }, b);
      }
    }
    res.status(201).json({ success: true, message: 'Resale listings published' });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 5. Purchase a resale ticket & credit seller directly in MongoDB
app.post('/api/resale/buy', async (req, res) => {
  try {
    const { resaleId, buyerBooking } = req.body;

    const item = await ResaleListing.findOne({ id: resaleId, status: 'AVAILABLE' });
    if (!item) {
      return res.status(404).json({ success: false, message: 'Resale seat not available.' });
    }
    if (Date.now() >= item.cutoffTimestamp) {
      item.status = 'EXPIRED';
      await item.save();
      return res.status(400).json({ success: false, message: 'Resale window closed.' });
    }

    item.status = 'SOLD';
    await item.save();

    // Create the buyer's new confirmed booking
    const createdTicket = await Booking.create(buyerBooking);

    // Credit seller's wallet directly in MongoDB
    const sellerPhone = item.sellerPhone;
    if (sellerPhone) {
      await User.findOneAndUpdate(
        { phone: sellerPhone },
        { $inc: { walletBalance: Number(item.resalePrice) } },
        { upsert: true }
      );
    }

    res.status(201).json({ success: true, booking: createdTicket });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Get or create user wallet in MongoDB Atlas (starts at 0)
app.get('/api/wallet/:phone', async (req, res) => {
  try {
    let user = await User.findOne({ phone: req.params.phone });
    if (!user) {
      user = await User.create({ phone: req.params.phone, walletBalance: 0 });
    }
    res.json({ success: true, balance: user.walletBalance });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 7. Update user wallet balance (Top-up or Deduct)
app.post('/api/wallet/update', async (req, res) => {
  try {
    const { phone, amount } = req.body;
    const user = await User.findOneAndUpdate(
      { phone },
      { $inc: { walletBalance: Number(amount) } },
      { new: true, upsert: true }
    );
    res.json({ success: true, balance: user.walletBalance });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(` ANHAR BUS Server live on port ${PORT}`);
});