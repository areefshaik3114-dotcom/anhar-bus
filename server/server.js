const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const Booking = require('./models/Booking');
const ResaleListing = require('./models/ResaleListing');
const User = require('./models/User');
const Bus = require('./models/Bus');

const app = express();

// In-memory OTP cache (phone -> { otp, expiresAt })
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
      item.status = 'EXPIRED';
      await item.save();

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

            originalBooking.totalPaid = originalBooking.passengers.length * (originalBooking.unitPrice || item.originalPrice);
            originalBooking.status = 'CONFIRMED';
            await originalBooking.save();
            console.log(`[Seat Restored] Seat ${item.seatNumber} returned to PNR ${item.sellerPnr}`);
          }
        }
      }

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

const startResaleCleanupWorker = () => {
  console.log(' Resale Auto-Cleanup Worker running (Interval: 60s)');
  cleanupExpiredResaleListings();
  setInterval(cleanupExpiredResaleListings, 60 * 1000);
};

// Dynamic Seat Layout Generator
const buildDynamicSeats = (layoutType, p) => {
  const seats = [];
  const base = Number(p.basePrice || 600);
  const leftSeater = Number(p.lowerLeftPrice || base);
  const rightSeater = Number(p.lowerRightPrice || base + 50);
  const upperLeftSleeper = Number(p.upperLeftPrice || base + 250);
  const upperRightSleeper = Number(p.upperRightPrice || base + 300);
  const backDiscounted = Number(p.backPrice || base - 50);

  if (layoutType === 'MIXED_SEATER_SLEEPER') {
    // LOWER DECK: Pushback Seaters 1 to 15 (Left Single, Right Double, Back Row)
    for (let i = 1; i <= 15; i++) {
      const isLeft = [1, 4, 7, 10].includes(i);
      const isBack = [13, 14, 15].includes(i);
      seats.push({
        seatNumber: i,
        seatLabel: `L${i}`,
        deck: 'LOWER',
        side: isLeft ? 'LEFT' : 'RIGHT',
        type: 'PUSHBACK',
        price: isBack ? backDiscounted : (isLeft ? leftSeater : rightSeater)
      });
    }
    // UPPER DECK: Sleeper Berths 16 to 30 (Left Single, Right Double, Back Row)
    for (let i = 16; i <= 30; i++) {
      const isLeft = [16, 19, 22, 25].includes(i);
      const isBack = [28, 29, 30].includes(i);
      seats.push({
        seatNumber: i,
        seatLabel: `U${i - 15}`,
        deck: 'UPPER',
        side: isLeft ? 'LEFT' : 'RIGHT',
        type: 'SLEEPER',
        price: isBack ? backDiscounted + 100 : (isLeft ? upperLeftSleeper : upperRightSleeper)
      });
    }
  } else if (layoutType === 'ALL_SLEEPER') {
    // LOWER DECK: Sleeper Berths 1 to 15
    for (let i = 1; i <= 15; i++) {
      const isLeft = [1, 4, 7, 10].includes(i);
      const isBack = [13, 14, 15].includes(i);
      seats.push({
        seatNumber: i,
        seatLabel: `L${i}`,
        deck: 'LOWER',
        side: isLeft ? 'LEFT' : 'RIGHT',
        type: 'SLEEPER',
        price: isBack ? backDiscounted : (isLeft ? leftSeater + 150 : rightSeater + 150)
      });
    }
    // UPPER DECK: Sleeper Berths 16 to 30
    for (let i = 16; i <= 30; i++) {
      const isLeft = [16, 19, 22, 25].includes(i);
      const isBack = [28, 29, 30].includes(i);
      seats.push({
        seatNumber: i,
        seatLabel: `U${i - 15}`,
        deck: 'UPPER',
        side: isLeft ? 'LEFT' : 'RIGHT',
        type: 'SLEEPER',
        price: isBack ? backDiscounted + 100 : (isLeft ? upperLeftSleeper : upperRightSleeper)
      });
    }
  } else {
    // SINGLE DECK: PUSHBACK_ONLY or SEATER_ONLY (1 to 24 seats)
    const seatType = layoutType === 'PUSHBACK_ONLY' ? 'PUSHBACK' : 'SEATER';
    for (let i = 1; i <= 24; i++) {
      const isLeft = [1, 2, 5, 6, 9, 10, 13, 14, 17, 18, 21].includes(i);
      const isBack = [21, 22, 23, 24].includes(i);
      seats.push({
        seatNumber: i,
        seatLabel: `S${i}`,
        deck: 'SINGLE',
        side: isLeft ? 'LEFT' : 'RIGHT',
        type: seatType,
        price: isBack ? backDiscounted : (isLeft ? leftSeater : rightSeater)
      });
    }
  }

  return seats;
};

// Health Check
app.get('/', (req, res) => res.send('ANHAR BUS Backend Server is live!'));

// --- DYNAMIC FLEET & OPERATOR ENDPOINTS ---

