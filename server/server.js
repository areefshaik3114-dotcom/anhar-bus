const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const Booking = require('./models/Booking');
const ResaleListing = require('./models/ResaleListing');
const User = require('./models/User');
const Bus = require('./models/Bus');

const app = express();

const otpStore = new Map();
const FIXED_OPERATOR_ADMIN_PHONE = '8977733885';

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

// Reusable Fast2SMS Quick Route Helper
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
    return result.return;
  } catch (err) {
    console.error('[Transactional SMS Error]:', err.message);
    return false;
  }
};

// Dynamic Seat & Berth Generator (Supports custom counts, AC/Non-AC, 2+1 & 2+2 layouts)
const buildDynamicSeats = (layoutType, p) => {
  const seats = [];
  const base = Number(p.basePrice || 600);
  const leftPrice = Number(p.lowerLeftPrice || base);
  const rightPrice = Number(p.lowerRightPrice || base + 50);
  const upperPrice = Number(p.upperLeftPrice || base + 250);
  const backDiscounted = Number(p.backPrice || Math.max(100, base - 50));

  if (layoutType === 'ALL_SLEEPER' || layoutType === 'MIXED_SEATER_SLEEPER') {
    const totalRequested = Number(p.totalSeats || 30);
    const lowerCount = Number(p.lowerCount || Math.ceil(totalRequested / 2));
    const upperCount = Number(p.upperCount || (totalRequested - lowerCount));
    const lowerType = layoutType === 'ALL_SLEEPER' ? 'SLEEPER' : 'PUSHBACK';

    // 2+1 Deck Grid (3 columns per row: Col 1 = Left Single, Col 2 & 3 = Right Double)
    const lowerRows = Math.ceil(lowerCount / 3);
    for (let i = 1; i <= lowerCount; i++) {
      const row = Math.ceil(i / 3);
      const col = ((i - 1) % 3) + 1;
      const isLeft = col === 1;
      const isLastRow = row === lowerRows;

      seats.push({
        seatNumber: i,
        seatLabel: `L${i}`,
        deck: 'LOWER',
        row,
        col,
        side: isLeft ? 'LEFT' : 'RIGHT',
        type: lowerType,
        price: isLastRow ? backDiscounted : (isLeft ? leftPrice : rightPrice)
      });
    }

    const upperRows = Math.ceil(upperCount / 3);
    for (let i = 1; i <= upperCount; i++) {
      const seatNum = lowerCount + i;
      const row = Math.ceil(i / 3);
      const col = ((i - 1) % 3) + 1;
      const isLeft = col === 1;
      const isLastRow = row === upperRows;

      seats.push({
        seatNumber: seatNum,
        seatLabel: `U${i}`,
        deck: 'UPPER',
        row,
        col,
        side: isLeft ? 'LEFT' : 'RIGHT',
        type: 'SLEEPER',
        price: isLastRow ? Math.max(backDiscounted, upperPrice - 100) : upperPrice
      });
    }
  } else {
    // SINGLE DECK: PUSHBACK_ONLY or SEATER_ONLY (2+2 Layout: 4 seats per row)
    const seatType = layoutType === 'PUSHBACK_ONLY' ? 'PUSHBACK' : 'SEATER';
    const totalCount = Number(p.totalSeats || 32);
    const totalRows = Math.ceil(totalCount / 4);

    for (let i = 1; i <= totalCount; i++) {
      const row = Math.ceil(i / 4);
      const col = ((i - 1) % 4) + 1;
      const isLeft = col <= 2;
      const isLastRow = row === totalRows;

      seats.push({
        seatNumber: i,
        seatLabel: `S${i}`,
        deck: 'SINGLE',
        row,
        col,
        side: isLeft ? 'LEFT' : 'RIGHT',
        type: seatType,
        price: isLastRow ? backDiscounted : (isLeft ? leftPrice : rightPrice)
      });
    }
  }

  return seats;
};

