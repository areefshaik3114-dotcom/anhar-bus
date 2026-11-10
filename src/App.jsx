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
  const [currentUser, setCurrentUser] = useState(() => localStorage.getItem('anhar_user_phone') || '')
  const [currentUserName, setCurrentUserName] = useState(() => localStorage.getItem('anhar_user_name') || '')
  const [currentUserEmail, setCurrentUserEmail] = useState(() => localStorage.getItem('anhar_user_email') || '')

  // OTP Verification States
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [loginStep, setLoginStep] = useState('DETAILS')
  const [loginForm, setLoginForm] = useState({ name: '', email: '', phone: '' })
  const [otpInput, setOtpInput] = useState('')
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)

  // In-App Wallet balance
  const [walletBalance, setWalletBalance] = useState(0)

  // Operator Authentication State
  const [isOperatorAuthorized, setIsOperatorAuthorized] = useState(() => {
    return sessionStorage.getItem('anhar_operator_auth') === 'true'
  })
  const [operatorPinInput, setOperatorPinInput] = useState('')
  const [showPinModal, setShowPinModal] = useState(false)

  // Dynamic Buses & Fleet Manifest States
  const [dbBuses, setDbBuses] = useState([])
  const [selectedManifestBus, setSelectedManifestBus] = useState(null)
  const [manifestList, setManifestList] = useState([])
  const [isLoadingManifest, setIsLoadingManifest] = useState(false)
  const [showAddBusModal, setShowAddBusModal] = useState(false)
  const [newBusForm, setNewBusForm] = useState({
    name: '',
    busNumber: '',
    operatorPhone: '',
    source: 'Bengaluru',
    destination: 'Hyderabad',
    departure: '21:30',
    departureHour: 21.5,
    arrival: '06:00',
    price: 950,
    category: 'AC Sleeper',
    type: '2+1 Executive AC Sleeper',
    totalSeats: 24
  })

  // Fetch real-time wallet
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

  // Active User Bookings
  const [myBookings, setMyBookings] = useState([])
  const [viewTicket, setViewTicket] = useState(null)
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Resale Marketplace Listings
  const [resaleListings, setResaleListings] = useState([])

  // Helper to refresh data from MongoDB
  const fetchLatestData = async () => {
    try {
      const [dbBookings, dbResale, dynamicBuses] = await Promise.all([
        api.getBookings(),
        api.getResaleListings(),
        api.searchBuses(source, destination)
      ])
      if (Array.isArray(dbBookings)) setMyBookings(dbBookings)
      if (Array.isArray(dbResale)) setResaleListings(dbResale)
      if (Array.isArray(dynamicBuses) && dynamicBuses.length > 0) setDbBuses(dynamicBuses)
    } catch (err) {
      console.error('Failed to load records from MongoDB:', err)
    }
  }

  useEffect(() => {
    fetchLatestData()
  }, [source, destination])

  const userPersonalBookings = useMemo(() => {
    if (!currentUser) return []
    return myBookings.filter(b => b.contact?.phone === currentUser)
  }, [myBookings, currentUser])

  // Default fleet fallback
  const fallbackBuses = [
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
      totalSeats: 24,
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
      totalSeats: 24,
      availableSeats: 8,
      bookedSeats: [2, 5]
    }
  ]

  const activeFleet = dbBuses.length > 0 ? dbBuses : fallbackBuses

  const filteredAndSortedBuses = useMemo(() => {
    return activeFleet
      .filter((bus) => {
        if (selectedTypeFilter !== 'ALL' && bus.category !== selectedTypeFilter) return false
        if (selectedTimeSlot === 'MORNING' && (bus.departureHour < 6 || bus.departureHour >= 12)) return false
        if (selectedTimeSlot === 'EVENING' && (bus.departureHour < 18 || bus.departureHour >= 23)) return false
        if (selectedTimeSlot === 'NIGHT' && bus.departureHour < 23) return false
        return true
      })
      .sort((a, b) => {
        if (sortBy === 'PRICE_ASC') return a.price - b.price
        if (sortBy === 'PRICE_DESC') return b.price - a.price
        if (sortBy === 'TIME_ASC') return a.departureHour - b.departureHour
        if (sortBy === 'RATING_DESC') return (b.rating || 4.5) - (a.rating || 4.5)
        return 0
      })
  }, [activeFleet, selectedTypeFilter, selectedTimeSlot, sortBy])

  const getCutoffCountdown = (cutoffTimestamp) => {
    const diff = cutoffTimestamp - currentTime.getTime()
    if (diff <= 0) return { isExpired: true, text: 'Resale Window Closed' }
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)
    const pad = (n) => String(n).padStart(2, '0')
    return { isExpired: false, text: `${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s` }
  }

  useEffect(() => {
    setSelectedSeats([])
    setSelectedBus(null)
    const defaultBoarding = CITY_POINTS[source]?.[0]?.name || source
    const defaultDropping = CITY_POINTS[destination]?.[0]?.name || destination
    setSelectedBoardingPoint(defaultBoarding)
    setSelectedDroppingPoint(defaultDropping)
  }, [source, destination])

  const isSeatBooked = (seatNum, busId) => {
    const targetId = String(busId)
    return myBookings.some(booking => 
      String(booking.busId) === targetId && 
      booking.status !== 'ALL_RESOLD' &&
      booking.status !== 'CANCELLED' &&
      booking.passengers && 
      booking.passengers.some(p => Number(p.seatNumber) === Number(seatNum))
    )
  }

  const handleSeatClick = (seatNumber, bus) => {
    const currentBusId = bus._id || bus.id
    const resaleItem = resaleListings.find(
      r => String(r.busId) === String(currentBusId) && Number(r.seatNumber) === Number(seatNumber) && r.status === 'AVAILABLE'
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
    const busKey = bus._id || bus.id
    if (selectedBus && (selectedBus._id || selectedBus.id) === busKey) {
      setSelectedBus(null)
      setSelectedSeats([])
    } else {
      setSelectedBus(bus)
      setSelectedSeats([])
      setSelectedBoardingPoint(CITY_POINTS[source]?.[0]?.name || source)
      setSelectedDroppingPoint(CITY_POINTS[destination]?.[0]?.name || destination)
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

    const cleanContactPhone = String(pendingBookingData.contact?.phone || currentUser || '').replace(/\D/g, '').slice(-10)

    const newBooking = {
      pnr: newPnr,
      busId: String(pendingBookingData.bus._id || pendingBookingData.bus.id),
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
      contact: {
        phone: cleanContactPhone,
        email: pendingBookingData.contact?.email || ''
      },
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

    await api.createBooking(newBooking)
    await fetchLatestData()

    setShowPaymentModal(false)
    setPendingBookingData(null)
    setSelectedSeats([])
    setSelectedBus(null)
    setUseWalletOffset(false)
    alert(`Payment Successful! Ticket Confirmed with PNR: ${newPnr}`)
    setActiveTab('my-bookings')
  }

  const handleCancelBooking = async (booking) => {
    const confirmMsg = `Are you sure you want to cancel Ticket PNR: ${booking.pnr}?\n\nCancellation Policy:\n• >24 hrs: 10% charge (90% refund)\n• 12-24 hrs: 25% charge (75% refund)\n• 2-12 hrs: 50% charge (50% refund)\n• <2 hrs: Non-refundable\n\nRefund will be credited instantly to your ANHAR Wallet.`

    if (!window.confirm(confirmMsg)) return

    try {
      const res = await api.cancelBooking(booking.pnr)
      if (res && res.success) {
        alert(`Ticket Cancelled!\n\n• Deduction: ${res.deductionPct}% (₹${res.deductionAmount})\n• Refunded: ₹${res.refundAmount}\n• New Wallet: ₹${res.newBalance}`)
        if (currentUser) setWalletBalance(res.newBalance)
        await fetchLatestData()
      } else {
        alert(res?.message || 'Failed to cancel booking.')
      }
    } catch (err) {
      alert('Network error while processing cancellation.')
    }
  }

  // Operator Verification & Manifest Handlers
  const handleOperatorLogin = (e) => {
    e.preventDefault()
    // Secure PIN: Change 9924 to your preferred secret PIN
    if (operatorPinInput.trim() === '9924') {
      sessionStorage.setItem('anhar_operator_auth', 'true')
      setIsOperatorAuthorized(true)
      setShowPinModal(false)
      setActiveTab('operator')
      setOperatorPinInput('')
    } else {
      alert('Unauthorized! Incorrect Operator Security PIN.')
      setOperatorPinInput('')
    }
  }

  const handleOperatorLogout = () => {
    sessionStorage.removeItem('anhar_operator_auth')
    setIsOperatorAuthorized(false)
    setActiveTab('book')
  }

  const handleViewManifest = async (busId) => {
    setSelectedManifestBus(busId)
    setIsLoadingManifest(true)
    try {
      const res = await api.getTripManifest(busId, journeyDate)
      if (res && res.success) {
        setManifestList(res.manifest)
      }
    } catch (err) {
      alert('Failed to load passenger manifest.')
    } finally {
      setIsLoadingManifest(false)
    }
  }

  const handleCreateBusSubmit = async (e) => {
    e.preventDefault()
    try {
      const payload = {
        ...newBusForm,
        operatorPhone: currentUser || '8977733885'
      }
      const res = await api.createOperatorBus(payload)
      if (res && res.success) {
        alert(`Bus ${res.bus.busNumber} added to fleet!`)
        setShowAddBusModal(false)
        await fetchLatestData()
      } else {
        alert(res?.error || 'Failed to add bus.')
      }
    } catch (err) {
      alert('Network error while creating bus schedule.')
    }
  }

  // Resale Seller & Buyer logic
  const [resellingBooking, setResellingBooking] = useState(null)
  const [seatsToResell, setSeatsToResell] = useState([])
  const [resaleMarkup, setResaleMarkup] = useState(0)
  const [isSubmittingResale, setIsSubmittingResale] = useState(false)
  const [selectedResaleItem, setSelectedResaleItem] = useState(null)
  const [buyerDetails, setBuyerDetails] = useState({ name: '', age: '', gender: 'Male', phone: '', email: '' })

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

  const confirmResaleListing = async () => {
    if (seatsToResell.length === 0 || isSubmittingResale) return
    setIsSubmittingResale(true)
    try {
      const listingCutoff = Date.now() + 3 * 60 * 60 * 1000
      const cleanSellerPhone = String(resellingBooking.contact?.phone || currentUser || '').replace(/\D/g, '').slice(-10)

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

      await api.publishResale(newListings, updatedBookings)
      await fetchLatestData()
      setResellingBooking(null)
      setSeatsToResell([])
      alert(`Listed ${newListings.length} seat(s) for resale!`)
      setActiveTab('resale-market')
    } catch (err) {
      alert('Failed to publish resale listing.')
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
    const cleanBuyerPhone = String(buyerDetails.phone).replace(/\D/g, '').slice(-10)
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
      contact: { phone: cleanBuyerPhone, email: buyerDetails.email },
      sellerPnr: selectedResaleItem.sellerPnr,
      sellerPhone: selectedResaleItem.sellerPhone,
      baseFare: selectedResaleItem.resalePrice,
      totalPaid: selectedResaleItem.resalePrice,
      paymentMethod: 'UPI / INSTANT',
      status: 'VERIFIED_RESALE_TICKET'
    }

    const res = await api.buyResale(selectedResaleItem.id, newBuyerBooking)
    if (res.success) {
      if (cleanBuyerPhone) {
        localStorage.setItem('anhar_user_phone', cleanBuyerPhone)
        setCurrentUser(cleanBuyerPhone)
      }
      await fetchLatestData()
      setSelectedResaleItem(null)
      alert(`Ticket confirmed: PNR ${newBuyerPnr}`)
      setActiveTab('my-bookings')
    } else {
      alert(res.message || 'Failed to complete purchase.')
    }
  }

  const handleRequestOtp = async (e) => {
    e.preventDefault()
    const cleanPhone = loginForm.phone.trim().replace(/\D/g, '').slice(-10)
    if (cleanPhone.length !== 10) return alert('Enter valid 10-digit number.')
    setIsSendingOtp(true)
    try {
      const res = await api.sendOtp(cleanPhone)
      if (res && res.success) {
        setLoginStep('OTP')
        alert(res.devOtp ? `Dev OTP: ${res.devOtp}` : `OTP sent to +91 ${cleanPhone}`)
      } else {
        alert(res?.message || 'Failed to send OTP.')
      }
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
        setShowLoginModal(false)
        setLoginStep('DETAILS')
      } else {
        alert(res?.message || 'Invalid OTP.')
      }
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
  }

  const swapCities = () => {
    const temp = source
    setSource(destination)
    setDestination(temp)
  }

  const addFundsToWallet = async () => {
    if (!currentUser) return setShowLoginModal(true)
    const amount = Number(prompt('Enter amount to add to ANHAR Wallet (₹):', '500'))
    if (amount > 0) {
      const res = await api.updateWallet(currentUser, amount)
      if (res && res.success) setWalletBalance(res.balance)
    }
  }

  const walletDeductionPossible = pendingBookingData ? Math.min(walletBalance, pendingBookingData.grandTotal) : 0
  const finalPayableAfterWallet = pendingBookingData 
    ? useWalletOffset ? Math.max(0, pendingBookingData.grandTotal - walletDeductionPossible) : pendingBookingData.grandTotal 
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
              onClick={() => currentUser ? setActiveTab('my-bookings') : setShowLoginModal(true)}
            >
              My Bookings ({userPersonalBookings.length})
            </button>
            <button 
              className={`nav-btn ${activeTab === 'operator' ? 'active' : ''}`} 
              onClick={() => {
                if (isOperatorAuthorized) {
                  setActiveTab('operator')
                } else {
                  setShowPinModal(true)
                }
              }}
            >
              🔒 Operator Portal
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
              <button className="login-nav-btn" onClick={() => setShowLoginModal(true)}>Login</button>
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
                  <button type="button" className="swap-city-btn" title="Swap Cities" onClick={swapCities}>⇄</button>
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
                <button className="search-btn" onClick={fetchLatestData}>Search Buses</button>
              </div>
            </div>
          </section>

          <main className="results-container no-print">
            <div className="results-header-row">
              <div>
                <h3>Available Buses: {source} → {destination}</h3>
                <p className="route-sub-count">Showing {filteredAndSortedBuses.length} active fleet services</p>
              </div>

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

            <div className="bus-list">
              {filteredAndSortedBuses.map((bus) => {
                const busKey = bus._id || bus.id
                return (
                  <div key={busKey} className="bus-card">
                    <div className="bus-main-info">
                      <div>
                        <h4>{bus.name}</h4>
                        <span className="bus-badge">{bus.type || bus.category}</span>
                      </div>
                      <div className="rating-tag">{bus.rating || 4.7} ★</div>
                    </div>

                    <div className="bus-timings">
                      <div>
                        <strong>{bus.departure}</strong>
                        <p>{bus.source || source}</p>
                      </div>
                      <div className="duration">
                        <span>{bus.duration || '8h 30m'}</span>
                        <div className="route-line"></div>
                      </div>
                      <div>
                        <strong>{bus.arrival}</strong>
                        <p>{bus.destination || destination}</p>
                      </div>
                      <div className="bus-price">
                        <span className="fare-label">Fare</span>
                        <h3>₹{bus.price}</h3>
                      </div>
                    </div>

                    <div className="bus-actions">
                      <span className="seats-count">{bus.totalSeats || 24} total berths</span>
                      <button className="select-seat-btn" onClick={() => openBusDetails(bus)}>
                        {selectedBus && (selectedBus._id || selectedBus.id) === busKey ? 'Close Seat Map' : 'Select Seats'}
                      </button>
                    </div>

                    {selectedBus && (selectedBus._id || selectedBus.id) === busKey && (
                      <div className="seat-layout-panel">
                        <div className="seat-map-header">
                          <h5>Select Your Seat ({bus.name})</h5>
                        </div>
                        <div className="bus-interior-box">
                          <div className="steering-wheel">🚍 Driver Deck</div>
                          <div className="seat-grid">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => {
                              const isSelected = selectedSeats.includes(num)
                              const resaleItem = resaleListings.find(
                                r => String(r.busId) === String(busKey) && Number(r.seatNumber) === Number(num) && r.status === 'AVAILABLE'
                              )
                              const isBooked = !resaleItem && isSeatBooked(num, busKey)
                              const isResale = !!resaleItem

                              let seatClass = 'seat-box'
                              let label = num
                              if (isSelected) seatClass += ' seat-selected'
                              else if (isResale) { seatClass += ' seat-resale'; label = `${num} ⚡` }
                              else if (isBooked) seatClass += ' seat-booked'

                              return (
                                <button
                                  key={num}
                                  disabled={isBooked}
                                  className={seatClass}
                                  onClick={() => handleSeatClick(num, bus)}
                                >
                                  {label}
                                </button>
                              )
                            })}
                          </div>
                        </div>

                        <div className="seat-summary">
                          <div>
                            <p>Selected Seats ({selectedSeats.length}): <strong>{selectedSeats.join(', ') || 'None'}</strong></p>
                          </div>
                          <div className="action-col">
                            <span className="summary-fare">Fare: <strong>₹{selectedSeats.length * bus.price}</strong></span>
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
                )
              })}
            </div>
          </main>
        </>
      )}

      {/* TAB 2: MY BOOKINGS */}
      {activeTab === 'my-bookings' && (
        <main className="results-container no-print">
          <div className="section-title-row">
            <h2>My Bookings</h2>
            <p>View tickets, print conductor boarding passes, list seats for resale, or cancel</p>
          </div>

          <div className="bus-list">
            {userPersonalBookings.map((b) => (
              <div key={b.pnr} className="booking-card">
                <div className="booking-top">
                  <div>
                    <span className="pnr-tag">PNR: {b.pnr}</span>
                    <h4>{b.busName}</h4>
                    <p className="route-sub">{b.route} • {b.journeyDate} at {b.departure}</p>
                  </div>
                  <div className={`booking-status-badge ${b.status === 'CANCELLED' ? 'status-cancelled' : ''}`}>
                    {b.status}
                  </div>
                </div>

                <div className="booking-footer">
                  <span className="total-label">Total Paid: <strong>₹{b.totalPaid}</strong></span>
                  <div className="booking-btn-row">
                    <button className="view-ticket-btn" onClick={() => setViewTicket(b)}>🖨️ View Ticket</button>
                    {b.status === 'CONFIRMED' && (
                      <>
                        <button className="resale-trigger-btn" onClick={() => openResaleModal(b)}>
                          🔄 Resale Seats ({b.passengers.length})
                        </button>
                        <button 
                          className="cancel-ticket-btn" 
                          style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #f87171', padding: '0.45rem 0.8rem', borderRadius: '6px', fontWeight: 600, cursor: 'pointer' }}
                          onClick={() => handleCancelBooking(b)}
                        >
                          ✕ Cancel Ticket
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </main>
      )}

      {/* TAB 3: RESALE MARKETPLACE */}
      {activeTab === 'resale-market' && (
        <main className="results-container no-print">
          <div className="section-title-row">
            <h2>⚡ Quick-Sale Board</h2>
            <p>Direct passenger re-sales.</p>
          </div>

          <div className="bus-list">
            {resaleListings.map(item => (
              <div key={item.id} className="bus-card resale-card">
                <div className="bus-main-info">
                  <div>
                    <h4>{item.busName} (Seat {item.seatNumber})</h4>
                    <p>{item.route} • {item.date} at {item.time}</p>
                  </div>
                  <h3>₹{item.resalePrice}</h3>
                </div>
                <button className="buy-resale-btn" onClick={() => openBuyerModal(item)}>
                  Buy Seat {item.seatNumber}
                </button>
              </div>
            ))}
          </div>
        </main>
      )}

      {/* TAB 4: OPERATOR DESK & PASSENGER MANIFEST (RESTRICTED TO AUTHENTICATED OPERATORS) */}
      {activeTab === 'operator' && isOperatorAuthorized && (
        <main className="results-container no-print">
          <div className="section-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2>🚍 Fleet Operator Desk</h2>
              <p>Restricted Portal: Passenger Manifests & Bus Scheduling</p>
            </div>
            <div style={{ display: 'flex', gap: '0.8rem' }}>
              <button 
                className="confirm-btn" 
                style={{ width: 'auto', padding: '0.55rem 1rem' }}
                onClick={() => setShowAddBusModal(true)}
              >
                + Add New Bus Trip
              </button>
              <button 
                className="select-seat-btn"
                style={{ background: '#fee2e2', color: '#dc2626', border: '1px solid #f87171' }}
                onClick={handleOperatorLogout}
              >
                Lock / Exit Portal
              </button>
            </div>
          </div>

          <div className="bus-list">
            {activeFleet.map(bus => {
              const busKey = bus._id || bus.id
              return (
                <div key={busKey} className="booking-card">
                  <div className="booking-top">
                    <div>
                      <span className="pnr-tag">{bus.busNumber || 'AP 04 TX 9924'}</span>
                      <h4>{bus.name}</h4>
                      <p className="route-sub">{bus.source || source} → {bus.destination || destination} • Dept: {bus.departure} • Base: ₹{bus.price}</p>
                      <span className="bus-badge">{bus.category}</span>
                    </div>
                    <button 
                      className="select-seat-btn"
                      onClick={() => handleViewManifest(busKey)}
                    >
                      📋 Passenger Chart ({journeyDate})
                    </button>
                  </div>

                  {selectedManifestBus === busKey && (
                    <div style={{ marginTop: '1.2rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
                      <h5>Confirmed Passenger Manifest ({manifestList.length} Booked Seats)</h5>
                      {isLoadingManifest ? (
                        <p>Loading trip sheet...</p>
                      ) : manifestList.length === 0 ? (
                        <p style={{ color: '#64748b' }}>No passengers booked on this bus for {journeyDate}.</p>
                      ) : (
                        <table className="ticket-passenger-table" style={{ marginTop: '0.8rem' }}>
                          <thead>
                            <tr>
                              <th>Seat</th>
                              <th>Passenger Name</th>
                              <th>Phone</th>
                              <th>Boarding Point</th>
                              <th>PNR</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {manifestList.map((m, idx) => (
                              <tr key={idx}>
                                <td><strong>Seat {m.seatNumber}</strong></td>
                                <td>{m.name} ({m.gender}, {m.age}y)</td>
                                <td>+91 {m.phone}</td>
                                <td>{m.boarding}</td>
                                <td><span className="pnr-tag">{m.pnr}</span></td>
                                <td><span className="status-confirmed">{m.status}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </main>
      )}

      {/* MODAL: OPERATOR SECURITY PIN ENTRY */}
      {showPinModal && (
        <div className="modal-backdrop no-print">
          <div className="modal-box" style={{ maxWidth: '380px' }}>
            <form onSubmit={handleOperatorLogin}>
              <div className="modal-header">
                <h3>🔒 Operator Verification</h3>
                <button type="button" className="close-btn" onClick={() => setShowPinModal(false)}>✕</button>
              </div>
              <p style={{ fontSize: '0.88rem', color: '#64748b', marginBottom: '1.2rem' }}>
                This portal is restricted to authorized bus fleet owners and conductors only.
              </p>

              <div className="form-group">
                <label>Enter Operator Security PIN</label>
                <input 
                  type="password"
                  autoFocus
                  required
                  maxLength="6"
                  placeholder="Enter PIN"
                  style={{ textAlign: 'center', fontSize: '1.4rem', letterSpacing: '0.3rem' }}
                  value={operatorPinInput}
                  onChange={(e) => setOperatorPinInput(e.target.value)}
                />
              </div>

              <button type="submit" className="confirm-btn" style={{ marginTop: '1rem', width: '100%' }}>
                Unlock Operator Desk ➔
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD OPERATOR BUS */}
      {showAddBusModal && (
        <div className="modal-backdrop no-print">
          <div className="modal-box">
            <form onSubmit={handleCreateBusSubmit}>
              <div className="modal-header">
                <h3>Add Bus to ANHAR Fleet</h3>
                <button type="button" className="close-btn" onClick={() => setShowAddBusModal(false)}>✕</button>
              </div>

              <div className="form-group">
                <label>Bus Service Name</label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. ANHAR Royal Travels"
                  value={newBusForm.name}
                  onChange={(e) => setNewBusForm({ ...newBusForm, name: e.target.value })}
                />
              </div>

              <div className="form-row">
                <div className="form-group flex-1">
                  <label>Registration Number</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. AP 04 TX 9924"
                    value={newBusForm.busNumber}
                    onChange={(e) => setNewBusForm({ ...newBusForm, busNumber: e.target.value })}
                  />
                </div>
                <div className="form-group flex-1">
                  <label>Category</label>
                  <select 
                    value={newBusForm.category}
                    onChange={(e) => setNewBusForm({ ...newBusForm, category: e.target.value })}
                  >
                    <option value="AC Sleeper">AC Sleeper</option>
                    <option value="Volvo">Volvo Multi-Axle</option>
                    <option value="Non-AC">Non-AC Seater</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group flex-1">
                  <label>From (Source)</label>
                  <select 
                    value={newBusForm.source}
                    onChange={(e) => setNewBusForm({ ...newBusForm, source: e.target.value })}
                  >
                    <option value="Bengaluru">Bengaluru</option>
                    <option value="Hyderabad">Hyderabad</option>
                    <option value="Guntakal">Guntakal</option>
                    <option value="Chennai">Chennai</option>
                  </select>
                </div>
                <div className="form-group flex-1">
                  <label>To (Destination)</label>
                  <select 
                    value={newBusForm.destination}
                    onChange={(e) => setNewBusForm({ ...newBusForm, destination: e.target.value })}
                  >
                    <option value="Hyderabad">Hyderabad</option>
                    <option value="Bengaluru">Bengaluru</option>
                    <option value="Guntakal">Guntakal</option>
                    <option value="Chennai">Chennai</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group flex-1">
                  <label>Departure Time</label>
                  <input 
                    type="time" 
                    required 
                    value={newBusForm.departure}
                    onChange={(e) => {
                      const [h, m] = e.target.value.split(':').map(Number)
                      setNewBusForm({ 
                        ...newBusForm, 
                        departure: e.target.value,
                        departureHour: h + m / 60 
                      })
                    }}
                  />
                </div>
                <div className="form-group flex-1">
                  <label>Ticket Price (₹)</label>
                  <input 
                    type="number" 
                    required 
                    min="100" 
                    value={newBusForm.price}
                    onChange={(e) => setNewBusForm({ ...newBusForm, price: Number(e.target.value) })}
                  />
                </div>
              </div>

              <button type="submit" className="confirm-btn" style={{ marginTop: '1rem' }}>
                Publish Bus to Network ➔
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PASSENGER DETAILS FORM */}
      {showPassengerModal && (
        <div className="modal-backdrop no-print">
          <div className="modal-box large-modal">
            <form onSubmit={handleProceedToPayment}>
              <div className="modal-header">
                <h3>Passenger Details ({passengerDetails.length} Seats)</h3>
                <button type="button" className="close-btn" onClick={() => setShowPassengerModal(false)}>✕</button>
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
                <h4>Contact Info</h4>
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

      {/* MODAL: PAYMENT GATEWAY SCREEN */}
      {showPaymentModal && pendingBookingData && (
        <div className="modal-backdrop no-print">
          <div className="modal-box payment-gateway-modal">
            <div className="modal-header">
              <h3>Checkout</h3>
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
              <hr className="breakdown-divider" />
              <div className="breakdown-row grand-total-row">
                <strong>Net Payable Amount</strong>
                <strong>₹{finalPayableAfterWallet}</strong>
              </div>
            </div>

            <div className="payment-footer">
              <button className="confirm-btn pay-now-btn" onClick={handlePaymentSuccess}>
                Pay ₹{finalPayableAfterWallet} & Confirm Booking
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT TICKET MODAL */}
      {viewTicket && (
        <div className="modal-backdrop printable-modal-backdrop">
          <div className="printable-ticket-wrapper">
            <div className="ticket-actions-bar no-print">
              <button className="print-action-btn" onClick={() => window.print()}>🖨️ Print Ticket</button>
              <button className="close-ticket-btn" onClick={() => setViewTicket(null)}>✕ Close</button>
            </div>
            <div className="boarding-pass">
              <h2>🚌 ANHAR BUS</h2>
              <p>PNR: <strong>{viewTicket.pnr}</strong> | Bus: {viewTicket.busName}</p>
              <p>Route: {viewTicket.route} | Date: {viewTicket.journeyDate} at {viewTicket.departure}</p>
              <p>Status: <strong>{viewTicket.status}</strong></p>
            </div>
          </div>
        </div>
      )}

      {/* LOGIN MODAL */}
      {showLoginModal && (
        <div className="modal-backdrop no-print">
          <div className="modal-box" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3>{loginStep === 'DETAILS' ? 'Passenger Verification' : 'Verify Mobile OTP'}</h3>
              <button type="button" className="close-btn" onClick={() => setShowLoginModal(false)}>✕</button>
            </div>

            {loginStep === 'DETAILS' ? (
              <form onSubmit={handleRequestOtp}>
                <div className="form-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter your name"
                    value={loginForm.name}
                    onChange={(e) => setLoginForm({ ...loginForm, name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Mobile Number</label>
                  <input
                    type="tel"
                    required
                    maxLength="10"
                    placeholder="10-digit mobile"
                    value={loginForm.phone}
                    onChange={(e) => setLoginForm({ ...loginForm, phone: e.target.value.replace(/\D/g, '') })}
                  />
                </div>
                <button type="submit" className="confirm-btn" disabled={isSendingOtp}>
                  {isSendingOtp ? 'Sending...' : 'Send OTP ➔'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp}>
                <div className="form-group">
                  <label>Enter 4-Digit OTP</label>
                  <input
                    type="text"
                    required
                    maxLength="4"
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
                <button type="submit" className="confirm-btn" disabled={isVerifyingOtp}>
                  {isVerifyingOtp ? 'Verifying...' : 'Verify & Continue'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}