// 1. Search Buses Dynamically
app.get('/api/buses/search', async (req, res) => {
  try {
    const { source, destination } = req.query;
    const filter = { isActive: true };
    if (source) filter.source = new RegExp(`^${source}$`, 'i');
    if (destination) filter.destination = new RegExp(`^${destination}$`, 'i');

    let buses = await Bus.find(filter).sort({ departureHour: 1 });

    // Seed default starter fleet if MongoDB collection is empty
    if (buses.length === 0 && !source && !destination) {
      const defaultBuses = [
        {
          name: 'ANHAR Multi-Axle Volvo Semi-Sleeper',
          busNumber: 'KA 01 F 4402',
          operatorPhone: '8977733885',
          source: 'Bengaluru',
          destination: 'Hyderabad',
          departure: '21:30',
          departureHour: 21.5,
          arrival: '06:00',
          duration: '8h 30m',
          layoutType: 'MIXED_SEATER_SLEEPER',
          category: 'Mixed Seater & Sleeper',
          type: '2+1 Lower Pushback + Upper Sleeper',
          price: 650,
          totalSeats: 30,
          seats: buildDynamicSeats('MIXED_SEATER_SLEEPER', { basePrice: 650, lowerLeftPrice: 650, lowerRightPrice: 700, upperLeftPrice: 900, upperRightPrice: 950, backPrice: 590 }),
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
          name: 'ANHAR Royal All-Sleeper AC',
          busNumber: 'AP 04 TX 9924',
          operatorPhone: '8977733885',
          source: 'Bengaluru',
          destination: 'Hyderabad',
          departure: '22:15',
          departureHour: 22.25,
          arrival: '06:45',
          duration: '8h 30m',
          layoutType: 'ALL_SLEEPER',
          category: 'AC Sleeper',
          type: '2+1 Executive Sleeper (Lower + Upper)',
          price: 950,
          totalSeats: 30,
          seats: buildDynamicSeats('ALL_SLEEPER', { basePrice: 950, lowerLeftPrice: 950, lowerRightPrice: 1000, upperLeftPrice: 1100, upperRightPrice: 1150, backPrice: 850 }),
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

// 2. Operator endpoint: Add new bus trip with custom seat-wise pricing
app.post('/api/operator/buses', async (req, res) => {
  try {
    const busData = { ...req.body };
    const layout = busData.layoutType || 'MIXED_SEATER_SLEEPER';

    busData.seats = buildDynamicSeats(layout, {
      basePrice: busData.price,
      lowerLeftPrice: busData.lowerLeftPrice || busData.price,
      lowerRightPrice: busData.lowerRightPrice || busData.price,
      upperLeftPrice: busData.upperLeftPrice || Math.round(busData.price * 1.3),
      upperRightPrice: busData.upperRightPrice || Math.round(busData.price * 1.35),
      backPrice: busData.backPrice || Math.round(busData.price * 0.9)
    });

    busData.totalSeats = busData.seats.length;
    const newBus = await Bus.create(busData);
    res.status(201).json({ success: true, bus: newBus });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// 3. Operator endpoint: Live Passenger Trip Manifest
app.get('/api/operator/manifest/:busId/:date', async (req, res) => {
  try {
    const { busId, date } = req.params;
    const bookings = await Booking.find({
      busId: String(busId),
      journeyDate: date,
      status: { $in: ['CONFIRMED', 'VERIFIED_RESALE_TICKET', 'PARTIALLY_RESOLD'] }
    });

    const manifest = [];
    bookings.forEach(b => {
      (b.passengers || []).forEach(p => {
        manifest.push({
          seatNumber: p.seatNumber,
          name: p.name,
          age: p.age,
          gender: p.gender,
          pnr: b.pnr,
          phone: b.contact?.phone,
          boarding: b.boarding,
          dropping: b.dropping,
          status: b.status
        });
      });
    });

    manifest.sort((a, b) => Number(a.seatNumber) - Number(b.seatNumber));
    res.json({ success: true, count: manifest.length, manifest });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- PASSENGER BOOKING & CANCELLATION ENDPOINTS ---

// 4. Fetch all bookings
app.get('/api/bookings', async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 });
    res.json({ success: true, bookings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// 5. Create new booking & dispatch SMS
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

// 6. Tiered redBus Cancellation & Wallet Refund Engine
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

    booking.status = 'CANCELLED';
    await booking.save();

    await ResaleListing.deleteMany({ sellerPnr: pnr, status: 'AVAILABLE' });

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

// --- RESALE MARKETPLACE ENDPOINTS ---

app.get('/api/resale', async (req, res) => {
  try {
    const listings = await ResaleListing.find({ status: 'AVAILABLE' }).sort({ createdAt: -1 });
    res.json({ success: true, listings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

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

    if (rawSellerPhone) {
      const cleanSellerPhone = String(rawSellerPhone).replace(/\D/g, '').slice(-10);
      await User.findOneAndUpdate(
        { phone: cleanSellerPhone },
        { $inc: { walletBalance: Number(item.resalePrice) } },
        { new: true, upsert: true }
      );

      const sellerAlertMsg = `ANHAR BUS Update: Your bus seat ${item.seatNumber} has been re-booked by a passenger. Rs ${item.resalePrice} added to your ANHAR account wallet.`;
      await sendQuickSms(cleanSellerPhone, sellerAlertMsg);
    }

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

// --- USER WALLET & OTP AUTH ENDPOINTS ---

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

app.post('/api/auth/send-otp', async (req, res) => {
  try {
    const { phone } = req.body;
    const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);

    if (cleanPhone.length !== 10) {
      return res.status(400).json({ success: false, message: 'Invalid 10-digit mobile number.' });
    }

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    otpStore.set(cleanPhone, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });

    const otpMsg = `Your ANHAR BUS verification code is ${otp}. Valid for 5 minutes. Do not share this OTP.`;
    const sent = await sendQuickSms(cleanPhone, otpMsg);

    if (sent) {
      return res.json({ success: true, message: `OTP sent via SMS to +91 ${cleanPhone}` });
    }

    res.json({ success: true, message: 'OTP sent (Dev Mode)', devOtp: otp });
  } catch (err) {
    console.error('[SMS Dispatch Error]:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

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

// Bind and listen on all network interfaces
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`ANHAR BUS Server live on port ${PORT}`);
});