// Automatic Seeder so buses are never missing
const seedDefaultFleetIfEmpty = async () => {
  try {
    const count = await Bus.countDocuments();
    if (count === 0) {
      console.log('Seeding initial ANHAR BUS fleet into MongoDB Atlas...');
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const datePrefix = tomorrow.toISOString().split('T')[0];

      const defaultBuses = [
        {
          name: 'ANHAR Multi-Axle Volvo Semi-Sleeper',
          busNumber: 'KA 01 F 4402',
          operatorPhone: '8977733885',
          source: 'Bengaluru',
          destination: 'Hyderabad',
          departure: '21:30',
          departureHour: 21.5,
          departureDate: new Date(`${datePrefix}T21:30:00.000Z`),
          arrival: '06:00',
          duration: '8h 30m',
          layoutType: 'MIXED_SEATER_SLEEPER',
          acType: 'AC',
          category: 'AC Sleeper + Seater',
          type: '2+1 AC Lower Seater + Upper Sleeper (30 Berths/Seats)',
          price: 650,
          totalSeats: 30,
          lowerCount: 15,
          upperCount: 15,
          status: 'active',
          isActive: true,
          seats: buildDynamicSeats('MIXED_SEATER_SLEEPER', {
            basePrice: 650,
            lowerLeftPrice: 650,
            lowerRightPrice: 700,
            upperLeftPrice: 950,
            backPrice: 590,
            totalSeats: 30,
            lowerCount: 15,
            upperCount: 15
          }),
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
          departureDate: new Date(`${datePrefix}T22:15:00.000Z`),
          arrival: '06:45',
          duration: '8h 30m',
          layoutType: 'ALL_SLEEPER',
          acType: 'AC',
          category: 'AC Sleeper',
          type: '2+1 AC Sleeper (30 Berths)',
          price: 950,
          totalSeats: 30,
          lowerCount: 15,
          upperCount: 15,
          status: 'active',
          isActive: true,
          seats: buildDynamicSeats('ALL_SLEEPER', {
            basePrice: 950,
            lowerLeftPrice: 950,
            lowerRightPrice: 1000,
            upperLeftPrice: 1000,
            backPrice: 900,
            totalSeats: 30,
            lowerCount: 15,
            upperCount: 15
          }),
          boardingPoints: [
            { name: 'Anand Rao Circle (Near Flyover)', timeOffset: '+0h 00m' },
            { name: 'Electronic City Toll Plaza', timeOffset: '+0h 40m' }
          ],
          droppingPoints: [
            { name: 'Gachibowli (ORR Junction)', timeOffset: '+7h 45m' },
            { name: 'Ameerpet (Near Big Bazaar)', timeOffset: '+8h 30m' }
          ]
        },
        {
          name: 'ANHAR Guntakal Superfast Express',
          busNumber: 'AP 21 Z 1042',
          operatorPhone: '8977733885',
          source: 'Bengaluru',
          destination: 'Guntakal',
          departure: '07:30',
          departureHour: 7.5,
          departureDate: new Date(`${datePrefix}T07:30:00.000Z`),
          arrival: '14:30',
          duration: '7h 00m',
          layoutType: 'PUSHBACK_ONLY',
          acType: 'NON_AC',
          category: 'Non-AC Seater',
          type: '2+2 Non-AC Pushback Seater (32 Seats)',
          price: 480,
          totalSeats: 32,
          lowerCount: 32,
          upperCount: 0,
          status: 'active',
          isActive: true,
          seats: buildDynamicSeats('PUSHBACK_ONLY', {
            basePrice: 480,
            lowerLeftPrice: 480,
            lowerRightPrice: 500,
            backPrice: 450,
            totalSeats: 32
          }),
          boardingPoints: [
            { name: 'Majestic (Bus Stand Platform 4)', timeOffset: '+0h 00m' }
          ],
          droppingPoints: [
            { name: 'Guntakal Railway Station Circle', timeOffset: '+7h 00m' }
          ]
        }
      ];
      await Bus.insertMany(defaultBuses);
      console.log('Seeded default fleet successfully!');
    }
  } catch (err) {
    console.error('Seeding fleet error:', err.message);
  }
};

// Resale Auto-Cleanup Worker
const cleanupExpiredResaleListings = async () => {
  try {
    const now = Date.now();
    const expiredListings = await ResaleListing.find({
      status: 'AVAILABLE',
      cutoffTimestamp: { $lte: now }
    });

    if (expiredListings.length === 0) return;

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
          }
        }
      }

      const sellerPhone = item.sellerPhone || (item.contact && item.contact.phone);
      if (sellerPhone) {
        const cleanSellerPhone = String(sellerPhone).replace(/\D/g, '').slice(-10);
        const revertMsg = `ANHAR BUS Update: Resale window closed for Seat ${item.seatNumber} (${item.busName}). Seat restored to your booking.`;
        await sendQuickSms(cleanSellerPhone, revertMsg);
      }
    }
  } catch (err) {
    console.error('[Resale Cleanup Error]:', err.message);
  }
};

const startResaleCleanupWorker = () => {
  cleanupExpiredResaleListings();
  setInterval(cleanupExpiredResaleListings, 60 * 1000);
};

// Connect to MongoDB Atlas
mongoose
  .connect(process.env.MONGO_URI)
  .then(async () => {
    console.log('Connected to MongoDB Atlas successfully!');
    await seedDefaultFleetIfEmpty();
    startResaleCleanupWorker();
  })
  .catch((err) => console.error('MongoDB Connection Error:', err.message));

app.get('/', (req, res) => res.send('ANHAR BUS Backend Server is live!'));

