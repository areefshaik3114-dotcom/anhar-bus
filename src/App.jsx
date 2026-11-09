import { api } from './api'
import { useState, useEffect, useMemo } from 'react'
import './App.css'

const CITY_POINTS = {
  Hyderabad: [
    { id: 'hyd-1', name: 'Lakdikapul (Opp. Metro Pillar 1042)', timeOffset: '+0h 00m' },
    { id: 'hyd-2', name: 'Ameerpet (Near Big Bazaar)', timeOffset: '+0h 20m' },
    { id: 'hyd-3', name: 'Gachibowli (ORR Junction)', timeOffset: '+0h 50m' },
    { id: 'hyd-4', name: 'Shamshabad (Toll Gate)', timeOffset: '+1h 20m' }
  ],
  Bengaluru: [
    { id: 'blr-1', name: 'Majestic (Bus Stand Platform 4)', timeOffset: '+0h 00m' },
    { id: 'blr-2', name: 'Anand Rao Circle (Near Flyover)', timeOffset: '+0h 20m' },
    { id: 'blr-3', name: 'Hebbal (Near Flyover)', timeOffset: '+0h 45m' },
    { id: 'blr-4', name: 'Electronic City Toll Plaza', timeOffset: '+1h 15m' }
  ],
  Guntakal: [
    { id: 'gtl-1', name: 'Guntakal Railway Station Circle', timeOffset: '+0h 00m' },
    { id: 'gtl-2', name: 'Hanuman Junction Bus Stop', timeOffset: '+0h 15m' },
    { id: 'gtl-3', name: 'Bypass Road Crossing', timeOffset: '+0h 30m' }
  ],
  Chennai: [
    { id: 'chn-1', name: 'Koyambedu CMBT Bus Stand', timeOffset: '+0h 00m' },
    { id: 'chn-2', name: 'Guindy (Near Kathipara Bridge)', timeOffset: '+0h 30m' },
    { id: 'chn-3', name: 'Tambaram Sanatorium', timeOffset: '+1h 00m' }
  ]
}

