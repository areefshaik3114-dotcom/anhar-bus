const Bus = require('./models/Bus');
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
  .then(() => {
    console.log(' Connected to MongoDB Atlas successfully!');
    startResaleCleanupWorker();
  })
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

// --- BACKGROUND WORKER: EXPIRED RESALE CLEANUP & SEAT RESTORATION ---
const cleanupExpiredResaleListings = async () => {
  try {
    const now = Date.now();
    const expiredListings = await ResaleListing.find({
      status: 'AVAILABLE',
      cutoffTimestamp: { $lte: now }
    });

    if (expiredListings.length === 0) return;

    console.log(`[Resale Cleanup] Found ${expiredListings.length} expired resale listing(s). Processing reversion...`);

    for (const item of expiredListings) {
      // 1. Mark listing as EXPIRED
      item.status = 'EXPIRED';
      await item.save();

      // 2. Revert seat to original booking if sellerPnr exists
      if (item.sellerPnr) {
        const originalBooking = await Booking.findOne({ pnr: item.sellerPnr });

        if (originalBooking) {
          const seatAlreadyRestored = (originalBooking.passengers || []).some(
            p => Number(p.seatNumber) === Number(item.seatNumber)
          );

          if (!seatAlreadyRestored) {
            originalBooking.passengers.push({
              seatNumber: Number(item.seatNumber),
              name: item.sellerName || 'Passenger',
              age: 25,
              gender: 'Male'
            });

            // Recalculate status and paid fare
            originalBooking.totalPaid = originalBooking.passengers.length * (originalBooking.unitPrice || item.originalPrice);
            originalBooking.status = 'CONFIRMED';
            await originalBooking.save();
            console.log(`[Seat Restored] Seat ${item.seatNumber} returned to PNR ${item.sellerPnr}`);
          }
        }
      }

      // 3. Notify original seller via SMS that resale closed and their seat is safe
      const sellerPhone = item.sellerPhone || (item.contact && item.contact.phone);
      if (sellerPhone) {
        const cleanSellerPhone = String(sellerPhone).replace(/\D/g, '').slice(-10);
        const revertMsg = `ANHAR BUS Update: Resale window closed for Seat ${item.seatNumber} (${item.busName}). Your seat has been restored to your booking. Happy Journey!`;
        await sendQuickSms(cleanSellerPhone, revertMsg);
      }
    }
  } catch (err) {
    console.error('[Resale Cleanup Error]:', err.message);
  }
};