// ==========================================
// --- OPERATOR STRICT ADMIN AUTH SYSTEM ---
// ==========================================

app.post('/api/operator/send-setup-otp', async (req, res) => {
  try {
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    otpStore.set(FIXED_OPERATOR_ADMIN_PHONE, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });

    const msg = `ANHAR BUS Admin Alert: Operator Registration OTP is ${otp}. Valid for 5 minutes.`;
    const sent = await sendQuickSms(FIXED_OPERATOR_ADMIN_PHONE, msg);

    if (sent) {
      return res.json({ success: true, message: `OTP sent to Admin (+91 ${FIXED_OPERATOR_ADMIN_PHONE})` });
    }
    res.json({ success: true, message: 'OTP Generated (Dev Mode)', devOtp: otp });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/operator/register-with-otp', async (req, res) => {
  try {
    const { name, password, otp } = req.body;

    if (!name || !password || !otp) {
      return res.status(400).json({ success: false, message: 'Name, Password, and Admin OTP are required.' });
    }

    const record = otpStore.get(FIXED_OPERATOR_ADMIN_PHONE);
    if (!record || record.otp !== String(otp).trim() || Date.now() > record.expiresAt) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP from admin.' });
    }

    otpStore.delete(FIXED_OPERATOR_ADMIN_PHONE);

    const existing = await User.findOne({ name: new RegExp(`^${name.trim()}$`, 'i'), isOperator: true });
    if (existing) {
      return res.status(400).json({ success: false, message: 'An operator with this name already exists. Choose a different name.' });
    }

    const newOperator = await User.create({
      phone: FIXED_OPERATOR_ADMIN_PHONE,
      name: name.trim(),
      operatorPassword: String(password).trim(),
      isOperator: true,
      walletBalance: 0
    });

    res.json({
      success: true,
      message: 'Operator registered successfully!',
      operator: { id: newOperator._id, name: newOperator.name }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/operator/login', async (req, res) => {
  try {
    const { name, password } = req.body;

    if (!name || !password) {
      return res.status(400).json({ success: false, message: 'Please enter Name and Password.' });
    }

    const operator = await User.findOne({
      name: new RegExp(`^${name.trim()}$`, 'i'),
      isOperator: true
    });

    if (!operator) {
      return res.status(404).json({ success: false, message: 'Operator not found. Please register first with Admin OTP.' });
    }

    if (operator.operatorPassword !== String(password).trim()) {
      return res.status(401).json({ success: false, message: 'Incorrect Password. Please try again.' });
    }

    res.json({
      success: true,
      message: 'Login successful!',
      operator: { id: operator._id, name: operator.name, phone: operator.phone }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==========================================
// --- FLEET & OPERATOR BUS MANAGEMENT ---
// ==========================================

app.get('/api/buses/search', async (req, res) => {
  try {
    const { source, destination, date } = req.query;
    const now = new Date();

    const filter = {
      isActive: true,
      status: 'active',
      $or: [
        { departureDate: { $gte: now } },
        { departureDate: { $exists: false } }
      ]
    };

    if (source) filter.source = new RegExp(`^${source}$`, 'i');
    if (destination) filter.destination = new RegExp(`^${destination}$`, 'i');

    if (date) {
      const searchDay = new Date(date);
      const startOfDay = new Date(searchDay.setHours(0, 0, 0, 0));
      const endOfDay = new Date(searchDay.setHours(23, 59, 59, 999));

      filter.departureDate = {
        $gte: startOfDay > now ? startOfDay : now,
        $lte: endOfDay
      };
    }

    let buses = await Bus.find(filter).sort({ departureDate: 1, departureHour: 1 });

    if (buses.length === 0) {
      buses = await Bus.find({
        isActive: true,
        status: 'active',
        $or: [
          { departureDate: { $gte: now } },
          { departureDate: { $exists: false } }
        ]
      }).sort({ departureDate: 1, departureHour: 1 });
    }

    res.json({ success: true, count: buses.length, buses });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/operator/my-buses', async (req, res) => {
  try {
    const { phone } = req.query;
    const query = { status: { $ne: 'deleted' } };
    if (phone) query.operatorPhone = String(phone).replace(/\D/g, '').slice(-10);

    const buses = await Bus.find(query).sort({ departureDate: -1, createdAt: -1 });
    const now = new Date();

    const formattedBuses = buses.map(bus => {
      const isPast = bus.departureDate ? new Date(bus.departureDate) < now : false;
      return {
        ...bus.toObject(),
        isPast,
        canEdit: !isPast && bus.status === 'active'
      };
    });

    res.json({ success: true, buses: formattedBuses });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/operator/buses', async (req, res) => {
  try {
    const busData = { ...req.body };
    const layout = busData.layoutType || 'MIXED_SEATER_SLEEPER';
    const acLabel = busData.acType === 'NON_AC' ? 'Non-AC' : 'AC';

    const lowerCount = Number(busData.lowerCount || 15);
    const upperCount = Number(busData.upperCount || 15);
    const singleCount = Number(busData.totalSeats || 32);

    busData.seats = buildDynamicSeats(layout, {
      basePrice: busData.price,
      lowerLeftPrice: busData.lowerLeftPrice || busData.price,
      lowerRightPrice: busData.lowerRightPrice || busData.price,
      upperLeftPrice: busData.upperLeftPrice || Math.round(busData.price * 1.3),
      backPrice: busData.backPrice || Math.round(busData.price * 0.9),
      totalSeats: layout === 'ALL_SLEEPER' || layout === 'MIXED_SEATER_SLEEPER' ? lowerCount + upperCount : singleCount,
      lowerCount,
      upperCount
    });

    busData.totalSeats = busData.seats.length;
    busData.lowerCount = layout === 'ALL_SLEEPER' || layout === 'MIXED_SEATER_SLEEPER' ? lowerCount : singleCount;
    busData.upperCount = layout === 'ALL_SLEEPER' || layout === 'MIXED_SEATER_SLEEPER' ? upperCount : 0;

    if (layout === 'ALL_SLEEPER') {
      busData.category = `${acLabel} Sleeper`;
      busData.type = `2+1 ${acLabel} Sleeper (${busData.totalSeats} Berths)`;
    } else if (layout === 'MIXED_SEATER_SLEEPER') {
      busData.category = `${acLabel} Sleeper + Seater`;
      busData.type = `2+1 ${acLabel} Lower Seater + Upper Sleeper (${busData.totalSeats} Total)`;
    } else {
      busData.category = `${acLabel} Seater`;
      busData.type = `2+2 ${acLabel} ${layout === 'PUSHBACK_ONLY' ? 'Pushback' : 'Classic'} Seater (${busData.totalSeats} Seats)`;
    }

    busData.status = 'active';
    busData.isActive = true;

    if (busData.date && busData.departure) {
      const depTime = busData.departure.trim();
      const timeFormatted = depTime.length === 5 ? depTime : '0' + depTime;
      busData.departureDate = new Date(`${busData.date}T${timeFormatted}:00.000Z`);
    } else if (!busData.departureDate) {
      busData.departureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
    }

    const newBus = await Bus.create(busData);
    res.status(201).json({ success: true, bus: newBus });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.put('/api/buses/:id', async (req, res) => {
  try {
    const bus = await Bus.findById(req.params.id);
    if (!bus) {
      return res.status(404).json({ success: false, message: 'Bus not found' });
    }

    if (bus.departureDate && new Date(bus.departureDate) < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'This bus trip is already completed. Past schedules are view-only and cannot be edited.'
      });
    }

    const updatedBus = await Bus.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, message: 'Bus updated successfully', bus: updatedBus });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete('/api/buses/:id', async (req, res) => {
  try {
    const busId = req.params.id;
    const bus = await Bus.findById(busId);
    if (!bus) return res.status(404).json({ success: false, message: 'Bus not found' });

    const activeBookings = await Booking.find({
      busId: String(busId),
      status: { $in: ['CONFIRMED', 'confirmed'] }
    });

    const isFutureTrip = bus.departureDate && new Date(bus.departureDate) >= new Date();

    if (activeBookings.length > 0 && isFutureTrip) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete bus: ${activeBookings.length} passenger(s) booked. Cancel bookings first.`
      });
    }

    await Bus.findByIdAndDelete(busId);
    res.json({ success: true, message: 'Bus removed successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

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

// ==========================================
// --- BOOKING & CANCELLATION ENDPOINTS ---
// ==========================================

app.get('/api/bookings', async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 });
    res.json({ success: true, bookings });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/bookings', async (req, res) => {
  try {
    const newBooking = await Booking.create(req.body);

    if (newBooking.contact?.phone) {
      const seats = (newBooking.passengers || []).map(p => p.seatLabel || p.seatNumber).join(', ');
      const msg = `ANHAR BUS Booking Confirmed! PNR: ${newBooking.pnr}, Route: ${newBooking.route}, Date: ${newBooking.journeyDate} at ${newBooking.departure}, Seats: [${seats}]. Boarding: ${newBooking.boarding}. Happy Journey!`;
      await sendQuickSms(newBooking.contact.phone, msg);
    }

    res.status(201).json({ success: true, booking: newBooking });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

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

// ==========================================
// --- RESALE MARKETPLACE ENDPOINTS ---
// ==========================================

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

// ==========================================
// --- USER WALLET & OTP AUTH ENDPOINTS ---
// ==========================================

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

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`ANHAR BUS Server live on port ${PORT}`);
});