export default function App() {
  const [activeTab, setActiveTab] = useState('book')
  const [source, setSource] = useState('Bengaluru')
  const [destination, setDestination] = useState('Hyderabad')
  const [journeyDate, setJourneyDate] = useState('2026-11-10')
  const [selectedBus, setSelectedBus] = useState(null)
  const [selectedSeats, setSelectedSeats] = useState([])

  // Dynamic Boarding and Dropping points
  const [selectedBoardingPoint, setSelectedBoardingPoint] = useState('')
  const [selectedDroppingPoint, setSelectedDroppingPoint] = useState('')

  // User Session & Login Modal State
  const [currentUser, setCurrentUser] = useState(() => {
    return localStorage.getItem('anhar_user_phone') || ''
  })
  const [currentUserName, setCurrentUserName] = useState(() => {
    return localStorage.getItem('anhar_user_name') || ''
  })
  const [currentUserEmail, setCurrentUserEmail] = useState(() => {
    return localStorage.getItem('anhar_user_email') || ''
  })

  // OTP Verification States
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [loginStep, setLoginStep] = useState('DETAILS') // 'DETAILS' | 'OTP'
  const [loginForm, setLoginForm] = useState({
    name: '',
    email: '',
    phone: ''
  })
  const [otpInput, setOtpInput] = useState('')
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)

  // In-App Wallet balance (persisted in MongoDB Atlas, starts at 0)
  const [walletBalance, setWalletBalance] = useState(0)

  // Fetch real-time wallet balance from MongoDB whenever user logs in or switches
  useEffect(() => {
    const fetchUserWallet = async () => {
      if (currentUser) {
        try {
          const res = await api.getWallet(currentUser)
          if (res && res.success) {
            setWalletBalance(res.balance)
          }
        } catch (err) {
          console.error('Failed to fetch wallet from MongoDB:', err)
        }
      } else {
        setWalletBalance(0)
      }
    }
    fetchUserWallet()
  }, [currentUser])

  // Filter & Sort States
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('ALL')
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('ALL')
  const [sortBy, setSortBy] = useState('PRICE_ASC')

  // Passenger & Modal States
  const [showPassengerModal, setShowPassengerModal] = useState(false)
  const [passengerDetails, setPassengerDetails] = useState([])
  const [contactInfo, setContactInfo] = useState({
    phone: localStorage.getItem('anhar_user_phone') || '',
    email: localStorage.getItem('anhar_user_email') || ''
  })

  // Payment Gateway Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('upi')
  const [upiOption, setUpiOption] = useState('gpay')
  const [useWalletOffset, setUseWalletOffset] = useState(false)
  const [pendingBookingData, setPendingBookingData] = useState(null)

  // Active User Bookings (Persisted in MongoDB)
  const [myBookings, setMyBookings] = useState([])

  // Printable Ticket Modal State
  const [viewTicket, setViewTicket] = useState(null)

  // Real-time Cutoff Tracker
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Resale Marketplace Listings (Persisted in MongoDB)
  const [resaleListings, setResaleListings] = useState([])

  // Helper to refresh data from MongoDB
  const fetchLatestData = async () => {
    try {
      const [dbBookings, dbResale] = await Promise.all([
        api.getBookings(),
        api.getResaleListings()
      ])
      if (Array.isArray(dbBookings)) {
        setMyBookings(dbBookings)
      }
      if (Array.isArray(dbResale)) {
        setResaleListings(dbResale)
      }
    } catch (err) {
      console.error('Failed to load records from MongoDB:', err)
    }
  }

  // Initial Load from MongoDB Atlas
  useEffect(() => {
    fetchLatestData()
  }, [])

  // User personal bookings filtered by logged-in phone number
  const userPersonalBookings = useMemo(() => {
    if (!currentUser) return []
    return myBookings.filter(b => b.contact?.phone === currentUser)
  }, [myBookings, currentUser])

  // Login via Phone OTP Handlers
  const handleRequestOtp = async (e) => {
    e.preventDefault()
    const cleanPhone = loginForm.phone.trim().replace(/\D/g, '').slice(-10)
    if (cleanPhone.length !== 10) {
      alert('Please enter a valid 10-digit mobile number.')
      return
    }

    setIsSendingOtp(true)
    try {
      const res = await api.sendOtp(cleanPhone)
      if (res && res.success) {
        setLoginStep('OTP')
        if (res.devOtp) {
          alert(`Verification Code: ${res.devOtp}`)
        } else {
          alert(`OTP sent via SMS to +91 ${cleanPhone}`)
        }
      } else {
        alert(res?.message || 'Failed to send OTP. Please try again.')
      }
    } catch (err) {
      alert('Error contacting verification service. Please try again.')
    } finally {
      setIsSendingOtp(false)
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    const cleanPhone = loginForm.phone.trim().replace(/\D/g, '').slice(-10)

    setIsVerifyingOtp(true)
    try {
      const res = await api.verifyOtp({
        phone: cleanPhone,
        name: loginForm.name.trim(),
        email: loginForm.email.trim(),
        otp: otpInput.trim()
      })

      if (res && res.success) {
        localStorage.setItem('anhar_user_phone', cleanPhone)
        localStorage.setItem('anhar_user_name', loginForm.name.trim())
        localStorage.setItem('anhar_user_email', loginForm.email.trim())

        setCurrentUser(cleanPhone)
        setCurrentUserName(loginForm.name.trim())
        setCurrentUserEmail(loginForm.email.trim())
        setContactInfo({ phone: cleanPhone, email: loginForm.email.trim() })

        setShowLoginModal(false)
        setLoginStep('DETAILS')
        setLoginForm({ name: '', email: '', phone: '' })
        setOtpInput('')
        alert(`Welcome, ${loginForm.name.trim() || 'Passenger'}! You are now verified.`)
      } else {
        alert(res?.message || 'Invalid or expired OTP. Please try again.')
      }
    } catch (err) {
      alert('Verification failed. Please check your network and retry.')
    } finally {
      setIsVerifyingOtp(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('anhar_user_phone')
    localStorage.removeItem('anhar_user_name')
    localStorage.removeItem('anhar_user_email')
    setCurrentUser('')
    setCurrentUserName('')
    setCurrentUserEmail('')
    setWalletBalance(0)
    alert('Logged out successfully.')
  }

  // Partial Resale Selection Modal (Seller Side)
  const [resellingBooking, setResellingBooking] = useState(null)
  const [seatsToResell, setSeatsToResell] = useState([])
  const [resaleMarkup, setResaleMarkup] = useState(0)
  const [isSubmittingResale, setIsSubmittingResale] = useState(false)

  // Resale Buyer Checkout Modal (Buyer Side)
  const [selectedResaleItem, setSelectedResaleItem] = useState(null)
  const [buyerDetails, setBuyerDetails] = useState({
    name: '',
    age: '',
    gender: 'Male',
    phone: '',
    email: ''
  })

  // Comprehensive fleet with schedules and categories
  const buses = [
    {
      id: 1,
      name: 'ANHAR Super Luxury AC Sleeper',
      busNumber: 'AP 04 TX 9924',
      type: '2+1 AC Sleeper',
      category: 'AC Sleeper',
      departure: '21:30',
      departureHour: 21.5,
      arrival: '06:00',
      duration: '8h 30m',
      rating: 4.8,
      price: 1150,
      totalSeats: 30,
      availableSeats: 12,
      bookedSeats: [3, 7]
    },
    {
      id: 2,
      name: 'ANHAR Multi-Axle Volvo Semi-Sleeper',
      busNumber: 'KA 01 F 4402',
      type: '2+2 Pushback AC',
      category: 'Volvo',
      departure: '22:15',
      departureHour: 22.25,
      arrival: '06:45',
      duration: '8h 30m',
      rating: 4.9,
      price: 890,
      totalSeats: 40,
      availableSeats: 8,
      bookedSeats: [2, 5]
    },
    {
      id: 3,
      name: 'ANHAR Express Seater (Morning Superfast)',
      busNumber: 'AP 21 Z 1042',
      type: '2+2 Highback Non-AC',
      category: 'Non-AC',
      departure: '07:30',
      departureHour: 7.5,
      arrival: '16:00',
      duration: '8h 30m',
      rating: 4.3,
      price: 550,
      totalSeats: 45,
      availableSeats: 24,
      bookedSeats: [1, 6]
    },
    {
      id: 4,
      name: 'ANHAR Royal Multi-Axle AC Sleeper',
      busNumber: 'KA 53 EA 8810',
      type: '2+1 Executive AC Sleeper',
      category: 'AC Sleeper',
      departure: '19:45',
      departureHour: 19.75,
      arrival: '04:15',
      duration: '8h 30m',
      rating: 4.7,
      price: 1350,
      totalSeats: 30,
      availableSeats: 6,
      bookedSeats: [4, 8, 9]
    },
    {
      id: 5,
      name: 'ANHAR Midnight Express Volvo',
      busNumber: 'TS 08 UB 7712',
      type: '2+2 Pushback AC',
      category: 'Volvo',
      departure: '23:45',
      departureHour: 23.75,
      arrival: '08:00',
      duration: '8h 15m',
      rating: 4.6,
      price: 980,
      totalSeats: 40,
      availableSeats: 15,
      bookedSeats: [11]
    }
  ]

  // Filter & Sort Logic
  const filteredAndSortedBuses = useMemo(() => {
    return buses
      .filter((bus) => {
        if (selectedTypeFilter !== 'ALL' && bus.category !== selectedTypeFilter) {
          return false
        }
        if (selectedTimeSlot === 'MORNING' && (bus.departureHour < 6 || bus.departureHour >= 12)) {
          return false
        }
        if (selectedTimeSlot === 'EVENING' && (bus.departureHour < 18 || bus.departureHour >= 23)) {
          return false
        }
        if (selectedTimeSlot === 'NIGHT' && bus.departureHour < 23) {
          return false
        }
        return true
      })
      .sort((a, b) => {
        if (sortBy === 'PRICE_ASC') return a.price - b.price
        if (sortBy === 'PRICE_DESC') return b.price - a.price
        if (sortBy === 'TIME_ASC') return a.departureHour - b.departureHour
        if (sortBy === 'RATING_DESC') return b.rating - a.rating
        return 0
      })
  }, [buses, selectedTypeFilter, selectedTimeSlot, sortBy])

  const getCutoffCountdown = (cutoffTimestamp) => {
    const diff = cutoffTimestamp - currentTime.getTime()
    if (diff <= 0) {
      return { isExpired: true, text: 'Resale Window Closed' }
    }
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)
    const pad = (n) => String(n).padStart(2, '0')
    return {
      isExpired: false,
      text: `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`
    }
  }

  useEffect(() => {
    setSelectedSeats([])
    setSelectedBus(null)
    const defaultBoarding = CITY_POINTS[source]?.[0]?.name || source
    const defaultDropping = CITY_POINTS[destination]?.[0]?.name || destination
    setSelectedBoardingPoint(defaultBoarding)
    setSelectedDroppingPoint(defaultDropping)
  }, [source, destination])

  // Checks ALL bookings across MongoDB so booked seats lock globally
  const isSeatBooked = (seatNum, busId) => {
    const defaultBooked = buses.find(b => Number(b.id) === Number(busId))?.bookedSeats.includes(Number(seatNum))
    if (defaultBooked) return true

    return myBookings.some(booking => 
      Number(booking.busId) === Number(busId) && 
      booking.status !== 'ALL_RESOLD' &&
      booking.status !== 'CANCELLED' &&
      booking.passengers && 
      booking.passengers.some(p => Number(p.seatNumber) === Number(seatNum))
    )
  }

  const handleSeatClick = (seatNumber, bus) => {
    const resaleItem = resaleListings.find(
      r => Number(r.busId) === Number(bus.id) && Number(r.seatNumber) === Number(seatNumber) && r.status === 'AVAILABLE'
    )

    if (resaleItem) {
      const countdown = getCutoffCountdown(resaleItem.cutoffTimestamp)
      if (countdown.isExpired) {
        alert('This seat can no longer be purchased. Resale closes 1 hour prior to bus departure.')
        return
      }
      openBuyerModal(resaleItem)
      return
    }

    if (selectedSeats.includes(seatNumber)) {
      setSelectedSeats(selectedSeats.filter(s => s !== seatNumber))
    } else {
      setSelectedSeats([...selectedSeats, seatNumber])
    }
  }

  const openBusDetails = (bus) => {
    if (selectedBus?.id === bus.id) {
      setSelectedBus(null)
      setSelectedSeats([])
    } else {
      setSelectedBus(bus)
      setSelectedSeats([])
      setSelectedBoardingPoint(CITY_POINTS[source][0].name)
      setSelectedDroppingPoint(CITY_POINTS[destination][0].name)
    }
  }

  const handleProceedToDetails = () => {
    if (selectedSeats.length === 0) return
    const initialPassengers = selectedSeats.map(seat => ({
      seatNumber: seat,
      name: '',
      age: '',
      gender: 'Male'
    }))
    setPassengerDetails(initialPassengers)
    if (currentUser && !contactInfo.phone) {
      setContactInfo(prev => ({ 
        ...prev, 
        phone: currentUser, 
        email: currentUserEmail || prev.email 
      }))
    }
    setShowPassengerModal(true)
  }

  const handlePassengerChange = (index, field, value) => {
    const updated = [...passengerDetails]
    updated[index][field] = value
    setPassengerDetails(updated)
  }

  const handleProceedToPayment = (e) => {
    e.preventDefault()
    const baseFare = selectedSeats.length * selectedBus.price
    const gstAmount = Math.round(baseFare * 0.05)
    const grandTotal = baseFare + gstAmount

    // Auto-login passenger session with the booking phone number
    if (contactInfo.phone && contactInfo.phone !== currentUser) {
      const cleanPhone = contactInfo.phone.replace(/\D/g, '').slice(-10)
      localStorage.setItem('anhar_user_phone', cleanPhone)
      setCurrentUser(cleanPhone)
    }

    setPendingBookingData({
      type: 'PRIMARY',
      bus: selectedBus,
      seats: [...selectedSeats],
      passengers: [...passengerDetails],
      contact: { ...contactInfo },
      baseFare,
      gstAmount,
      grandTotal,
      boarding: selectedBoardingPoint,
      dropping: selectedDroppingPoint
    })

    setUseWalletOffset(false)
    setShowPassengerModal(false)
    setShowPaymentModal(true)
  }

  const handlePaymentSuccess = async () => {
    const newPnr = 'ANH' + Math.floor(100000 + Math.random() * 900000)
    let deduction = 0
    let remainingToPay = pendingBookingData.grandTotal

    if (useWalletOffset && walletBalance > 0) {
      deduction = Math.min(walletBalance, pendingBookingData.grandTotal)
      try {
        await api.updateWallet(currentUser, -deduction)
        setWalletBalance(prev => prev - deduction)
      } catch (err) {
        console.error('Wallet deduction error:', err)
      }
      remainingToPay -= deduction
    }

    const newBooking = {
      pnr: newPnr,
      busId: pendingBookingData.bus.id,
      busName: pendingBookingData.bus.name,
      busNumber: pendingBookingData.bus.busNumber,
      route: `${source} → ${destination}`,
      departure: pendingBookingData.bus.departure,
      arrival: pendingBookingData.bus.arrival,
      journeyDate: journeyDate,
      boarding: pendingBookingData.boarding,
      dropping: pendingBookingData.dropping,
      unitPrice: pendingBookingData.bus.price,
      passengers: [...pendingBookingData.passengers],
      contact: { ...pendingBookingData.contact },
      baseFare: pendingBookingData.baseFare,
      gstAmount: pendingBookingData.gstAmount,
      totalPaid: pendingBookingData.grandTotal,
      walletDeducted: deduction,
      paymentMethod: deduction > 0 && remainingToPay === 0 
        ? 'ANHAR WALLET' 
        : deduction > 0 
          ? `WALLET (₹${deduction}) + ${paymentMethod.toUpperCase()}` 
          : paymentMethod.toUpperCase(),
      status: 'CONFIRMED'
    }

    // Persist booking directly to MongoDB Atlas
    await api.createBooking(newBooking)

    // Pull refreshed records from MongoDB
    await fetchLatestData()

    setShowPaymentModal(false)
    setPendingBookingData(null)
    setSelectedSeats([])
    setSelectedBus(null)
    setUseWalletOffset(false)
    alert(`Payment Successful! Ticket Confirmed with PNR: ${newPnr}`)
    setActiveTab('my-bookings')
  }

  const openResaleModal = (booking) => {
    setResellingBooking(booking)
    setSeatsToResell([])
    setResaleMarkup(0)
  }

  const toggleSeatToResell = (seatNum) => {
    if (seatsToResell.includes(seatNum)) {
      setSeatsToResell(seatsToResell.filter(s => s !== seatNum))
    } else {
      setSeatsToResell([...seatsToResell, seatNum])
    }
  }

  // Prevents multiple rapid clicks from creating duplicate resale items
  const confirmResaleListing = async () => {
    if (seatsToResell.length === 0 || isSubmittingResale) return

    setIsSubmittingResale(true)

    try {
      const listingCutoff = Date.now() + 3 * 60 * 60 * 1000

      // Capture the seller phone reliably from booking contact or active session
      const rawSellerPhone = 
        resellingBooking.contact?.phone || 
        currentUser || 
        localStorage.getItem('anhar_user_phone') || 
        ''

      const cleanSellerPhone = String(rawSellerPhone).replace(/\D/g, '').slice(-10)

      if (!cleanSellerPhone || cleanSellerPhone.length !== 10) {
        alert('Valid 10-digit mobile number required to receive your resale payout.')
        setIsSubmittingResale(false)
        return
      }

      const newListings = seatsToResell.map((seatNum) => ({
        id: `RES-${Date.now()}-${seatNum}`,
        busId: resellingBooking.busId,
        busName: resellingBooking.busName,
        busNumber: resellingBooking.busNumber || 'AP 04 TX 9924',
        route: resellingBooking.route,
        date: resellingBooking.journeyDate,
        time: resellingBooking.departure,
        cutoffTimestamp: listingCutoff,
        boarding: resellingBooking.boarding,
        dropping: resellingBooking.dropping,
        seatNumber: seatNum,
        originalPrice: resellingBooking.unitPrice,
        resalePrice: resellingBooking.unitPrice + Number(resaleMarkup),
        sellerPnr: resellingBooking.pnr,
        sellerName: resellingBooking.passengers.find(p => p.seatNumber === seatNum)?.name || currentUserName || 'Passenger',
        sellerPhone: cleanSellerPhone,
        status: 'AVAILABLE'
      }))

      const updatedBookings = myBookings.map(b => {
        if (b.pnr === resellingBooking.pnr) {
          const remaining = b.passengers.filter(p => !seatsToResell.includes(p.seatNumber))
          return {
            ...b,
            passengers: remaining,
            totalPaid: remaining.length * b.unitPrice,
            status: remaining.length === 0 ? 'ALL_RESOLD' : 'PARTIALLY_RESOLD'
          }
        }
        return b
      })

      // Persist resale listings and updated booking state to MongoDB
      await api.publishResale(newListings, updatedBookings)

      await fetchLatestData()
      setResellingBooking(null)
      setSeatsToResell([])
      alert(`Listed ${newListings.length} seat(s) for resale! Timer is live.`)
      setActiveTab('resale-market')
    } catch (err) {
      alert('Failed to publish resale listing. Please try again.')
    } finally {
      setIsSubmittingResale(false)
    }
  }

  const openBuyerModal = (listing) => {
    setSelectedResaleItem(listing)
    setBuyerDetails({
      name: currentUserName || '',
      age: '',
      gender: 'Male',
      phone: currentUser || '',
      email: currentUserEmail || ''
    })
  }

  const handleResalePurchaseSubmit = async (e) => {
    e.preventDefault()

    const newBuyerPnr = 'RES-ANH' + Math.floor(100000 + Math.random() * 900000)
    const newBuyerBooking = {
      pnr: newBuyerPnr,
      busId: selectedResaleItem.busId,
      busName: selectedResaleItem.busName,
      busNumber: selectedResaleItem.busNumber || 'AP 04 TX 9924',
      route: selectedResaleItem.route,
      departure: selectedResaleItem.time,
      arrival: 'Next Morning',
      journeyDate: selectedResaleItem.date,
      boarding: selectedResaleItem.boarding,
      dropping: selectedResaleItem.dropping,
      unitPrice: selectedResaleItem.resalePrice,
      passengers: [{
        seatNumber: selectedResaleItem.seatNumber,
        name: buyerDetails.name,
        age: Number(buyerDetails.age),
        gender: buyerDetails.gender
      }],
      contact: {
        phone: buyerDetails.phone,
        email: buyerDetails.email
      },
      baseFare: selectedResaleItem.resalePrice,
      totalPaid: selectedResaleItem.resalePrice,
      paymentMethod: 'UPI / INSTANT',
      status: 'VERIFIED_RESALE_TICKET'
    }

    // Process resale purchase: Backend automatically credits seller's User document in MongoDB Atlas
    const res = await api.buyResale(selectedResaleItem.id, newBuyerBooking)

    if (res.success) {
      // Set active session to buyer
      if (buyerDetails.phone) {
        const cleanBuyerPhone = buyerDetails.phone.replace(/\D/g, '').slice(-10)
        localStorage.setItem('anhar_user_phone', cleanBuyerPhone)
        setCurrentUser(cleanBuyerPhone)
        try {
          const buyerWallet = await api.getWallet(cleanBuyerPhone)
          if (buyerWallet && buyerWallet.success) {
            setWalletBalance(buyerWallet.balance)
          }
        } catch (err) {
          console.error('Failed to sync buyer wallet:', err)
        }
      }

      await fetchLatestData()
      setSelectedResaleItem(null)
      alert(`Success! Ticket confirmed with PNR: ${newBuyerPnr}. ₹${selectedResaleItem.resalePrice} has been credited to seller's MongoDB wallet.`)
      setActiveTab('my-bookings')
    } else {
      alert(res.message || 'Failed to complete resale ticket transaction.')
    }
  }

  const swapCities = () => {
    const temp = source
    setSource(destination)
    setDestination(temp)
  }

  const handlePrintTicket = () => {
    window.print()
  }

  const addFundsToWallet = async () => {
    if (!currentUser) {
      setShowLoginModal(true)
      return
    }
    const amount = Number(prompt('Enter amount to add to ANHAR Wallet (₹):', '500'))
    if (amount > 0) {
      try {
        const res = await api.updateWallet(currentUser, amount)
        if (res && res.success) {
          setWalletBalance(res.balance)
          alert(`₹${amount} added successfully! New Wallet Balance: ₹${res.balance}`)
        }
      } catch (err) {
        alert('Failed to update wallet in database.')
      }
    }
  }

  const walletDeductionPossible = pendingBookingData 
    ? Math.min(walletBalance, pendingBookingData.grandTotal) 
    : 0
  const finalPayableAfterWallet = pendingBookingData 
    ? useWalletOffset 
      ? Math.max(0, pendingBookingData.grandTotal - walletDeductionPossible) 
      : pendingBookingData.grandTotal
    : 0

  return (
    <div className="anhar-app">
      {/* Header */}
      <header className="navbar no-print">
        <div className="nav-container">
          <div className="brand">
            <span className="bus-icon">🚌</span>
            <span className="brand-title">ANHAR BUS</span>
          </div>
          <nav className="nav-links">
            <button className={`nav-btn ${activeTab === 'book' ? 'active' : ''}`} onClick={() => setActiveTab('book')}>
              Book Buses
            </button>
            <button className={`nav-btn ${activeTab === 'resale-market' ? 'active' : ''}`} onClick={() => setActiveTab('resale-market')}>
              Resale Deals <span className="market-badge">{resaleListings.length}</span>
            </button>
            <button 
              className={`nav-btn ${activeTab === 'my-bookings' ? 'active' : ''}`} 
              onClick={() => {
                if (!currentUser) {
                  setShowLoginModal(true)
                } else {
                  setActiveTab('my-bookings')
                }
              }}
            >
              My Bookings ({userPersonalBookings.length})
            </button>
            <div className="wallet-chip" onClick={addFundsToWallet} title="Click to Top-Up Wallet">
              💰 Wallet: <strong>₹{walletBalance}</strong> <span className="wallet-plus">+</span>
            </div>
            {currentUser ? (
              <div className="user-profile-badge">
                <span>📱 {currentUserName ? `${currentUserName} (+91 ${currentUser})` : `+91 ${currentUser}`}</span>
                <button className="logout-mini-btn" onClick={handleLogout} title="Logout">✕</button>
              </div>
            ) : (
              <button className="login-nav-btn" onClick={() => setShowLoginModal(true)}>
                Login
              </button>
            )}
          </nav>
        </div>
      </header>

      {/* TAB 1: BOOKING WITH FILTERS & SORTING */}
      {activeTab === 'book' && (
        <>
          <section className="search-hero no-print">
            <div className="search-card">
              <h2>Book Your Bus Ticket</h2>
              <div className="search-grid">
                <div className="input-group">
                  <label>From</label>
                  <select value={source} onChange={(e) => setSource(e.target.value)}>
                    <option value="Bengaluru">Bengaluru</option>
                    <option value="Hyderabad">Hyderabad</option>
                    <option value="Guntakal">Guntakal</option>
                    <option value="Chennai">Chennai</option>
                  </select>
                </div>

                <div className="swap-btn-container">
                  <button type="button" className="swap-city-btn" title="Swap Cities" onClick={swapCities}>
                    ⇄
                  </button>
                </div>

                <div className="input-group">
                  <label>To</label>
                  <select value={destination} onChange={(e) => setDestination(e.target.value)}>
                    <option value="Hyderabad">Hyderabad</option>
                    <option value="Bengaluru">Bengaluru</option>
                    <option value="Guntakal">Guntakal</option>
                    <option value="Chennai">Chennai</option>
                  </select>
                </div>

                <div className="input-group">
                  <label>Date</label>
                  <input type="date" value={journeyDate} onChange={(e) => setJourneyDate(e.target.value)} />
                </div>
                <button className="search-btn">Search Buses</button>
              </div>
            </div>
          </section>

          <main className="results-container no-print">
            <div className="results-header-row">
              <div>
                <h3>Available Buses: {source} → {destination}</h3>
                <p className="route-sub-count">Showing {filteredAndSortedBuses.length} of {buses.length} buses</p>
              </div>

              {/* Quick Sort Dropdown */}
              <div className="sort-control-box">
                <label>Sort By:</label>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="PRICE_ASC">Price: Low to High</option>
                  <option value="PRICE_DESC">Price: High to Low</option>
                  <option value="TIME_ASC">Departure: Earliest First</option>
                  <option value="RATING_DESC">Top Rated (★)</option>
                </select>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="filters-strip">
              <div className="filter-group">
                <span className="filter-title">Bus Type:</span>
                <div className="filter-pills">
                  <button 
                    className={`pill-btn ${selectedTypeFilter === 'ALL' ? 'active' : ''}`}
                    onClick={() => setSelectedTypeFilter('ALL')}
                  >
                    All Types
                  </button>
                  <button 
                    className={`pill-btn ${selectedTypeFilter === 'AC Sleeper' ? 'active' : ''}`}
                    onClick={() => setSelectedTypeFilter('AC Sleeper')}
                  >
                    🛏️ AC Sleeper
                  </button>
                  <button 
                    className={`pill-btn ${selectedTypeFilter === 'Volvo' ? 'active' : ''}`}
                    onClick={() => setSelectedTypeFilter('Volvo')}
                  >
                    🚌 Volvo Multi-Axle
                  </button>
                  <button 
                    className={`pill-btn ${selectedTypeFilter === 'Non-AC' ? 'active' : ''}`}
                    onClick={() => setSelectedTypeFilter('Non-AC')}
                  >
                    💺 Non-AC Seater
                  </button>
                </div>
              </div>

              <div className="filter-group">
                <span className="filter-title">Departure Time:</span>
                <div className="filter-pills">
                  <button 
                    className={`pill-btn ${selectedTimeSlot === 'ALL' ? 'active' : ''}`}
                    onClick={() => setSelectedTimeSlot('ALL')}
                  >
                    Any Time
                  </button>
                  <button 
                    className={`pill-btn ${selectedTimeSlot === 'MORNING' ? 'active' : ''}`}
                    onClick={() => setSelectedTimeSlot('MORNING')}
                  >
                    🌅 Morning (06:00 - 12:00)
                  </button>
                  <button 
                    className={`pill-btn ${selectedTimeSlot === 'EVENING' ? 'active' : ''}`}
                    onClick={() => setSelectedTimeSlot('EVENING')}
                  >
                    🌇 Evening (18:00 - 23:00)
                  </button>
                  <button 
                    className={`pill-btn ${selectedTimeSlot === 'NIGHT' ? 'active' : ''}`}
                    onClick={() => setSelectedTimeSlot('NIGHT')}
                  >
                    🌙 Night (After 23:00)
                  </button>
                </div>
              </div>
            </div>

            {/* Bus Cards List */}
            <div className="bus-list">
              {filteredAndSortedBuses.length === 0 ? (
                <div className="no-buses-found">
                  <p>No buses match your selected filter criteria.</p>
                  <button 
                    className="reset-filters-btn"
                    onClick={() => {
                      setSelectedTypeFilter('ALL')
                      setSelectedTimeSlot('ALL')
                    }}
                  >
                    Reset Filters
                  </button>
                </div>
              ) : (
                filteredAndSortedBuses.map((bus) => (
                  <div key={bus.id} className="bus-card">
                    <div className="bus-main-info">
                      <div>
                        <h4>{bus.name}</h4>
                        <span className="bus-badge">{bus.type}</span>
                      </div>
                      <div className="rating-tag">{bus.rating} ★</div>
                    </div>

                    <div className="bus-timings">
                      <div>
                        <strong>{bus.departure}</strong>
                        <p>{source}</p>
                      </div>
                      <div className="duration">
                        <span>{bus.duration}</span>
                        <div className="route-line"></div>
                      </div>
                      <div>
                        <strong>{bus.arrival}</strong>
                        <p>{destination}</p>
                      </div>
                      <div className="bus-price">
                        <span className="fare-label">Base Fare</span>
                        <h3>₹{bus.price}</h3>
                      </div>
                    </div>

                    <div className="bus-actions">
                      <span className="seats-count">{bus.availableSeats} regular seats remaining</span>
                      <button 
                        className="select-seat-btn"
                        onClick={() => openBusDetails(bus)}
                      >
                        {selectedBus?.id === bus.id ? 'Close Seat Map' : 'Select Seats'}
                      </button>
                    </div>

                    {/* SEAT MAP */}
                    {selectedBus?.id === bus.id && (
                      <div className="seat-layout-panel">
                        <div className="seat-map-header">
                          <h5>Seat Selection Layout</h5>
                          <div className="seat-legend">
                            <div className="legend-item"><span className="legend-sample available-sample"></span> Available</div>
                            <div className="legend-item"><span className="legend-sample selected-sample"></span> Selected</div>
                            <div className="legend-item"><span className="legend-sample booked-sample"></span> Booked</div>
                            <div className="legend-item"><span className="legend-sample resale-sample"></span> Resale Available</div>
                          </div>
                        </div>

                        <div className="bus-interior-box">
                          <div className="steering-wheel">🚍 Driver Deck</div>
                          <div className="seat-grid">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => {
                              const isSelected = selectedSeats.includes(num)
                              const resaleItem = resaleListings.find(
                                r => Number(r.busId) === Number(bus.id) && Number(r.seatNumber) === Number(num) && r.status === 'AVAILABLE'
                              )
                              const isBooked = !resaleItem && isSeatBooked(num, bus.id)
                              const isResale = !resaleItem ? false : true

                              let seatClass = 'seat-box'
                              let label = num

                              if (isSelected) {
                                seatClass += ' seat-selected'
                              } else if (isResale) {
                                seatClass += ' seat-resale'
                                label = `${num} ⚡`
                              } else if (isBooked) {
                                seatClass += ' seat-booked'
                              }

                              return (
                                <button
                                  key={num}
                                  disabled={isBooked}
                                  className={seatClass}
                                  title={isResale ? 'Click to Buy Resale Seat!' : isBooked ? 'Seat Booked' : `Seat ${num}`}
                                  onClick={() => handleSeatClick(num, bus)}
                                >
                                  {label}
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        <div className="points-selection-grid">
                          <div className="points-box">
                            <label className="points-label">📍 Boarding Points in {source}</label>
                            <div className="points-options">
                              {(CITY_POINTS[source] || []).map((bp) => {
                                const isSelected = selectedBoardingPoint === bp.name
                                return (
                                  <div 
                                    key={bp.id} 
                                    className={`point-option-card ${isSelected ? 'point-selected' : ''}`}
                                    onClick={() => setSelectedBoardingPoint(bp.name)}
                                  >
                                    <input type="radio" checked={isSelected} readOnly />
                                    <div>
                                      <strong>{bp.name}</strong>
                                      <span className="point-time">Timing Offset: {bp.timeOffset}</span>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>

                          <div className="points-box">
                            <label className="points-label">🎯 Dropping Points in {destination}</label>
                            <div className="points-options">
                              {(CITY_POINTS[destination] || []).map((dp) => {
                                const isSelected = selectedDroppingPoint === dp.name
                                return (
                                  <div 
                                    key={dp.id} 
                                    className={`point-option-card ${isSelected ? 'point-selected' : ''}`}
                                    onClick={() => setSelectedDroppingPoint(dp.name)}
                                  >
                                    <input type="radio" checked={isSelected} readOnly />
                                    <div>
                                      <strong>{dp.name}</strong>
                                      <span className="point-time">Arrival Offset: {dp.timeOffset}</span>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        </div>

                        <div className="seat-summary">
                          <div>
                            <p>Selected Seats ({selectedSeats.length}): <strong>{selectedSeats.join(', ') || 'None'}</strong></p>
                            <p className="chosen-points-preview">
                              <strong>Pickup:</strong> {selectedBoardingPoint} | <strong>Drop:</strong> {selectedDroppingPoint}
                            </p>
                          </div>
                          <div className="action-col">
                            <span className="summary-fare">Base Fare: <strong>₹{selectedSeats.length * bus.price}</strong></span>
                            <button 
                              className="proceed-btn" 
                              disabled={selectedSeats.length === 0}
                              onClick={handleProceedToDetails}
                            >
                              Proceed to Passenger Details
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </main>
        </>
      )}

      {/* TAB 2: MY BOOKINGS (PRIVATE TO LOGGED-IN PASSENGER) */}
      {activeTab === 'my-bookings' && (
        <main className="results-container no-print">
          <div className="section-title-row">
            <h2>My Bookings</h2>
            <p>View tickets, print conductor boarding passes, or list seats for resale</p>
          </div>

          {!currentUser ? (
            <div className="empty-state">
              <p>Please log in with your mobile number to view and manage your tickets.</p>
              <button className="search-btn" onClick={() => setShowLoginModal(true)}>
                Login with Mobile Number
              </button>
            </div>
          ) : userPersonalBookings.length === 0 ? (
            <div className="empty-state">
              <p>No active bookings found for +91 {currentUser}.</p>
              <button className="search-btn" onClick={() => setActiveTab('book')}>
                Book a Bus Ticket
              </button>
            </div>
          ) : (
            <div className="bus-list">
              {userPersonalBookings.map((b) => (
                <div key={b.pnr} className="booking-card">
                  <div className="booking-top">
                    <div>
                      <span className="pnr-tag">PNR: {b.pnr}</span>
                      <h4>{b.busName}</h4>
                      <p className="route-sub">{b.route} • {b.journeyDate} at {b.departure}</p>
                      <p className="points-sub">📍 <strong>Boarding:</strong> {b.boarding} | 🎯 <strong>Drop:</strong> {b.dropping}</p>
                    </div>
                    <div className="booking-status-badge">{b.status}</div>
                  </div>

                  <div className="passenger-seat-list">
                    <h5>Confirmed Passengers & Seats:</h5>
                    <div className="passengers-chips">
                      {(b.passengers || []).map(p => (
                        <div key={p.seatNumber} className="seat-pill">
                          <strong>Seat {p.seatNumber}</strong>: {p.name} ({p.gender}, {p.age} yrs)
                        </div>
                      ))}
                    </div>
                    {b.contact?.phone && (
                      <p className="contact-sub">Contact: +91 {b.contact.phone} | {b.contact.email}</p>
                    )}
                  </div>

                  <div className="booking-footer">
                    <span className="total-label">Total Paid: <strong>₹{b.totalPaid}</strong> <small>({b.paymentMethod || 'UPI'})</small></span>
                    <div className="booking-btn-row">
                      <button className="view-ticket-btn" onClick={() => setViewTicket(b)}>
                        🖨️ View & Print Ticket
                      </button>
                      {b.passengers && b.passengers.length > 0 && b.status !== 'VERIFIED_RESALE_TICKET' && (
                        <button className="resale-trigger-btn" onClick={() => openResaleModal(b)}>
                          🔄 Resale Seats ({b.passengers.length})
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      )}

      {/* TAB 3: RESALE MARKETPLACE */}
      {activeTab === 'resale-market' && (
        <main className="results-container no-print">
          <div className="section-title-row">
            <h2>⚡ ANHAR Quick-Sale Board</h2>
            <p>Direct passenger re-sales. All tickets auto-lock 1 hour before bus departure.</p>
          </div>

          <div className="bus-list">
            {resaleListings.length === 0 ? (
              <p>No seats currently listed for resale.</p>
            ) : (
              resaleListings.map(item => {
                const countdown = getCutoffCountdown(item.cutoffTimestamp)
                return (
                  <div key={item.id} className={`bus-card resale-card ${countdown.isExpired ? 'resale-card-expired' : ''}`}>
                    <div className="bus-main-info">
                      <div>
                        <div className="resale-badge-row">
                          <span className="verified-resale-badge">✔ Verified Passenger Resale</span>
                          {countdown.isExpired ? (
                            <span className="timer-badge expired-timer">🔒 Cutoff Reached (Resale Closed)</span>
                          ) : (
                            <span className="timer-badge active-timer">
                              ⏱️ Closes in: <strong>{countdown.text}</strong>
                            </span>
                          )}
                        </div>
                        <h4>{item.busName}</h4>
                        <p>{item.route} • {item.date} at {item.time}</p>
                        <p className="points-sub">📍 {item.boarding} ➔ 🎯 {item.dropping}</p>
                        <span className="seller-sub">Original Passenger: {item.sellerName}</span>
                      </div>
                      <div className="resale-pricing-box">
                        <span className="orig-price">Base: ₹{item.originalPrice}</span>
                        <h3 className="resale-price">₹{item.resalePrice}</h3>
                        <span className="seat-callout">Seat No: <strong>{item.seatNumber}</strong></span>
                      </div>
                    </div>

                    <div className="resale-actions">
                      <span className="cutoff-note">
                        {countdown.isExpired 
                          ? '❌ Window closed 1 hr before departure' 
                          : '⏰ Seat expires from board 1 hr before departure'}
                      </span>
                      <button 
                        disabled={countdown.isExpired}
                        className={`buy-resale-btn ${countdown.isExpired ? 'btn-disabled' : ''}`}
                        onClick={() => openBuyerModal(item)}
                      >
                        {countdown.isExpired ? 'Sale Closed' : `Buy Seat ${item.seatNumber} & Enter Details`}
                      </button>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </main>
      )}

      {/* MODAL 0: BRANDED PRINTABLE BOARDING PASS */}
      {viewTicket && (
        <div className="modal-backdrop printable-modal-backdrop">
          <div className="printable-ticket-wrapper">
            <div className="ticket-actions-bar no-print">
              <button className="print-action-btn" onClick={handlePrintTicket}>
                🖨️ Print / Save as PDF
              </button>
              <button className="close-ticket-btn" onClick={() => setViewTicket(null)}>✕ Close</button>
            </div>

            <div className="boarding-pass">
              <div className="ticket-top-header">
                <div className="ticket-brand-left">
                  <h2>🚌 ANHAR BUS</h2>
                  <p>E-Ticket / Conductor Boarding Pass</p>
                </div>
                <div className="ticket-qr-section">
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=ANHAR_PASS_PNR_${viewTicket.pnr}`} 
                    alt="Ticket QR" 
                    className="qr-image"
                  />
                  <span>Scan to Verify</span>
                </div>
              </div>

              <div className="pnr-strip">
                <div>
                  <span className="strip-label">PNR NUMBER</span>
                  <strong>{viewTicket.pnr}</strong>
                </div>
                <div>
                  <span className="strip-label">STATUS</span>
                  <span className="strip-status">{viewTicket.status}</span>
                </div>
                <div>
                  <span className="strip-label">BUS NUMBER</span>
                  <strong>{viewTicket.busNumber || 'AP 04 TX 9924'}</strong>
                </div>
                <div>
                  <span className="strip-label">TOTAL PAID</span>
                  <strong>₹{viewTicket.totalPaid} ({viewTicket.paymentMethod || 'UPI'})</strong>
                </div>
              </div>

              <div className="ticket-route-grid">
                <div className="route-block">
                  <span className="block-label">DEPARTURE</span>
                  <h3>{viewTicket.departure}</h3>
                  <p className="block-date">{viewTicket.journeyDate}</p>
                  <div className="landmark-box">
                    <strong>📍 Boarding Landmark:</strong>
                    <p>{viewTicket.boarding}</p>
                    <small>⏰ Please report 15 mins prior to departure</small>
                  </div>
                </div>

                <div className="route-block arrow-block">
                  <span className="route-arrow">➔</span>
                  <span className="route-name">{viewTicket.route}</span>
                  <span className="service-name">{viewTicket.busName}</span>
                </div>

                <div className="route-block">
                  <span className="block-label">ARRIVAL</span>
                  <h3>{viewTicket.arrival || '06:00'}</h3>
                  <p className="block-date">{viewTicket.journeyDate}</p>
                  <div className="landmark-box">
                    <strong>🎯 Dropping Point:</strong>
                    <p>{viewTicket.dropping}</p>
                  </div>
                </div>
              </div>

              <div className="ticket-passengers-section">
                <h4>Confirmed Passengers ({(viewTicket.passengers || []).length})</h4>
                <table className="ticket-passenger-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Passenger Name</th>
                      <th>Age / Gender</th>
                      <th>Seat No.</th>
                      <th>Seat Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(viewTicket.passengers || []).map((p, idx) => (
                      <tr key={p.seatNumber}>
                        <td>{idx + 1}</td>
                        <td><strong>{p.name}</strong></td>
                        <td>{p.age} yrs / {p.gender}</td>
                        <td><span className="seat-badge-print">Seat {p.seatNumber}</span></td>
                        <td><span className="status-confirmed">Confirmed</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="ticket-footer-notes">
                <div className="notes-left">
                  <p><strong>Primary Contact:</strong> +91 {viewTicket.contact?.phone || '9347685668'} | {viewTicket.contact?.email || 'N/A'}</p>
                  <p>Government photo ID is required for primary passenger during boarding.</p>
                  <p>Resale eligible up to 1 hour prior to scheduled bus departure via ANHAR App.</p>
                </div>
                <div className="support-right">
                  <strong>24x7 ANHAR Helpline</strong>
                  <p>📞 1800-425-ANHAR (Toll Free)</p>
                  <p>support@anharbus.com</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 1: BUYER DETAILS CHECKOUT */}
      {selectedResaleItem && (
        <div className="modal-backdrop no-print">
          <div className="modal-box">
            <form onSubmit={handleResalePurchaseSubmit}>
              <div className="modal-header">
                <h3>Buy Resale Ticket (Seat {selectedResaleItem.seatNumber})</h3>
                <button type="button" className="close-btn" onClick={() => setSelectedResaleItem(null)}>✕</button>
              </div>

              <div className="booking-summary-banner">
                <p><strong>Bus:</strong> {selectedResaleItem.busName}</p>
                <p><strong>Route:</strong> {selectedResaleItem.route}</p>
                <p><strong>Boarding:</strong> {selectedResaleItem.boarding}</p>
                <p><strong>Dropping:</strong> {selectedResaleItem.dropping}</p>
                <p><strong>Seat:</strong> {selectedResaleItem.seatNumber} | <strong>Amount to Pay:</strong> ₹{selectedResaleItem.resalePrice}</p>
              </div>

              <p className="notice-box">
                ℹ️ The original ticket will be canceled, and a <strong>brand new PNR will be issued in your name</strong>.
              </p>

              <div className="form-group">
                <label>Passenger Full Name</label>
                <input 
                  type="text" 
                  required 
                  placeholder="Enter traveler's name"
                  value={buyerDetails.name}
                  onChange={(e) => setBuyerDetails({ ...buyerDetails, name: e.target.value })}
                />
              </div>

              <div className="form-row">
                <div className="form-group flex-1">
                  <label>Age</label>
                  <input 
                    type="number" 
                    required 
                    min="1" 
                    max="120"
                    placeholder="Age"
                    value={buyerDetails.age}
                    onChange={(e) => setBuyerDetails({ ...buyerDetails, age: e.target.value })}
                  />
                </div>
                <div className="form-group flex-1">
                  <label>Gender</label>
                  <select 
                    value={buyerDetails.gender}
                    onChange={(e) => setBuyerDetails({ ...buyerDetails, gender: e.target.value })}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Mobile Number (For Ticket SMS)</label>
                <input 
                  type="tel" 
                  required 
                  pattern="[0-9]{10}"
                  placeholder="10-digit mobile number"
                  value={buyerDetails.phone}
                  onChange={(e) => setBuyerDetails({ ...buyerDetails, phone: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Email Address (For Ticket PDF)</label>
                <input 
                  type="email" 
                  required 
                  placeholder="name@example.com"
                  value={buyerDetails.email}
                  onChange={(e) => setBuyerDetails({ ...buyerDetails, email: e.target.value })}
                />
              </div>

              <button type="submit" className="confirm-btn">Pay ₹{selectedResaleItem.resalePrice} & Issue Ticket</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: PASSENGER DETAILS FORM */}
      {showPassengerModal && (
        <div className="modal-backdrop no-print">
          <div className="modal-box large-modal">
            <form onSubmit={handleProceedToPayment}>
              <div className="modal-header">
                <h3>Passenger Details ({passengerDetails.length} Seats)</h3>
                <button type="button" className="close-btn" onClick={() => setShowPassengerModal(false)}>✕</button>
              </div>

              <div className="booking-summary-banner">
                <p><strong>Route:</strong> {source} → {destination}</p>
                <p><strong>Boarding:</strong> {selectedBoardingPoint}</p>
                <p><strong>Dropping:</strong> {selectedDroppingPoint}</p>
              </div>

              <div className="passengers-scroll-list">
                {passengerDetails.map((p, index) => (
                  <div key={p.seatNumber} className="passenger-entry-card">
                    <h5>Passenger {index + 1} — Seat {p.seatNumber}</h5>
                    <div className="form-row">
                      <div className="form-group flex-2">
                        <label>Full Name</label>
                        <input 
                          type="text" 
                          required 
                          placeholder="Name as per Govt ID"
                          value={p.name}
                          onChange={(e) => handlePassengerChange(index, 'name', e.target.value)}
                        />
                      </div>
                      <div className="form-group flex-1">
                        <label>Age</label>
                        <input 
                          type="number" 
                          required 
                          min="1" 
                          max="120"
                          placeholder="Age"
                          value={p.age}
                          onChange={(e) => handlePassengerChange(index, 'age', e.target.value)}
                        />
                      </div>
                      <div className="form-group flex-1">
                        <label>Gender</label>
                        <select 
                          value={p.gender} 
                          onChange={(e) => handlePassengerChange(index, 'gender', e.target.value)}
                        >
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="contact-section">
                <h4>Contact Info (For Ticket SMS & Email)</h4>
                <div className="form-row">
                  <div className="form-group flex-1">
                    <label>Mobile Number</label>
                    <input 
                      type="tel" 
                      required 
                      pattern="[0-9]{10}"
                      placeholder="10-digit mobile"
                      value={contactInfo.phone}
                      onChange={(e) => setContactInfo({ ...contactInfo, phone: e.target.value })}
                    />
                  </div>
                  <div className="form-group flex-1">
                    <label>Email Address</label>
                    <input 
                      type="email" 
                      required 
                      placeholder="name@example.com"
                      value={contactInfo.email}
                      onChange={(e) => setContactInfo({ ...contactInfo, email: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-checkout-footer">
                <div>
                  <span>Base Amount</span>
                  <h3>₹{passengerDetails.length * (selectedBus?.price || 0)}</h3>
                </div>
                <button type="submit" className="confirm-btn">Proceed to Payment Gateway ➔</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2.5: PAYMENT GATEWAY CHECKOUT SCREEN */}
      {showPaymentModal && pendingBookingData && (
        <div className="modal-backdrop no-print">
          <div className="modal-box payment-gateway-modal">
            <div className="modal-header">
              <div className="payment-brand">
                <span className="lock-icon">🔒</span>
                <div>
                  <h3>ANHAR Secure Payments</h3>
                  <small>256-bit Encrypted Checkout</small>
                </div>
              </div>
              <button type="button" className="close-btn" onClick={() => setShowPaymentModal(false)}>✕</button>
            </div>

            <div className="payment-breakdown-card">
              <div className="breakdown-row">
                <span>Base Fare ({pendingBookingData.seats.length} Seats)</span>
                <span>₹{pendingBookingData.baseFare}</span>
              </div>
              <div className="breakdown-row">
                <span>GST (5%)</span>
                <span>₹{pendingBookingData.gstAmount}</span>
              </div>
              {useWalletOffset && walletDeductionPossible > 0 && (
                <div className="breakdown-row wallet-discount-line">
                  <span>ANHAR Wallet Applied</span>
                  <span>₹{walletDeductionPossible}</span>
                </div>
              )}
              <hr className="breakdown-divider" />
              <div className="breakdown-row grand-total-row">
                <strong>Net Payable Amount</strong>
                <strong>₹{finalPayableAfterWallet}</strong>
              </div>
            </div>

            <div 
              className={`wallet-deduct-card ${useWalletOffset ? 'active' : ''}`} 
              onClick={() => setUseWalletOffset(!useWalletOffset)}
            >
              <div className="wallet-checkbox-custom">
                {useWalletOffset ? '✔' : ''}
              </div>
              <div className="wallet-details-text">
                <div className="wallet-title-row">
                  <strong>Use ANHAR Wallet Balance</strong>
                  <span className="balance-pill">Available: ₹{walletBalance}</span>
                </div>
                <p>
                  {walletBalance === 0 
                    ? 'No balance available. Earn by reselling tickets or adding funds!' 
                    : useWalletOffset 
                      ? `Applied ₹${walletDeductionPossible} discount from wallet!` 
                      : `Click to deduct up to ₹${walletDeductionPossible} from this bill.`}
                </p>
              </div>
            </div>

            {finalPayableAfterWallet > 0 ? (
              <>
                <div className="payment-method-tabs">
                  <button 
                    type="button" 
                    className={`pay-tab ${paymentMethod === 'upi' ? 'active' : ''}`}
                    onClick={() => setPaymentMethod('upi')}
                  >
                    UPI (GPay / PhonePe)
                  </button>
                  <button 
                    type="button" 
                    className={`pay-tab ${paymentMethod === 'card' ? 'active' : ''}`}
                    onClick={() => setPaymentMethod('card')}
                  >
                    Debit / Credit Card
                  </button>
                </div>

                {paymentMethod === 'upi' && (
                  <div className="payment-body-panel">
                    <div className="upi-app-selector">
                      <div 
                        className={`upi-app-pill ${upiOption === 'gpay' ? 'selected' : ''}`}
                        onClick={() => setUpiOption('gpay')}
                      >
                        Google Pay
                      </div>
                      <div 
                        className={`upi-app-pill ${upiOption === 'phonepe' ? 'selected' : ''}`}
                        onClick={() => setUpiOption('phonepe')}
                      >
                        PhonePe
                      </div>
                      <div 
                        className={`upi-app-pill ${upiOption === 'paytm' ? 'selected' : ''}`}
                        onClick={() => setUpiOption('paytm')}
                      >
                        Paytm UPI
                      </div>
                    </div>

                    <div className="upi-qr-display">
                      <img 
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=upi://pay?pa=anharbus@icici&pn=ANHARBUS&am=${finalPayableAfterWallet}&cu=INR`} 
                        alt="UPI QR Code" 
                        className="payment-qr"
                      />
                      <p>Scan with any UPI App to Pay</p>
                      <small>UPI ID: <strong>anharbus@icici</strong></small>
                    </div>
                  </div>
                )}

                {paymentMethod === 'card' && (
                  <div className="payment-body-panel">
                    <div className="form-group">
                      <label>Card Number</label>
                      <input type="text" placeholder="XXXX XXXX XXXX XXXX" defaultValue="4532 8921 7842 1109" />
                    </div>
                    <div className="form-row">
                      <div className="form-group flex-1">
                        <label>Expiry (MM/YY)</label>
                        <input type="text" placeholder="MM/YY" defaultValue="08/29" />
                      </div>
                      <div className="form-group flex-1">
                        <label>CVV</label>
                        <input type="password" placeholder="•••" defaultValue="428" />
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="wallet-full-coverage-banner">
                🎉 Full fare covered by your ANHAR Wallet balance! No extra payment required.
              </div>
            )}

            <div className="payment-footer">
              <button className="confirm-btn pay-now-btn" onClick={handlePaymentSuccess}>
                {finalPayableAfterWallet > 0 
                  ? `Pay ₹${finalPayableAfterWallet} & Confirm Booking` 
                  : 'Confirm Booking via Wallet'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: PARTIAL RESALE LISTING */}
      {resellingBooking && (
        <div className="modal-backdrop no-print">
          <div className="modal-box">
            <div className="modal-header">
              <h3>Partial Ticket Resale</h3>
              <button type="button" className="close-btn" onClick={() => setResellingBooking(null)}>✕</button>
            </div>

            <p className="resale-explainer">
              Select only the seats you want to resale. Unselected seats remain confirmed for your trip.
            </p>

            <div className="resale-seat-picker">
              <label>Select Seats to List for Sale:</label>
              <div className="seat-checkboxes-grid">
                {(resellingBooking.passengers || []).map((p) => {
                  const isChecked = seatsToResell.includes(p.seatNumber)
                  return (
                    <div 
                      key={p.seatNumber} 
                      className={`seat-selectable-card ${isChecked ? 'checked' : ''}`}
                      onClick={() => toggleSeatToResell(p.seatNumber)}
                    >
                      <input type="checkbox" checked={isChecked} readOnly />
                      <div>
                        <strong>Seat {p.seatNumber}</strong>
                        <span>{p.name}</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="markup-slider-box">
              <div className="markup-header">
                <label>Set Resale Price per Seat</label>
                <span className="price-tag">
                  ₹{resellingBooking.unitPrice + Number(resaleMarkup)} 
                  <small> (+₹{resaleMarkup} max ₹50)</small>
                </span>
              </div>
              <input 
                type="range" 
                min="0" 
                max="50" 
                step="10" 
                value={resaleMarkup}
                onChange={(e) => setResaleMarkup(e.target.value)}
              />
              <span className="cap-note">As per ANHAR policy, max markup allowed is ₹50 over base fare.</span>
            </div>

            <div className="resale-payout-preview">
              <p>Seats Selected: <strong>{seatsToResell.length}</strong></p>
              <p>Wallet Credit upon sale: <strong>₹{seatsToResell.length * (resellingBooking.unitPrice + Number(resaleMarkup))}</strong></p>
            </div>

            <button 
              className="confirm-btn" 
              disabled={seatsToResell.length === 0 || isSubmittingResale}
              onClick={confirmResaleListing}
            >
              {isSubmittingResale ? 'Listing Seats...' : `List ${seatsToResell.length} Seat(s) on Resale Marketplace`}
            </button>
          </div>
        </div>
      )}

      {/* MODAL 4: PASSENGER ONBOARDING (NAME, EMAIL & PHONE OTP) */}
      {showLoginModal && (
        <div className="modal-backdrop no-print">
          <div className="modal-box" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3>{loginStep === 'DETAILS' ? 'Passenger Verification' : 'Verify Mobile OTP'}</h3>
              <button 
                type="button" 
                className="close-btn" 
                onClick={() => {
                  setShowLoginModal(false)
                  setLoginStep('DETAILS')
                }}
              >
                ✕
              </button>
            </div>

            {loginStep === 'DETAILS' ? (
              <form onSubmit={handleRequestOtp}>
                <p style={{ fontSize: '0.88rem', color: '#64748b', marginBottom: '1.2rem', lineHeight: '1.4' }}>
                  Enter your details to receive booking confirmations and manage ticket resale payouts.
                </p>

                <div className="form-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter your full name"
                    value={loginForm.name}
                    onChange={(e) => setLoginForm({ ...loginForm, name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Mobile Number (For SMS OTP)</label>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ fontWeight: 600, color: '#334155', fontSize: '0.95rem' }}>+91</span>
                    <input
                      type="tel"
                      required
                      maxLength="10"
                      pattern="[0-9]{10}"
                      placeholder="10-digit mobile"
                      value={loginForm.phone}
                      onChange={(e) => setLoginForm({ ...loginForm, phone: e.target.value.replace(/\D/g, '') })}
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="confirm-btn" 
                  disabled={isSendingOtp}
                  style={{ marginTop: '1.2rem', width: '100%' }}
                >
                  {isSendingOtp ? 'Sending OTP...' : 'Send OTP via SMS ➔'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp}>
                <p style={{ fontSize: '0.88rem', color: '#64748b', marginBottom: '1.2rem', lineHeight: '1.4' }}>
                  Enter the 4-digit code sent to <strong>+91 {loginForm.phone}</strong>
                </p>

                <div className="form-group">
                  <label>Enter 4-Digit OTP</label>
                  <input
                    type="text"
                    required
                    autoFocus
                    maxLength="4"
                    pattern="[0-9]{4}"
                    placeholder="••••"
                    style={{ textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.4rem', fontWeight: 'bold' }}
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.8rem', marginTop: '1.2rem' }}>
                  <button
                    type="button"
                    className="select-seat-btn"
                    style={{ flex: 1 }}
                    onClick={() => setLoginStep('DETAILS')}
                  >
                    ← Edit Details
                  </button>
                  <button
                    type="submit"
                    className="confirm-btn"
                    disabled={isVerifyingOtp}
                    style={{ flex: 2 }}
                  >
                    {isVerifyingOtp ? 'Verifying...' : 'Verify & Continue'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}