// Run background worker every 60 seconds
const startResaleCleanupWorker = () => {
  console.log(' Resale Auto-Cleanup Worker running (Interval: 60s)');
  cleanupExpiredResaleListings();
  setInterval(cleanupExpiredResaleListings, 60 * 1000);
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

    let rawSellerPhone = item.sellerPhone || (item.contact && item.contact.phone) || buyerBooking.sellerPhone;

    if (!rawSellerPhone && (item.sellerPnr || buyerBooking.sellerPnr)) {
      const targetPnr = item.sellerPnr || buyerBooking.sellerPnr;
      const originalBooking = await Booking.findOne({ pnr: targetPnr });
      if (originalBooking && originalBooking.contact?.phone) {
        rawSellerPhone = originalBooking.contact.phone;
      }
    }

    console.log(`[Resale Purchase] Resolved Seller Phone:`, rawSellerPhone);

    if (rawSellerPhone) {
      const cleanSellerPhone = String(rawSellerPhone).replace(/\D/g, '').slice(-10);
      const updatedSeller = await User.findOneAndUpdate(
        { phone: cleanSellerPhone },
        { $inc: { walletBalance: Number(item.resalePrice) } },
        { new: true, upsert: true }
      );

      console.log(`[Resale Payout Success] Seller +91 ${cleanSellerPhone} credited ₹${item.resalePrice}. New Balance: ₹${updatedSeller.walletBalance}`);

      const sellerAlertMsg = `ANHAR BUS Update: Your bus seat ${item.seatNumber} has been re-booked by a passenger. Rs ${item.resalePrice} added to your ANHAR account wallet.`;
      const sellerStatus = await sendQuickSms(cleanSellerPhone, sellerAlertMsg);
      console.log(`[Seller SMS Status to ${cleanSellerPhone}]:`, sellerStatus);
    } else {
      console.error('[Resale Payout Warning] Could not resolve seller phone for item:', item.id);
    }

    if (createdTicket.contact?.phone) {
      const buyerMsg = `ANHAR BUS Verified Resale Confirmed! PNR: ${createdTicket.pnr}, Bus: ${createdTicket.busName}, Seat: ${item.seatNumber}, Date: ${createdTicket.journeyDate} at ${createdTicket.departure}. Have a safe journey!`;
      const buyerStatus = await sendQuickSms(createdTicket.contact.phone, buyerMsg);
      console.log(`[Buyer SMS Status]:`, buyerStatus);
    }

    res.status(201).json({ success: true, booking: createdTicket });
  } catch (err) {
    console.error('[Resale Payout Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5.5 Cancel a Booking with Tiered redBus Refund & Wallet Credit
app.post('/api/bookings/cancel', async (req, res) => {
  try {
    const { pnr } = req.body;
    if (!pnr) {
      return res.status(400).json({ success: false, message: 'PNR is required for cancellation.' });
    }

    const booking = await Booking.findOne({ pnr });
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found.' });
    }

    if (booking.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Ticket is already cancelled.' });
    }

    // 1. Calculate time remaining until departure
    const departureStr = booking.departure?.trim() || '00:00';
    const departureIso = `${booking.journeyDate}T${departureStr.length === 5 ? departureStr : '0' + departureStr}:00`;
    const departureTimestamp = new Date(departureIso).getTime();
    const diffHours = (departureTimestamp - Date.now()) / (1000 * 60 * 60);

    let deductionPct = 100;
    if (diffHours >= 24) {
      deductionPct = 10;
    } else if (diffHours >= 12 && diffHours < 24) {
      deductionPct = 25;
    } else if (diffHours >= 2 && diffHours < 12) {
      deductionPct = 50;
    } else {
      deductionPct = 100;
    }

    const totalFare = Number(booking.totalPaid || booking.baseFare || 0);
    const deductionAmount = Math.round((totalFare * deductionPct) / 100);
    const refundAmount = Math.max(0, totalFare - deductionAmount);

    // 2. Mark booking as CANCELLED in MongoDB Atlas (Instantly frees seats on seat map)
    booking.status = 'CANCELLED';
    await booking.save();

    // 3. Remove any active resale listings tied to this PNR
    await ResaleListing.deleteMany({ sellerPnr: pnr, status: 'AVAILABLE' });

    // 4. Credit refund to passenger's ANHAR wallet in MongoDB Atlas
    let newBalance = 0;
    const phone = booking.contact?.phone;
    if (phone && refundAmount > 0) {
      const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
      const updatedUser = await User.findOneAndUpdate(
        { phone: cleanPhone },
        { $inc: { walletBalance: refundAmount } },
        { new: true, upsert: true }
      );
      newBalance = updatedUser.walletBalance;

      // 5. Dispatch Cancellation Confirmation SMS via Fast2SMS
      const cancelMsg = `ANHAR BUS Update: Booking ${pnr} has been cancelled. Rs ${refundAmount} credited to your wallet (Charge: ${deductionPct}%). New Balance: Rs ${newBalance}.`;
      await sendQuickSms(cleanPhone, cancelMsg);
    }

    res.json({
      success: true,
      pnr,
      deductionPct,
      deductionAmount,
      refundAmount,
      newBalance,
      message: `Ticket cancelled. Rs ${refundAmount} credited to ANHAR Wallet.`
    });
  } catch (err) {
    console.error('[Cancellation Error]:', err);
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
// A. Search active buses dynamically from MongoDB Atlas
app.get('/api/buses/search', async (req, res) => {
  try {
    const { source, destination } = req.query;
    const filter = { isActive: true };
    if (source) filter.source = new RegExp(`^${source}$`, 'i');
    if (destination) filter.destination = new RegExp(`^${destination}$`, 'i');

    let buses = await Bus.find(filter).sort({ departureHour: 1 });

    // Seed default fleet into MongoDB if collection is currently empty
    if (buses.length === 0 && !source && !destination) {
      const defaultBuses = [
        {
          name: 'ANHAR Super Luxury AC Sleeper',
          busNumber: 'AP 04 TX 9924',
          operatorPhone: '8977733885',
          source: 'Bengaluru',
          destination: 'Hyderabad',
          departure: '21:30',
          departureHour: 21.5,
          arrival: '06:00',
          duration: '8h 30m',
          category: 'AC Sleeper',
          type: '2+1 AC Sleeper',
          price: 1150,
          totalSeats: 24,
          boardingPoints: [
            { name: 'Majestic (Bus Stand Platform 4)', timeOffset: '+0h 00m' },
            { name: 'Hebbal (Near Flyover)', timeOffset: '+0h 45m' }
          ],
          droppingPoints: [
            { name: 'Shamshabad (Toll Gate)', timeOffset: '+7h 30m' },
            { name: 'Lakdikapul (Opp. Metro Pillar 1042)', timeOffset: '+8h 30m' }
          ]
        },
        {
          name: 'ANHAR Multi-Axle Volvo Semi-Sleeper',
          busNumber: 'KA 01 F 4402',
          operatorPhone: '8977733885',
          source: 'Bengaluru',
          destination: 'Hyderabad',
          departure: '22:15',
          departureHour: 22.25,
          arrival: '06:45',
          duration: '8h 30m',
          category: 'Volvo',
          type: '2+2 Pushback AC',
          price: 890,
          totalSeats: 24,
          boardingPoints: [
            { name: 'Anand Rao Circle (Near Flyover)', timeOffset: '+0h 00m' },
            { name: 'Electronic City Toll Plaza', timeOffset: '+0h 40m' }
          ],
          droppingPoints: [
            { name: 'Gachibowli (ORR Junction)', timeOffset: '+7h 45m' },
            { name: 'Ameerpet (Near Big Bazaar)', timeOffset: '+8h 30m' }
          ]
        }
      ];
      buses = await Bus.insertMany(defaultBuses);
    }

    res.json({ success: true, buses });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// B. Operator endpoint: Add a new bus trip into MongoDB
app.post('/api/operator/buses', async (req, res) => {
  try {
    const newBus = await Bus.create(req.body);
    res.status(201).json({ success: true, bus: newBus });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});
app.listen(PORT, '0.0.0.0', () => {
  console.log(`ANHAR BUS Server live on port ${PORT}`);
});