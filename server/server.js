const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const Booking = require('./models/Booking');
const ResaleListing = require('./models/ResaleListing');
const User = require('./models/User');

const app = express();

// Temporary in-memory OTP cache (phone -> { otp, expiresAt })
const otpStore = new Map();

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
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true);
      } else {
        return callback(null, true);
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

// 4. Create resale listings (Guarded against duplicate seat listings)
app.post('/api/resale', async (req, res) => {
  try {
    const { listings, updatedBookings } = req.body;

    if (listings && Array.isArray(listings)) {
      for (const item of listings) {
        // Prevent listing if this exact bus and seat is already live
        const existing = await ResaleListing.findOne({
          busId: item.busId,
          seatNumber: item.seatNumber,
          date: item.date,
          status: 'AVAILABLE'
        });

        if (!existing) {
          await ResaleListing.create(item);
        }
      }
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

    const createdTicket = await Booking.create(buyerBooking);

    // DIRECT MONGODB CREDIT TO SELLER ACCOUNT
    const targetPhone = item.sellerPhone || (item.contact && item.contact.phone);
    console.log(`[Resale Payout] Crediting ₹${item.resalePrice} to seller phone:`, targetPhone);

    if (targetPhone) {
      const cleanPhone = String(targetPhone).replace(/\D/g, '').slice(-10);
      const updatedUser = await User.findOneAndUpdate(
        { phone: cleanPhone },
        { $inc: { walletBalance: Number(item.resalePrice) } },
        { new: true, upsert: true }
      );
      console.log(`[Resale Payout Success] New balance for ${cleanPhone}: ₹${updatedUser.walletBalance}`);
    } else {
      console.error('[Resale Payout Warning] No valid seller phone found on this listing item!');
    }

    res.status(201).json({ success: true, booking: createdTicket });
  } catch (err) {
    console.error('[Resale Payout Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 6. Get or create user wallet in MongoDB Atlas
app.get('/api/wallet/:phone', async (req, res) => {
  try {
    const cleanPhone = String(req.params.phone).replace(/\D/g, '').slice(-10);
    let user = await User.findOne({ phone: cleanPhone });
    if (!user) {
      user = await User.create({ phone: cleanPhone, walletBalance: 0 });
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
    const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
    const user = await User.findOneAndUpdate(
      { phone: cleanPhone },
      { $inc: { walletBalance: Number(amount) } },
      { new: true, upsert: true }
    );
    res.json({ success: true, balance: user.walletBalance });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 8. Generate & Send Real SMS OTP to Indian Mobile Numbers via Fast2SMS Quick Route
app.post('/api/auth/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);

    if (cleanPhone.length !== 10) {
      return res.status(400).json({ success: false, message: 'Invalid 10-digit mobile number.' });
    }

    // Generate random 4-digit code
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    otpStore.set(cleanPhone, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });

    console.log(`[SMS OTP Generated] Phone: +91 ${cleanPhone} | OTP: ${otp}`);

    // If Fast2SMS API key is set in Render environment, dispatch real SMS via Quick SMS Route ('q')
    if (process.env.FAST2SMS_API_KEY) {
      const smsResponse = await fetch('https://www.fast2sms.com/dev/bulkV2', {
        method: 'POST',