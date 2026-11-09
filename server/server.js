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

// Reusable Fast2SMS Quick Route Dispatch Helper
const sendQuickSms = async (phone, message) => {
  const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
  if (!process.env.FAST2SMS_API_KEY || cleanPhone.length !== 10) {
    console.warn(`[SMS Dispatch Skipped] Invalid phone or missing key: ${cleanPhone}`);
    return false;
  }

  try {
    const smsResponse = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        'authorization': process.env.FAST2SMS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        route: 'q',
        message: message,
        language: 'english',
        flash: 0,
        numbers: cleanPhone
      })
    });
    const result = await smsResponse.json();
    console.log(`[Transactional SMS Result to +91 ${cleanPhone}]:`, result);
    return result.return;
  } catch (err) {
    console.error(`[Transactional SMS Error to +91 ${cleanPhone}]:`, err.message);
    return false;
  }
};

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

// 2. Save a new booking & send Transactional Confirmation SMS
app.post('/api/bookings', async (req, res) => {
  try {
    const newBooking = await Booking.create(req.body);

    // Send instant SMS confirmation to passenger phone
    if (newBooking.contact?.phone) {
      const seats = (newBooking.passengers || []).map(p => p.seatNumber).join(', ');
      const msg = `ANHAR BUS Booking Confirmed! PNR: ${newBooking.pnr}, Route: ${newBooking.route}, Date: ${newBooking.journeyDate} at ${newBooking.departure}, Seats: [${seats}]. Boarding: ${newBooking.boarding}. Happy Journey!`;
      await sendQuickSms(newBooking.contact.phone, msg);
    }

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

// 5. Purchase a resale ticket, credit seller, & notify BOTH buyer and seller via SMS
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

    // Multi-tier seller phone lookup
    let rawSellerPhone = item.sellerPhone || (item.contact && item.contact.phone);

    // If missing on the listing document, query the original booking record by sellerPnr
    if (!rawSellerPhone && item.sellerPnr) {
      const originalBooking = await Booking.findOne({ pnr: item.sellerPnr });
      if (originalBooking && originalBooking.contact?.phone) {
        rawSellerPhone = originalBooking.contact.phone;
      }
    }

    console.log(`[Resale Purchase] Resolved Seller Phone:`, rawSellerPhone);

    // 1. Credit seller and dispatch automated payout SMS
    if (rawSellerPhone) {
      const cleanSellerPhone = String(rawSellerPhone).replace(/\D/g, '').slice(-10);
      const updatedSeller = await User.findOneAndUpdate(
        { phone: cleanSellerPhone },
        { $inc: { walletBalance: Number(item.resalePrice) } },
        { new: true, upsert: true }
      );

      console.log(`[Resale Payout Success] Seller +91 ${cleanSellerPhone} credited ₹${item.resalePrice}. New Balance: ₹${updatedSeller.walletBalance}`);

      const sellerAlertMsg = `ANHAR BUS Alert: Your Seat ${item.seatNumber} (${item.busName}) has been sold! ₹${item.resalePrice} credited to your ANHAR Wallet. New Balance: ₹${updatedSeller.walletBalance}.`;
      await sendQuickSms(cleanSellerPhone, sellerAlertMsg);
    } else {
      console.error('[Resale Payout Warning] Could not resolve seller phone for item:', item.id);
    }

    // 2. Dispatch ticket confirmation SMS to the resale buyer
    if (createdTicket.contact?.phone) {
      const buyerMsg = `ANHAR BUS Verified Resale Confirmed! PNR: ${createdTicket.pnr}, Bus: ${createdTicket.busName}, Seat: ${item.seatNumber}, Date: ${createdTicket.journeyDate} at ${createdTicket.departure}. Have a safe journey!`;
      await sendQuickSms(createdTicket.contact.phone, buyerMsg);
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

// 7. Update user wallet balance
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

// 8. Generate & Send Real SMS OTP via Fast2SMS Quick Route ('q')
app.post('/api/auth/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);

    if (cleanPhone.length !== 10) {
      return res.status(400).json({ success: false, message: 'Invalid 10-digit mobile number.' });
    }

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    otpStore.set(cleanPhone, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });

    console.log(`[SMS OTP Generated] Phone: +91 ${cleanPhone} | OTP: ${otp}`);

    const otpMsg = `Your ANHAR BUS verification code is ${otp}. Valid for 5 minutes. Do not share this OTP.`;
    const sent = await sendQuickSms(cleanPhone, otpMsg);

    if (sent) {
      return res.json({
        success: true,
        message: `OTP sent via SMS to +91 ${cleanPhone}`
      });
    }

    res.json({ success: true, message: 'OTP sent (Dev Mode)', devOtp: otp });
  } catch (err) {
    console.error('[SMS Dispatch Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 9. Verify OTP & Register/Update User Profile
app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { phone, name, email, otp } = req.body;
    const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);

    const record = otpStore.get(cleanPhone);
    if (!record || record.otp !== String(otp).trim() || Date.now() > record.expiresAt) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP.' });
    }

    otpStore.delete(cleanPhone);

    const user = await User.findOneAndUpdate(
      { phone: cleanPhone },
      {
        $set: {
          name: name || 'Passenger',
          email: email || ''
        },
        $setOnInsert: { walletBalance: 0 }
      },
      { new: true, upsert: true }
    );

    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 10. Bind and listen on all network interfaces
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`ANHAR BUS Server live on port ${PORT}`);
});