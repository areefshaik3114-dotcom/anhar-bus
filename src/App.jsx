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

// Helper to dynamically load Razorpay Checkout SDK
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true)
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

// Helper to build starter fallback seats cleanly
const generateFallbackSeats = (layoutType, lowerCount, upperCount, leftP, rightP, upperP, backP) => {
  const seats = []
  if (layoutType === 'ALL_SLEEPER' || layoutType === 'MIXED_SEATER_SLEEPER') {
    const lowerType = layoutType === 'ALL_SLEEPER' ? 'SLEEPER' : 'PUSHBACK'
    const lRows = Math.ceil(lowerCount / 3)
    for (let i = 1; i <= lowerCount; i++) {
      const row = Math.ceil(i / 3)
      const col = ((i - 1) % 3) + 1
      seats.push({
        seatNumber: i,
        seatLabel: `L${i}`,
        deck: 'LOWER',
        row,
        col,
        side: col === 1 ? 'LEFT' : 'RIGHT',
        type: lowerType,
        price: row === lRows ? backP : (col === 1 ? leftP : rightP)
      })
    }
    const uRows = Math.ceil(upperCount / 3)
    for (let i = 1; i <= upperCount; i++) {
      const row = Math.ceil(i / 3)
      const col = ((i - 1) % 3) + 1
      seats.push({
        seatNumber: lowerCount + i,
        seatLabel: `U${i}`,
        deck: 'UPPER',
        row,
        col,
        side: col === 1 ? 'LEFT' : 'RIGHT',
        type: 'SLEEPER',
        price: row === uRows ? Math.max(backP, upperP - 100) : upperP
      })
    }
  } else {
    const tRows = Math.ceil(lowerCount / 4)
    for (let i = 1; i <= lowerCount; i++) {
      const row = Math.ceil(i / 4)
      const col = ((i - 1) % 4) + 1
      seats.push({
        seatNumber: i,
        seatLabel: `S${i}`,
        deck: 'SINGLE',
        row,
        col,
        side: col <= 2 ? 'LEFT' : 'RIGHT',
        type: 'PUSHBACK',
        price: row === tRows ? backP : (col <= 2 ? leftP : rightP)
      })
    }
  }
  return seats
}

// Built-in starter fleet fallback
const DEFAULT_STARTER_FLEET = [
  {
    _id: 'default-bus-1',
    name: 'ANHAR Multi-Axle Volvo Semi-Sleeper',
    busNumber: 'KA 01 F 4402',
    operatorPhone: '8977733885',
    source: 'Bengaluru',
    destination: 'Hyderabad',
    departure: '21:30',
    departureHour: 21.5,
    departureDate: new Date(Date.now() + 86400000).toISOString(),
    arrival: '06:00',
    duration: '8h 30m',
    layoutType: 'MIXED_SEATER_SLEEPER',
    acType: 'AC',
    category: 'AC Sleeper + Seater',
    type: '2+1 AC Lower Seater + Upper Sleeper (30 Total)',
    price: 650,
    totalSeats: 30,
    lowerCount: 15,
    upperCount: 15,
    seats: generateFallbackSeats('MIXED_SEATER_SLEEPER', 15, 15, 650, 700, 950, 590)
  },
  {
    _id: 'default-bus-2',
    name: 'ANHAR Royal All-Sleeper AC',
    busNumber: 'AP 04 TX 9924',
    operatorPhone: '8977733885',
    source: 'Bengaluru',
    destination: 'Hyderabad',
    departure: '22:15',
    departureHour: 22.25,
    departureDate: new Date(Date.now() + 86400000).toISOString(),
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
    seats: generateFallbackSeats('ALL_SLEEPER', 15, 15, 950, 1000, 1000, 900)
  },
  {
    _id: 'default-bus-3',
    name: 'ANHAR Guntakal Superfast Express',
    busNumber: 'AP 21 Z 1042',
    operatorPhone: '8977733885',
    source: 'Bengaluru',
    destination: 'Guntakal',
    departure: '07:30',
    departureHour: 7.5,
    departureDate: new Date(Date.now() + 86400000).toISOString(),
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
    seats: generateFallbackSeats('PUSHBACK_ONLY', 32, 0, 480, 500, 500, 450)
  }
]

const SteeringWheelIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="2.5" />
    <line x1="12" y1="3" x2="12" y2="9.5" />
    <line x1="4.2" y1="16.5" x2="9.8" y2="13.2" />
    <line x1="19.8" y1="16.5" x2="14.2" y2="13.2" />
  </svg>
)

const FemaleBadgeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="#f472b6">
    <circle cx="12" cy="5.5" r="2.5" />
    <path d="M12 9.5c-2.2 0-3.5 1.5-4 3.5l-1 4h2.5v4.5h5V17H17l-1-4c-.5-2-1.8-3.5-4-3.5z" />
  </svg>
)

export default function App() {
  const [activeTab, setActiveTab] = useState('book')
  const [source, setSource] = useState('Bengaluru')
  const [destination, setDestination] = useState('Hyderabad')
  const [journeyDate, setJourneyDate] = useState(() => new Date().toISOString().split('T')[0])
  const [selectedBus, setSelectedBus] = useState(null)
  const [selectedSeats, setSelectedSeats] = useState([])

  // Pick-up and Drop selection
  const [selectedBoardingPoint, setSelectedBoardingPoint] = useState('')
  const [selectedDroppingPoint, setSelectedDroppingPoint] = useState('')

  // User Profile & Authentication State
  const [currentUser, setCurrentUser] = useState(() => localStorage.getItem('anhar_user_phone') || '')
  const [currentUserName, setCurrentUserName] = useState(() => localStorage.getItem('anhar_user_name') || '')
  const [currentUserEmail, setCurrentUserEmail] = useState(() => localStorage.getItem('anhar_user_email') || '')

  // Passenger OTP Login Modal State
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [loginStep, setLoginStep] = useState('DETAILS')
  const [loginForm, setLoginForm] = useState({ name: '', email: '', phone: '' })
  const [otpInput, setOtpInput] = useState('')
  const [isSendingOtp, setIsSendingOtp] = useState(false)
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false)

  // Wallet
  const [walletBalance, setWalletBalance] = useState(0)

  // Operator Authentication State
  const [isOperatorAuthorized, setIsOperatorAuthorized] = useState(() => sessionStorage.getItem('anhar_operator_auth') === 'true')
  const [showPinModal, setShowPinModal] = useState(false)
  const [operatorAuthMode, setOperatorAuthMode] = useState('LOGIN')
  const [opLoginName, setOpLoginName] = useState('')
  const [opLoginPassword, setOpLoginPassword] = useState('')
  const [opRegisterName, setOpRegisterName] = useState('')
  const [opRegisterPassword, setOpRegisterPassword] = useState('')
  const [opOtpInput, setOpOtpInput] = useState('')
  const [isAuthLoading, setIsAuthLoading] = useState(false)

  // Fleet & Manifest States
  const [dbBuses, setDbBuses] = useState([])
  const [operatorBuses, setOperatorBuses] = useState([])
  const [selectedManifestBus, setSelectedManifestBus] = useState(null)
  const [manifestList, setManifestList] = useState([])
  const [isLoadingManifest, setIsLoadingManifest] = useState(false)
  const [showAddBusModal, setShowAddBusModal] = useState(false)

  // Add Bus Form State
  const [newBusForm, setNewBusForm] = useState({
    boardingPointsText: '',
    droppingPointsText: '',
    viaStopsText: '',
    name: '',
    busNumber: '',
    operatorPhone: '',
    date: new Date().toISOString().split('T')[0],
    source: 'Bengaluru',
    destination: 'Hyderabad',
    departure: '21:30',
    departureHour: 21.5,
    arrival: '06:00',
    layoutType: 'ALL_SLEEPER',
    acType: 'AC',
    lowerCount: 15,
    upperCount: 15,
    totalSeats: 32,
    price: 850,
    lowerLeftPrice: 850,
    lowerRightPrice: 900,
    upperLeftPrice: 1000,
    backPrice: 750
  })

  // Filter & Sort States
  const [selectedTypeFilter, setSelectedTypeFilter] = useState('ALL')
  const [selectedAcFilter, setSelectedAcFilter] = useState('ALL')
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('ALL')
  const [sortBy, setSortBy] = useState('PRICE_ASC')

  // Passenger Details & Checkout States
  const [showPassengerModal, setShowPassengerModal] = useState(false)
  const [passengerDetails, setPassengerDetails] = useState([])
  const [contactInfo, setContactInfo] = useState({
    phone: localStorage.getItem('anhar_user_phone') || '',
    email: localStorage.getItem('anhar_user_email') || ''
  })

  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [useWalletOffset, setUseWalletOffset] = useState(false)
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)

  // Bookings & Resale
  const [myBookings, setMyBookings] = useState([])
  const [resaleListings, setResaleListings] = useState([])
  const [viewTicket, setViewTicket] = useState(null)
  const [resellingBooking, setResellingBooking] = useState(null)
  const [seatsToResell, setSeatsToResell] = useState([])
  const [resaleMarkup, setResaleMarkup] = useState(0)
  const [isSubmittingResale, setIsSubmittingResale] = useState(false)
  const [selectedResaleItem, setSelectedResaleItem] = useState(null)
  const [buyerDetails, setBuyerDetails] = useState({ name: '', age: '', gender: 'Male', phone: '', email: '' })

  const fetchLatestData = async () => {
    try {
      const [bookings, resale, buses] = await Promise.all([
        api.getBookings(),
        api.getResaleListings(),
        api.searchBuses(source, destination)
      ])
      if (Array.isArray(bookings)) setMyBookings(bookings)
      if (Array.isArray(resale)) setResaleListings(resale)
      if (Array.isArray(buses) && buses.length > 0) {
        setDbBuses(buses)
      } else {
        setDbBuses(DEFAULT_STARTER_FLEET)
      }
    } catch (err) {
      console.error('Data refresh error:', err)
      setDbBuses(DEFAULT_STARTER_FLEET)
    }
  }

  const fetchOperatorFleet = async () => {
    try {
      const operatorPhone = currentUser || '8977733885'
      const data = await api.getOperatorBuses(operatorPhone)
      if (data && data.success && Array.isArray(data.buses)) {
        setOperatorBuses(data.buses)
      } else {
        setOperatorBuses(dbBuses.length > 0 ? dbBuses : DEFAULT_STARTER_FLEET)
      }
    } catch (err) {
      console.error('Operator fleet error:', err)
      setOperatorBuses(dbBuses.length > 0 ? dbBuses : DEFAULT_STARTER_FLEET)
    }
  }

  useEffect(() => {
    fetchLatestData()
  }, [source, destination])

  useEffect(() => {
    if (activeTab === 'operator' && isOperatorAuthorized) {
      fetchOperatorFleet()
    }
  }, [activeTab, isOperatorAuthorized])

  useEffect(() => {
    const fetchWallet = async () => {
      if (currentUser) {
        try {
          const res = await api.getWallet(currentUser)
          if (res && res.success) setWalletBalance(res.balance)
        } catch (err) {
          console.error('Wallet error:', err)
        }
      } else {
        setWalletBalance(0)
      }
    }
    fetchWallet()
  }, [currentUser])

  useEffect(() => {
    setSelectedSeats([])
    setSelectedBus(null)
    setSelectedBoardingPoint(CITY_POINTS[source]?.[0]?.name || source)
    setSelectedDroppingPoint(CITY_POINTS[destination]?.[0]?.name || destination)
  }, [source, destination])

  const activeFleet = useMemo(() => {
    return dbBuses.length > 0 ? dbBuses : DEFAULT_STARTER_FLEET
  }, [dbBuses])

  const filteredAndSortedBuses = useMemo(() => {
    const now = new Date()
    return activeFleet
      .filter((bus) => {
        if (bus.departureDate && new Date(bus.departureDate) < now) return false
        if (selectedTypeFilter !== 'ALL') {
          if (selectedTypeFilter === 'SLEEPER' && bus.layoutType !== 'ALL_SLEEPER') return false
          if (selectedTypeFilter === 'MIXED' && bus.layoutType !== 'MIXED_SEATER_SLEEPER') return false
          if (selectedTypeFilter === 'SEATER' && !['PUSHBACK_ONLY', 'SEATER_ONLY'].includes(bus.layoutType)) return false
        }
        if (selectedAcFilter !== 'ALL') {
          const busAc = bus.acType || 'AC'
          if (busAc !== selectedAcFilter) return false
        }
        if (selectedTimeSlot === 'MORNING' && (bus.departureHour < 6 || bus.departureHour >= 12)) return false
        if (selectedTimeSlot === 'EVENING' && (bus.departureHour < 18 || bus.departureHour >= 23)) return false
        if (selectedTimeSlot === 'NIGHT' && bus.departureHour < 23) return false
        return true
      })
      .sort((a, b) => {
        if (sortBy === 'PRICE_ASC') return a.price - b.price
        if (sortBy === 'PRICE_DESC') return b.price - a.price
        if (sortBy === 'TIME_ASC') return a.departureHour - b.departureHour
        return 0
      })
  }, [activeFleet, selectedTypeFilter, selectedAcFilter, selectedTimeSlot, sortBy])

  const userPersonalBookings = useMemo(() => {
    if (!currentUser) return []
    return myBookings.filter(b => b.contact?.phone === currentUser)
  }, [myBookings, currentUser])

  const getSeatBookingInfo = (seatNum, busId) => {
    for (const b of myBookings) {
      if (
        String(b.busId) === String(busId) &&
        b.status !== 'ALL_RESOLD' &&
        b.status !== 'CANCELLED'
      ) {
        const pax = (b.passengers || []).find(p => Number(p.seatNumber) === Number(seatNum))
        if (pax) return pax
      }
    }
    return null
  }

  const handleSeatClick = (seatObj, bus) => {
    const busKey = bus._id || bus.id
    const resaleItem = resaleListings.find(
      r => String(r.busId) === String(busKey) && Number(r.seatNumber) === Number(seatObj.seatNumber) && r.status === 'AVAILABLE'
    )

    if (resaleItem) {
      openBuyerModal(resaleItem)
      return
    }

    const alreadySelected = selectedSeats.some(s => s.seatNumber === seatObj.seatNumber)
    if (alreadySelected) {
      setSelectedSeats(selectedSeats.filter(s => s.seatNumber !== seatObj.seatNumber))
    } else {
      setSelectedSeats([...selectedSeats, seatObj])
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
    }
  }

  const handleProceedToDetails = () => {
    if (selectedSeats.length === 0) return
    setPassengerDetails(selectedSeats.map(s => ({
      seatNumber: s.seatNumber,
      seatLabel: s.seatLabel,
      price: s.price,
      name: '',
      age: '',
      gender: 'Male'
    })))
    if (currentUser && !contactInfo.phone) {
      setContactInfo(prev => ({ ...prev, phone: currentUser, email: currentUserEmail || prev.email }))
    }
    setShowPassengerModal(true)
  }

  const totalCalculatedFare = useMemo(() => {
    return selectedSeats.reduce((acc, s) => acc + s.price, 0)
  }, [selectedSeats])

  const gstAmount = Math.round(totalCalculatedFare * 0.05)
  const grandTotal = totalCalculatedFare + gstAmount
  const walletDeductionPossible = Math.min(walletBalance, grandTotal)
  const finalPayableAfterWallet = useWalletOffset ? Math.max(0, grandTotal - walletDeductionPossible) : grandTotal

  const handleProceedToPayment = (e) => {
    e.preventDefault()
    setShowPassengerModal(false)
    setShowPaymentModal(true)
  }

  // Core Razorpay Checkout Launcher
  const triggerRazorpayPayment = async ({ amountRupees, description, prefillName, prefillEmail, prefillPhone, onSuccess }) => {
    const orderRes = await api.createPaymentOrder(amountRupees)
    if (!orderRes || !orderRes.success) {
      throw new Error(orderRes?.message || 'Unable to start payment gateway.')
    }

    // If backend is in Demo Mode (keys not added yet), complete immediately
    if (orderRes.demoMode) {
      const verifyRes = await api.verifyPayment({ demoMode: true })
      if (verifyRes && verifyRes.success) {
        await onSuccess(verifyRes.paymentId)
      }
      return
    }

    const sdkLoaded = await loadRazorpayScript()
    if (!sdkLoaded) {
      throw new Error('Failed to load Razorpay SDK. Check your internet connection.')
    }

    return new Promise((resolve, reject) => {
      const options = {
        key: orderRes.keyId,
        amount: orderRes.amount,
        currency: orderRes.currency || 'INR',
        name: 'ANHAR BUS',
        description,
        order_id: orderRes.orderId,
        prefill: {
          name: prefillName || 'Passenger',
          email: prefillEmail || '',
          contact: prefillPhone ? `+91${prefillPhone}` : ''
        },
        theme: { color: '#0284c7' },
        handler: async function (response) {
          try {
            const verifyRes = await api.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            })
            if (verifyRes && verifyRes.success) {
              await onSuccess(verifyRes.paymentId)
              resolve(true)
            } else {
              reject(new Error(verifyRes?.message || 'Payment verification failed.'))
            }
          } catch (err) {
            reject(err)
          }
        },
        modal: {
          ondismiss: function () {
            reject(new Error('Payment cancelled by user.'))
          }
        }
      }

      const rzp = new window.Razorpay(options)
      rzp.on('payment.failed', function (response) {
        reject(new Error(response.error?.description || 'Payment failed.'))
      })
      rzp.open()
    })
  }

  // Finalize booking after Razorpay / Wallet verification
  const completeBookingRecord = async (paymentId, deduction, remainingPaid) => {
    const newPnr = 'ANH' + Math.floor(100000 + Math.random() * 900000)

    if (deduction > 0 && currentUser) {
      await api.updateWallet(currentUser, -deduction)
      setWalletBalance(prev => Math.max(0, prev - deduction))
    }

    const cleanContactPhone = String(contactInfo.phone || currentUser || '').replace(/\D/g, '').slice(-10)

    const paymentLabel = deduction > 0 && remainingPaid === 0
      ? 'ANHAR WALLET'
      : deduction > 0
        ? `WALLET (â‚¹${deduction}) + RAZORPAY (${paymentId})`
        : `RAZORPAY (${paymentId})`

    const newBooking = {
      pnr: newPnr,
      busId: String(selectedBus._id || selectedBus.id),
      busName: selectedBus.name,
      busNumber: selectedBus.busNumber,
      route: `${source} â†’ ${destination}`,
      departure: selectedBus.departure,
      arrival: selectedBus.arrival,
      journeyDate: journeyDate,
      boarding: selectedBoardingPoint,
      dropping: selectedDroppingPoint,
      unitPrice: selectedBus.price,
      passengers: [...passengerDetails],
      contact: {
        phone: cleanContactPhone,
        email: contactInfo.email || ''
      },
      baseFare: totalCalculatedFare,
      gstAmount: gstAmount,
      totalPaid: grandTotal,
      walletDeducted: deduction,
      paymentMethod: paymentLabel,
      status: 'CONFIRMED'
    }

    await api.createBooking(newBooking)
    await fetchLatestData()

    setShowPaymentModal(false)
    setSelectedSeats([])
    setSelectedBus(null)
    setUseWalletOffset(false)
    alert(`Payment Verified! Confirmed Ticket PNR: ${newPnr}`)
    setActiveTab('my-bookings')
  }

  const handlePayNowClick = async () => {
    if (isProcessingPayment) return
    setIsProcessingPayment(true)
    const deduction = useWalletOffset && walletBalance > 0 ? walletDeductionPossible : 0
    const remainingToPay = Math.max(0, grandTotal - deduction)

    try {
      if (remainingToPay === 0) {
        // 100% covered by ANHAR Wallet
        await completeBookingRecord('WALLET_ONLY', deduction, 0)
      } else {
        // Charge remaining amount via Real Razorpay Gateway
        await triggerRazorpayPayment({
          amountRupees: remainingToPay,
          description: `${selectedBus.name} (${source} â†’ ${destination})`,
          prefillName: passengerDetails[0]?.name || currentUserName,
          prefillEmail: contactInfo.email || currentUserEmail,
          prefillPhone: contactInfo.phone || currentUser,
          onSuccess: async (paymentId) => {
            await completeBookingRecord(paymentId, deduction, remainingToPay)
          }
        })
      }
    } catch (err) {
      if (err.message !== 'Payment cancelled by user.') {
        alert(err.message || 'Payment failed.')
      }
    } finally {
      setIsProcessingPayment(false)
    }
  }

  const handleCancelBooking = async (b) => {
    const confirmMsg = `Are you sure you want to cancel Ticket PNR: ${b.pnr}?\n\nCancellation Policy:\nâ€¢ >24 hrs: 10% charge (90% refund)\nâ€¢ 12-24 hrs: 25% charge (75% refund)\nâ€¢ 2-12 hrs: 50% charge (50% refund)\nâ€¢ <2 hrs: Non-refundable\n\nRefund will be credited instantly to your ANHAR Wallet.`
    if (!window.confirm(confirmMsg)) return

    try {
      const res = await api.cancelBooking(b.pnr)
      if (res && res.success) {
        alert(`Ticket Cancelled!\n\nâ€¢ Deduction: ${res.deductionPct}% (â‚¹${res.deductionAmount})\nâ€¢ Refunded: â‚¹${res.refundAmount}\nâ€¢ New Wallet Balance: â‚¹${res.newBalance}`)
        if (currentUser) setWalletBalance(res.newBalance)
        await fetchLatestData()
      } else {
        alert(res?.message || 'Failed to cancel booking.')
      }
    } catch (err) {
      alert('Network error while processing cancellation.')
    }
  }

  // Resale Logic
  const openResaleModal = (b) => {
    setResellingBooking(b)
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
    if (isProcessingPayment) return
    setIsProcessingPayment(true)

    const cleanBuyerPhone = String(buyerDetails.phone).replace(/\D/g, '').slice(-10)

    try {
      await triggerRazorpayPayment({
        amountRupees: Number(selectedResaleItem.resalePrice),
        description: `Resale Seat ${selectedResaleItem.seatNumber} - ${selectedResaleItem.busName}`,
        prefillName: buyerDetails.name,
        prefillEmail: buyerDetails.email,
        prefillPhone: cleanBuyerPhone,
        onSuccess: async (paymentId) => {
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
            paymentMethod: `RAZORPAY (${paymentId})`,
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
      })
    } catch (err) {
      if (err.message !== 'Payment cancelled by user.') {
        alert(err.message || 'Resale payment failed.')
      }
    } finally {
      setIsProcessingPayment(false)
    }
  }

  // Operator Auth & Fleet Handlers
  const handleOperatorLoginSubmit = async (e) => {
    e.preventDefault()
    setIsAuthLoading(true)
    try {
      const res = await api.operatorLogin(opLoginName, opLoginPassword)
      if (res.success) {
        sessionStorage.setItem('anhar_operator_auth', 'true')
        sessionStorage.setItem('anhar_operator_name', res.operator.name)
        setIsOperatorAuthorized(true)
        setShowPinModal(false)
        setActiveTab('operator')
        alert(`Welcome back, ${res.operator.name}!`)
      } else {
        alert(res.message || 'Login failed.')
      }
    } finally {
      setIsAuthLoading(false)
    }
  }

  const handleRequestAdminOtp = async () => {
    setIsAuthLoading(true)
    try {
      const res = await api.operatorSendSetupOtp()
      if (res.success) {
        alert(res.devOtp ? `Dev OTP: ${res.devOtp}` : 'OTP sent to Admin mobile +91 8977733885. Contact admin for OTP.')
      } else {
        alert(res.message || 'Failed to send OTP to Admin.')
      }
    } finally {
      setIsAuthLoading(false)
    }
  }

  const handleOperatorRegisterSubmit = async (e) => {
    e.preventDefault()
    setIsAuthLoading(true)
    try {
      const res = await api.operatorRegisterWithOtp(opRegisterName, opRegisterPassword, opOtpInput)
      if (res.success) {
        alert('Registration complete! You are now logged in.')
        sessionStorage.setItem('anhar_operator_auth', 'true')
        sessionStorage.setItem('anhar_operator_name', res.operator.name)
        setIsOperatorAuthorized(true)
        setShowPinModal(false)
        setActiveTab('operator')
      } else {
        alert(res.message || 'Registration failed.')
      }
    } finally {
      setIsAuthLoading(false)
    }
  }

  const handleOperatorLogout = () => {
    sessionStorage.removeItem('anhar_operator_auth')
    sessionStorage.removeItem('anhar_operator_name')
    setIsOperatorAuthorized(false)
    setActiveTab('book')
  }

  const handleCreateBusSubmit = async (e) => {
    e.preventDefault()
    try {
      const isDoubleDeck = newBusForm.layoutType === 'ALL_SLEEPER' || newBusForm.layoutType === 'MIXED_SEATER_SLEEPER'
      const calculatedTotal = isDoubleDeck
        ? Number(newBusForm.lowerCount) + Number(newBusForm.upperCount)
        : Number(newBusForm.totalSeats)

      const payload = {
        ...newBusForm,
        boardingPoints: customBoarding,
        droppingPoints: customDropping,
        viaStops: customVia,
        totalSeats: calculatedTotal,
        operatorPhone: currentUser || '8977733885'
      }
      const res = await api.createOperatorBus(payload)
      if (res && res.success) {
        alert(`Bus ${res.bus.busNumber} (${res.bus.category} â€¢ ${res.bus.totalSeats} Seats/Berths) published successfully!`)
        setShowAddBusModal(false)
        await fetchLatestData()
        await fetchOperatorFleet()
      } else {
        alert(res?.error || 'Failed to add bus.')
      }
    } catch (err) {
      alert('Network error while adding bus schedule.')
    }
  }

  const handleRemoveBus = async (bus) => {
    const busId = bus._id || bus.id
    if (String(busId).startsWith('default-bus-')) {
      alert('This is a built-in starter template. You can add and delete real buses from "+ Add Bus & Configure Capacity".')
      return
    }

    const isPast = bus.departureDate ? new Date(bus.departureDate) < new Date() : false
    const confirmMessage = isPast
      ? `Delete completed bus (${bus.busNumber}) from your history?`
      : `Are you sure you want to remove bus (${bus.busNumber})? Active bookings will be safeguarded.`

    if (!window.confirm(confirmMessage)) return

    try {
      const result = await api.deleteBus(busId)
      if (result && result.success) {
        alert('Bus removed successfully.')
        await fetchLatestData()
        await fetchOperatorFleet()
      } else {
        alert(result?.message || 'Cannot remove bus.')
      }
    } catch (err) {
      alert('Error connecting to backend server.')
    }
  }

  const handleEditBus = (bus) => {
    const isPast = bus.departureDate ? new Date(bus.departureDate) < new Date() : false
    if (isPast) {
      alert('This bus trip is already completed. Past schedules are view-only and cannot be edited.')
      return
    }
    alert(`Edit feature open for ${bus.busNumber}. (Active trip)`)
  }

  const handleViewManifest = async (busId) => {
    setSelectedManifestBus(busId)
    setIsLoadingManifest(true)
    try {
      const res = await api.getTripManifest(busId, journeyDate)
      if (res && res.success) setManifestList(res.manifest)
    } catch (err) {
      alert('Failed to load passenger manifest.')
    } finally {
      setIsLoadingManifest(false)
    }
  }

  // Passenger OTP Handlers
  const handleRequestOtp = async (e) => {
    e.preventDefault()
    const cleanPhone = loginForm.phone.replace(/\D/g, '').slice(-10)
    if (cleanPhone.length !== 10) return alert('Enter valid 10-digit number')
    setIsSendingOtp(true)
    try {
      const res = await api.sendOtp(cleanPhone)
      if (res && res.success) {
        setLoginStep('OTP')
        alert(res.devOtp ? `Dev Code: ${res.devOtp}` : `OTP sent via SMS to +91 ${cleanPhone}`)
      } else {
        alert(res?.message || 'Failed to send OTP.')
      }
    } finally {
      setIsSendingOtp(false)
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    const cleanPhone = loginForm.phone.replace(/\D/g, '').slice(-10)
    setIsVerifyingOtp(true)
    try {
      const res = await api.verifyOtp({ phone: cleanPhone, name: loginForm.name, email: loginForm.email, otp: otpInput })
      if (res && res.success) {
        localStorage.setItem('anhar_user_phone', cleanPhone)
        localStorage.setItem('anhar_user_name', loginForm.name)
        localStorage.setItem('anhar_user_email', loginForm.email)
        setCurrentUser(cleanPhone)
        setCurrentUserName(loginForm.name)
        setCurrentUserEmail(loginForm.email)
        setShowLoginModal(false)
      } else {
        alert(res?.message || 'Invalid OTP.')
      }
    } finally {
      setIsVerifyingOtp(false)
    }
  }

  const swapCities = () => {
    const temp = source
    setSource(destination)
    setDestination(temp)
  }

  // Wallet Top-Up via Real Razorpay Checkout
  const addFundsToWallet = async () => {
    if (!currentUser) return setShowLoginModal(true)
    const amount = Number(prompt('Enter amount to add to ANHAR Wallet (â‚¹):', '500'))
    if (amount > 0) {
      try {
        await triggerRazorpayPayment({
          amountRupees: amount,
          description: 'ANHAR Wallet Top-Up',
          prefillName: currentUserName,
          prefillEmail: currentUserEmail,
          prefillPhone: currentUser,
          onSuccess: async () => {
            const res = await api.updateWallet(currentUser, amount)
            if (res && res.success) {
              setWalletBalance(res.balance)
              alert(`â‚¹${amount} added to your ANHAR Wallet!`)
            }
          }
        })
      } catch (err) {
        if (err.message !== 'Payment cancelled by user.') {
          alert(err.message || 'Wallet top-up failed.')
        }
      }
    }
  }

  const renderCabinUnit = (seat, bus, busKey) => {
    if (!seat) return <div className="cabin-unit-placeholder" />

    const isSelected = selectedSeats.some(sel => sel.seatNumber === seat.seatNumber)
    const resaleItem = resaleListings.find(
      r => String(r.busId) === String(busKey) && Number(r.seatNumber) === Number(seat.seatNumber) && r.status === 'AVAILABLE'
    )
    const bookedPax = !resaleItem ? getSeatBookingInfo(seat.seatNumber, busKey) : null
    const isBooked = Boolean(bookedPax)
    const isFemaleBooked = isBooked && bookedPax?.gender === 'Female'
    const isSleeper = seat.type === 'SLEEPER'

    let unitClass = isSleeper ? 'berth-unit' : 'seater-unit'
    if (isSelected) unitClass += ' unit-selected'
    else if (resaleItem) unitClass += ' unit-resale'
    else if (isFemaleBooked) unitClass += ' unit-sold-female'
    else if (isBooked) unitClass += ' unit-sold'

    return (
      <div key={seat.seatNumber} className="cabin-slot">
        <button
          type="button"
          disabled={isBooked}
          className={unitClass}
          title={`${seat.seatLabel} (${seat.type}) - ${isBooked ? 'Sold' : `â‚¹${resaleItem ? resaleItem.resalePrice : seat.price}`}`}
          onClick={() => handleSeatClick(seat, bus)}
        >
          <span className="unit-code">{seat.seatLabel}</span>
          {isFemaleBooked && <FemaleBadgeIcon />}
          {resaleItem && <span className="resale-bolt">âš¡</span>}
          {isSleeper ? (
            <span className="berth-pillow" />
          ) : (
            <span className="seater-cushion" />
          )}
        </button>
        <span className={`unit-price-label ${isBooked ? 'sold-text' : isSelected ? 'selected-text' : resaleItem ? 'resale-text' : ''}`}>
          {isBooked ? 'Sold' : `â‚¹${resaleItem ? resaleItem.resalePrice : seat.price}`}
        </span>
      </div>
    )
  }

  const renderDeckShell = (deckSeats, title, showSteering, isSingleDeck, bus, busKey) => {
    if (!deckSeats || deckSeats.length === 0) return null

    const colsPerRow = isSingleDeck ? 4 : 3
    const rowCount = Math.ceil(deckSeats.length / colsPerRow)
    const rows = Array.from({ length: rowCount }, (_, rIdx) => {
      const start = rIdx * colsPerRow
      return deckSeats.slice(start, start + colsPerRow)
    })

    return (
      <div className="deck-column-wrapper">
        <div className="deck-top-bar">
          <span className="deck-title">{title}</span>
          {showSteering && (
            <span className="steering-badge" title="Driver Cabin">
              <SteeringWheelIcon />
            </span>
          )}
        </div>

        <div className="bus-chassis-shell">
          {rows.map((rowSeats, rIdx) => (
            <div key={rIdx} className="chassis-row">
              {isSingleDeck ? (
                <>
                  <div className="chassis-left-pair">
                    {renderCabinUnit(rowSeats[0], bus, busKey)}
                    {renderCabinUnit(rowSeats[1], bus, busKey)}
                  </div>
                  <div className="chassis-aisle-gap" />
                  <div className="chassis-right-pair">
                    {renderCabinUnit(rowSeats[2], bus, busKey)}
                    {renderCabinUnit(rowSeats[3], bus, busKey)}
                  </div>
                </>
              ) : (
                <>
                  <div className="chassis-left-single">
                    {renderCabinUnit(rowSeats[0], bus, busKey)}
                  </div>
                  <div className="chassis-aisle-gap" />
                  <div className="chassis-right-pair">
                    {renderCabinUnit(rowSeats[1], bus, busKey)}
                    {renderCabinUnit(rowSeats[2], bus, busKey)}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  const isDoubleDeckForm = newBusForm.layoutType === 'ALL_SLEEPER' || newBusForm.layoutType === 'MIXED_SEATER_SLEEPER'

  return (
    <div className="anhar-app">
      {/* NAVBAR */}
      <header className="navbar no-print">
        <div className="nav-container">
          <div className="brand">
            <span>ðŸšŒ</span>
            <span>ANHAR BUS</span>
          </div>
          <nav className="nav-links">
            <button className={`nav-btn ${activeTab === 'book' ? 'active' : ''}`} onClick={() => setActiveTab('book')}>
              Book Buses
            </button>
            <button className={`nav-btn ${activeTab === 'resale-market' ? 'active' : ''}`} onClick={() => setActiveTab('resale-market')}>
              Resale Deals <span className="market-badge">{resaleListings.length}</span>
            </button>
            <button className={`nav-btn ${activeTab === 'my-bookings' ? 'active' : ''}`} onClick={() => currentUser ? setActiveTab('my-bookings') : setShowLoginModal(true)}>
              My Bookings ({userPersonalBookings.length})
            </button>
            <button className={`nav-btn ${activeTab === 'operator' ? 'active' : ''}`} onClick={() => isOperatorAuthorized ? setActiveTab('operator') : setShowPinModal(true)}>
              ðŸ”’ Operator Portal
            </button>
            <div className="wallet-chip" onClick={addFundsToWallet} title="Click to Top-Up Wallet via Razorpay">
              ðŸ’° Wallet: <strong>â‚¹{walletBalance}</strong> <span className="wallet-plus">+</span>
            </div>
            {currentUser ? (
              <div className="user-profile-badge">
                <span>ðŸ“± {currentUserName ? `${currentUserName} (+91 ${currentUser})` : `+91 ${currentUser}`}</span>
                <button className="logout-mini-btn" onClick={() => { localStorage.clear(); setCurrentUser(''); }}>âœ•</button>
              </div>
            ) : (
              <button className="login-nav-btn" onClick={() => setShowLoginModal(true)}>Login</button>
            )}
          </nav>
        </div>
      </header>

      {/* TAB 1: PASSENGER SEARCH & SIDE-BY-SIDE DUAL DECK BOOKING */}
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
                  <button type="button" className="swap-city-btn" title="Swap Cities" onClick={swapCities}>â‡„</button>
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
                <h3>Available Buses: {source} â†’ {destination}</h3>
                <p className="route-sub-count">Showing {filteredAndSortedBuses.length} active fleet services</p>
              </div>

              <div className="sort-control-box">
                <label>Sort By:</label>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="PRICE_ASC">Price: Low to High</option>
                  <option value="PRICE_DESC">Price: High to Low</option>
                  <option value="TIME_ASC">Departure: Earliest First</option>
                </select>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="filters-strip">
              <div className="filter-group">
                <span className="filter-title">Coach Type:</span>
                <div className="filter-pills">
                  <button className={`pill-btn ${selectedTypeFilter === 'ALL' ? 'active' : ''}`} onClick={() => setSelectedTypeFilter('ALL')}>
                    All Coaches
                  </button>
                  <button className={`pill-btn ${selectedTypeFilter === 'SLEEPER' ? 'active' : ''}`} onClick={() => setSelectedTypeFilter('SLEEPER')}>
                    ðŸ›ï¸ All Sleeper
                  </button>
                  <button className={`pill-btn ${selectedTypeFilter === 'MIXED' ? 'active' : ''}`} onClick={() => setSelectedTypeFilter('MIXED')}>
                    ðŸšŒ Sleeper + Seater
                  </button>
                  <button className={`pill-btn ${selectedTypeFilter === 'SEATER' ? 'active' : ''}`} onClick={() => setSelectedTypeFilter('SEATER')}>
                    ðŸ’º Seater Only
                  </button>
                </div>
              </div>

              <div className="filter-group">
                <span className="filter-title">Comfort:</span>
                <div className="filter-pills">
                  <button className={`pill-btn ${selectedAcFilter === 'ALL' ? 'active' : ''}`} onClick={() => setSelectedAcFilter('ALL')}>
                    AC & Non-AC
                  </button>
                  <button className={`pill-btn ${selectedAcFilter === 'AC' ? 'active' : ''}`} onClick={() => setSelectedAcFilter('AC')}>
                    â„ï¸ AC Only
                  </button>
                  <button className={`pill-btn ${selectedAcFilter === 'NON_AC' ? 'active' : ''}`} onClick={() => setSelectedAcFilter('NON_AC')}>
                    ðŸŒ¬ï¸ Non-AC
                  </button>
                </div>
              </div>

              <div className="filter-group">
                <span className="filter-title">Departure:</span>
                <div className="filter-pills">
                  <button className={`pill-btn ${selectedTimeSlot === 'ALL' ? 'active' : ''}`} onClick={() => setSelectedTimeSlot('ALL')}>
                    Any Time
                  </button>
                  <button className={`pill-btn ${selectedTimeSlot === 'MORNING' ? 'active' : ''}`} onClick={() => setSelectedTimeSlot('MORNING')}>
                    ðŸŒ… Morning
                  </button>
                  <button className={`pill-btn ${selectedTimeSlot === 'EVENING' ? 'active' : ''}`} onClick={() => setSelectedTimeSlot('EVENING')}>
                    ðŸŒ‡ Evening
                  </button>
                  <button className={`pill-btn ${selectedTimeSlot === 'NIGHT' ? 'active' : ''}`} onClick={() => setSelectedTimeSlot('NIGHT')}>
                    ðŸŒ™ Night
                  </button>
                </div>
              </div>
            </div>

            {/* Bus Cards List */}
            <div className="bus-list">
              {filteredAndSortedBuses.map((bus) => {
                const busKey = bus._id || bus.id
                const isSingleDeck = bus.layoutType === 'PUSHBACK_ONLY' || bus.layoutType === 'SEATER_ONLY'
                const allSeats = bus.seats || []
                const lowerSeats = isSingleDeck ? allSeats : allSeats.filter(s => s.deck === 'LOWER')
                const upperSeats = isSingleDeck ? [] : allSeats.filter(s => s.deck === 'UPPER')
                const isAc = (bus.acType || 'AC') === 'AC'

                const bookedCount = allSeats.filter(s => Boolean(getSeatBookingInfo(s.seatNumber, busKey))).length
                const availableCount = Math.max(0, allSeats.length - bookedCount)

                return (
                  <div key={busKey} className="bus-card">
                    <div className="bus-main-info">
                      <div>
                        <h4>{bus.name}</h4>
                        <div className="bus-spec-tags">
                          <span className={`ac-pill ${isAc ? 'ac-yes' : 'ac-no'}`}>
                            {isAc ? 'â„ï¸ AC' : 'ðŸŒ¬ï¸ Non-AC'}
                          </span>
                          <span className="bus-badge">
                            {bus.layoutType === 'ALL_SLEEPER'
                              ? `All Sleeper â€¢ ${allSeats.length} Berths`
                              : bus.layoutType === 'MIXED_SEATER_SLEEPER'
                                ? `Sleeper + Seater â€¢ ${lowerSeats.length} Seats + ${upperSeats.length} Berths`
                                : `Seater Coach â€¢ ${allSeats.length} Seats`}
                          </span>
                          <span className="bus-reg-tag">{bus.busNumber}</span>
                        </div>
                      </div>
                      <div className="rating-tag">4.8 â˜…</div>
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
                        <span className="fare-label">Starts From</span>
                        <h3>â‚¹{bus.price}</h3>
                      </div>
                    </div>

                    <div className="bus-actions">
                      <span className="seats-count">
                        <strong style={{ color: '#16a34a' }}>{availableCount} Available</strong> of {bus.totalSeats || allSeats.length} {bus.layoutType === 'ALL_SLEEPER' ? 'Berths' : 'Seats'}
                      </span>
                      <button className="select-seat-btn" onClick={() => openBusDetails(bus)}>
                        {selectedBus && (selectedBus._id || selectedBus.id) === busKey ? 'Hide Seats' : 'Select Seats'}
                      </button>
                    </div>

                    {/* REALISTIC SIDE-BY-SIDE DUAL DECK / SINGLE DECK CABIN MAP */}
                    {selectedBus && (selectedBus._id || selectedBus.id) === busKey && (
                      <div className="seat-layout-panel">
                        <div className="seat-map-header">
                          <div>
                            <h5>Select Your Berth / Seat</h5>
                            <span className="coach-layout-caption">
                              {isAc ? 'Air Conditioned' : 'Non-AC'} â€¢{' '}
                              {bus.layoutType === 'ALL_SLEEPER'
                                ? `2+1 Sleeper (${lowerSeats.length} Lower + ${upperSeats.length} Upper Berths)`
                                : bus.layoutType === 'MIXED_SEATER_SLEEPER'
                                  ? `2+1 Mixed (${lowerSeats.length} Lower Pushback Seats + ${upperSeats.length} Upper Sleepers)`
                                  : `2+2 Single Deck (${allSeats.length} Pushback Seats)`}
                            </span>
                          </div>

                          <div className="seat-legend">
                            <div className="legend-item"><span className="legend-box avail-box"></span> Available</div>
                            <div className="legend-item"><span className="legend-box sel-box"></span> Selected</div>
                            <div className="legend-item"><span className="legend-box sold-box"></span> Sold</div>
                            <div className="legend-item"><span className="legend-box female-box"></span> Ladies</div>
                            <div className="legend-item"><span className="legend-box resale-box"></span> Resale âš¡</div>
                          </div>
                        </div>

                        <div className={`decks-side-by-side ${isSingleDeck ? 'single-deck-center' : ''}`}>
                          {isSingleDeck ? (
                            renderDeckShell(
                              lowerSeats,
                              `Main Cabin (${lowerSeats.length} Seats)`,
                              true,
                              true,
                              bus,
                              busKey
                            )
                          ) : (
                            <>
                              {renderDeckShell(
                                lowerSeats,
                                bus.layoutType === 'MIXED_SEATER_SLEEPER'
                                  ? `Lower deck (${lowerSeats.length} Seats)`
                                  : `Lower deck (${lowerSeats.length} Berths)`,
                                true,
                                false,
                                bus,
                                busKey
                              )}
                              {renderDeckShell(
                                upperSeats,
                                `Upper deck (${upperSeats.length} Berths)`,
                                false,
                                false,
                                bus,
                                busKey
                              )}
                            </>
                          )}
                        </div>

                        {/* Pick-up / Drop selection */}
                        <div className="points-selection-grid">
                          <div className="points-box">
                            <label className="points-label">ðŸ“ Boarding Points in {source}</label>
                            <div className="points-options">
                              {((selectedBus?.boardingPoints?.length ? selectedBus.boardingPoints.map((p, i) => ({ id: i, ...p })) : CITY_POINTS[source]) || []).map((bp) => {
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
                            <label className="points-label">ðŸŽ¯ Dropping Points in {destination}</label>
                            <div className="points-options">
                              {((selectedBus?.droppingPoints?.length ? selectedBus.droppingPoints.map((p, i) => ({ id: i, ...p })) : CITY_POINTS[destination]) || []).map((dp) => {
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
                            <p>Selected ({selectedSeats.length}): <strong>{selectedSeats.map(s => `${s.seatLabel} (â‚¹${s.price})`).join(', ') || 'None'}</strong></p>
                            <p className="chosen-points-preview">
                              <strong>Pickup:</strong> {selectedBoardingPoint} | <strong>Drop:</strong> {selectedDroppingPoint}
                            </p>
                          </div>
                          <div className="action-col">
                            <button className="confirm-btn" disabled={selectedSeats.length === 0} onClick={handleProceedToDetails}>
                              Proceed to Passenger Details (â‚¹{totalCalculatedFare}) âž”
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

          <div className="bus-list" style={{ marginTop: '1rem' }}>
            {userPersonalBookings.map(b => (
              <div key={b.pnr} className="booking-card">
                <div className="booking-top">
                  <div>
                    <span className="pnr-tag">PNR: {b.pnr}</span>
                    <h4>{b.busName}</h4>
                    <p>{b.route} â€¢ {b.journeyDate} at {b.departure}</p>
                    <p style={{ fontSize: '0.85rem', color: '#64748b' }}>ðŸ“ Pickup: {b.boarding} | ðŸŽ¯ Drop: {b.dropping}</p>
                  </div>
                  <strong className={b.status === 'CANCELLED' ? 'status-cancelled' : 'status-confirmed'}>{b.status}</strong>
                </div>

                <div className="passenger-seat-list">
                  <h5>Confirmed Passengers & Seats:</h5>
                  <div className="passengers-chips">
                    {(b.passengers || []).map(p => (
                      <div key={p.seatNumber} className="seat-pill">
                        <strong>{p.seatLabel || `Seat ${p.seatNumber}`}</strong>: {p.name} ({p.gender}, {p.age} yrs)
                      </div>
                    ))}
                  </div>
                </div>

                <div className="booking-footer">
                  <span>Total Paid: <strong>â‚¹{b.totalPaid}</strong></span>
                  <div className="booking-btn-row">
                    <button className="view-ticket-btn" onClick={() => setViewTicket(b)}>ðŸ–¨ï¸ View Ticket</button>
                    {b.status === 'CONFIRMED' && (
                      <>
                        <button className="resale-trigger-btn" onClick={() => openResaleModal(b)}>
                          ðŸ”„ Resale Seats ({b.passengers.length})
                        </button>
                        <button className="cancel-ticket-btn" onClick={() => handleCancelBooking(b)}>
                          âœ• Cancel Ticket
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
            <h2>âš¡ Quick-Sale Resale Board</h2>
            <p>Direct passenger re-sales. All tickets lock 1 hour before bus departure.</p>
          </div>

          <div className="bus-list" style={{ marginTop: '1rem' }}>
            {resaleListings.map(item => (
              <div key={item.id} className="bus-card">
                <div className="bus-main-info">
                  <div>
                    <h4>{item.busName} (Seat {item.seatNumber})</h4>
                    <p>{item.route} â€¢ {item.date} at {item.time}</p>
                    <p style={{ fontSize: '0.85rem', color: '#64748b' }}>ðŸ“ {item.boarding} âž” ðŸŽ¯ {item.dropping}</p>
                  </div>
                  <h3>â‚¹{item.resalePrice}</h3>
                </div>
                <button className="select-seat-btn" style={{ width: '100%', marginTop: '0.8rem' }} onClick={() => openBuyerModal(item)}>
                  Buy Seat {item.seatNumber} Now âž”
                </button>
              </div>
            ))}
          </div>
        </main>
      )}

      {/* TAB 4: OPERATOR PORTAL (PROTECTED) */}
      {activeTab === 'operator' && isOperatorAuthorized && (
        <main className="results-container no-print">
          <div className="results-header-row">
            <div>
              <h2>ðŸš Fleet Operator Desk</h2>
              <p>Configure AC/Non-AC coaches, berth/seat capacity, and pricing</p>
            </div>
            <div style={{ display: 'flex', gap: '0.8rem' }}>
              <button className="confirm-btn" onClick={() => setShowAddBusModal(true)}>+ Add Bus & Configure Capacity</button>
              <button className="select-seat-btn" style={{ background: '#fee2e2', color: '#dc2626' }} onClick={handleOperatorLogout}>Exit Portal</button>
            </div>
          </div>

          <div className="bus-list">
            {(operatorBuses.length > 0 ? operatorBuses : activeFleet).map(bus => {
              const busKey = bus._id || bus.id
              const isPast = bus.departureDate ? new Date(bus.departureDate) < new Date() : false
              const isAc = (bus.acType || 'AC') === 'AC'

              return (
                <div key={busKey} className="booking-card" style={{ opacity: isPast ? 0.9 : 1, borderLeft: isPast ? '4px solid #94a3b8' : '4px solid #16a34a' }}>
                  <div className="booking-top">
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                        <span className="pnr-tag">{bus.busNumber}</span>
                        <span className={`ac-pill ${isAc ? 'ac-yes' : 'ac-no'}`}>
                          {isAc ? 'â„ï¸ AC' : 'ðŸŒ¬ï¸ Non-AC'}
                        </span>
                        <span className="bus-badge" style={{ marginTop: 0 }}>
                          {bus.layoutType === 'ALL_SLEEPER'
                            ? `All Sleeper (${bus.totalSeats} Berths)`
                            : bus.layoutType === 'MIXED_SEATER_SLEEPER'
                              ? `Sleeper + Seater (${bus.totalSeats} Total)`
                              : `Seater Only (${bus.totalSeats} Seats)`}
                        </span>
                        {isPast ? (
                          <span style={{ fontSize: '0.75rem', background: '#e2e8f0', color: '#475569', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                            âŒ› Completed
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.75rem', background: '#dcfce7', color: '#16a34a', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>
                            ðŸŸ¢ Upcoming
                          </span>
                        )}
                      </div>
                      <h4>{bus.name}</h4>
                      <p>{bus.source} â†’ {bus.destination} â€¢ Dept: {bus.departure}</p>
                      {bus.departureDate && (
                        <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
                          ðŸ“… Scheduled Departure: {new Date(bus.departureDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                      <button className="select-seat-btn" onClick={() => handleViewManifest(busKey)}>
                        ðŸ“‹ Passenger Chart
                      </button>

                      <button
                        className="select-seat-btn"
                        disabled={isPast}
                        title={isPast ? 'Past trips cannot be modified' : 'Edit details'}
                        style={{
                          background: isPast ? '#f1f5f9' : '#e0f2fe',
                          color: isPast ? '#94a3b8' : '#0369a1',
                          cursor: isPast ? 'not-allowed' : 'pointer'
                        }}
                        onClick={() => handleEditBus(bus)}
                      >
                        âœï¸ {isPast ? 'Read Only' : 'Edit Bus'}
                      </button>

                      <button
                        className="select-seat-btn"
                        style={{ background: '#fee2e2', color: '#b91c1c' }}
                        onClick={() => handleRemoveBus(bus)}
                      >
                        ðŸ—‘ï¸ Remove Bus
                      </button>
                    </div>
                  </div>

                  {selectedManifestBus === busKey && (
                    <div style={{ marginTop: '1rem', background: '#f8fafc', padding: '1rem', borderRadius: '8px' }}>
                      <h5>Confirmed Manifest ({manifestList.length} Booked Seats)</h5>
                      {isLoadingManifest ? <p>Loading chart...</p> : (
                        <table className="ticket-passenger-table">
                          <thead>
                            <tr><th>Seat</th><th>Passenger</th><th>Phone</th><th>Pickup</th><th>PNR</th></tr>
                          </thead>
                          <tbody>
                            {manifestList.map((m, i) => (
                              <tr key={i}>
                                <td><strong>Seat {m.seatNumber}</strong></td>
                                <td>{m.name} ({m.gender}, {m.age}y)</td>
                                <td>+91 {m.phone}</td>
                                <td>{m.boarding}</td>
                                <td><span className="pnr-tag">{m.pnr}</span></td>
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

      {/* STRICT OPERATOR AUTHENTICATION MODAL */}
      {showPinModal && (
        <div className="modal-backdrop no-print">
          <div className="modal-box" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>ðŸ”’ Operator Portal</h3>
              <button type="button" className="close-btn" onClick={() => setShowPinModal(false)}>âœ•</button>
            </div>

            {operatorAuthMode === 'LOGIN' ? (
              <form onSubmit={handleOperatorLoginSubmit} style={{ marginTop: '0.8rem' }}>
                <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
                  Sign in with your registered <strong>Operator Name</strong> and <strong>Password</strong>.
                </p>

                <div className="form-group">
                  <label>Operator Name</label>
                  <input
                    type="text"
                    required
                    placeholder="Enter your registered name"
                    value={opLoginName}
                    onChange={(e) => setOpLoginName(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ marginTop: '0.8rem' }}>
                  <label>Password</label>
                  <input
                    type="password"
                    required
                    placeholder="Enter your password"
                    value={opLoginPassword}
                    onChange={(e) => setOpLoginPassword(e.target.value)}
                  />
                </div>

                <div className="form-row">
              <div className="form-group">
                <label>Boarding Points (comma-separated, optional time in brackets)</label>
                <input
                  type="text"
                  placeholder="e.g. Guntakal Bus Stand (21:00), Railway Station (21:15)"
                  value={newBusForm.boardingPointsText || ''}
                  onChange={(e) => setNewBusForm({ ...newBusForm, boardingPointsText: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Dropping Points (comma-separated, optional time in brackets)</label>
                <input
                  type="text"
                  placeholder="e.g. Miyapur (05:30), KPHB (05:45), Lakdikapul (06:15)"
                  value={newBusForm.droppingPointsText || ''}
                  onChange={(e) => setNewBusForm({ ...newBusForm, droppingPointsText: e.target.value })}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Route / Via Stops Where Bus Goes (comma-separated)</label>
              <input
                type="text"
                placeholder="e.g. Anantapur, Kurnool, Jadcherla"
                value={newBusForm.viaStopsText || ''}
                onChange={(e) => setNewBusForm({ ...newBusForm, viaStopsText: e.target.value })}
              />
            </div>
            <button type="submit" className="confirm-btn" style={{ width: '100%', marginTop: '1.2rem' }} disabled={isAuthLoading}>
                  {isAuthLoading ? 'Verifying...' : 'Login to Portal âž”'}
                </button>

                <div style={{ marginTop: '1.2rem', textAlign: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '0.8rem' }}>
                  <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    First time logging in?{' '}
                    <span
                      style={{ color: '#2563eb', cursor: 'pointer', fontWeight: 'bold' }}
                      onClick={() => {
                        setOperatorAuthMode('FIRST_TIME_OTP')
                        handleRequestAdminOtp()
                      }}
                    >
                      Setup via Admin OTP (+91 8977733885)
                    </span>
                  </p>
                </div>
              </form>
            ) : (
              <form onSubmit={handleOperatorRegisterSubmit} style={{ marginTop: '0.8rem' }}>
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '0.8rem', borderRadius: '6px', marginBottom: '1rem' }}>
                  <p style={{ fontSize: '0.82rem', color: '#166534', margin: 0 }}>
                    ðŸ›¡ï¸ Admin Verification Number: <strong>+91 8977733885</strong>
                    <br />
                    OTP has been dispatched to the admin. Enter the code below to register.
                  </p>
                </div>

                <div className="form-group">
                  <label>Your Operator Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Areef Express / Royal Travels"
                    value={opRegisterName}
                    onChange={(e) => setOpRegisterName(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ marginTop: '0.8rem' }}>
                  <label>Admin OTP (from 8977733885)</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      required
                      maxLength="4"
                      placeholder="â€¢â€¢â€¢â€¢"
                      value={opOtpInput}
                      onChange={(e) => setOpOtpInput(e.target.value)}
                      style={{ textAlign: 'center', fontSize: '1.2rem', letterSpacing: '0.2rem' }}
                    />
                    <button type="button" className="select-seat-btn" onClick={handleRequestAdminOtp} disabled={isAuthLoading}>
                      Resend
                    </button>
                  </div>
                </div>

                <div className="form-group" style={{ marginTop: '0.8rem' }}>
                  <label>Create Your Password</label>
                  <input
                    type="password"
                    required
                    placeholder="Create a strong password"
                    value={opRegisterPassword}
                    onChange={(e) => setOpRegisterPassword(e.target.value)}
                  />
                </div>

                <div className="form-row">
              <div className="form-group">
                <label>Boarding Points (comma-separated, optional time in brackets)</label>
                <input
                  type="text"
                  placeholder="e.g. Guntakal Bus Stand (21:00), Railway Station (21:15)"
                  value={newBusForm.boardingPointsText || ''}
                  onChange={(e) => setNewBusForm({ ...newBusForm, boardingPointsText: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Dropping Points (comma-separated, optional time in brackets)</label>
                <input
                  type="text"
                  placeholder="e.g. Miyapur (05:30), KPHB (05:45), Lakdikapul (06:15)"
                  value={newBusForm.droppingPointsText || ''}
                  onChange={(e) => setNewBusForm({ ...newBusForm, droppingPointsText: e.target.value })}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Route / Via Stops Where Bus Goes (comma-separated)</label>
              <input
                type="text"
                placeholder="e.g. Anantapur, Kurnool, Jadcherla"
                value={newBusForm.viaStopsText || ''}
                onChange={(e) => setNewBusForm({ ...newBusForm, viaStopsText: e.target.value })}
              />
            </div>
            <button type="submit" className="confirm-btn" style={{ width: '100%', marginTop: '1.2rem' }} disabled={isAuthLoading}>
                  {isAuthLoading ? 'Registering...' : 'Register & Enter Portal âž”'}
                </button>

                <div style={{ marginTop: '1rem', textAlign: 'center' }}>
                  <span
                    style={{ color: '#2563eb', cursor: 'pointer', fontSize: '0.8rem' }}
                    onClick={() => setOperatorAuthMode('LOGIN')}
                  >
                    â† Back to Login
                  </span>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ADD BUS MODAL */}
      {showAddBusModal && (
        <div className="modal-backdrop no-print">
          <div className="modal-box large-modal">
            <form onSubmit={handleCreateBusSubmit}>
              <div className="modal-header">
                <h3>Add Bus & Configure Coach Layout</h3>
                <button type="button" className="close-btn" onClick={() => setShowAddBusModal(false)}>âœ•</button>
              </div>

              <div className="form-row">
                <div className="form-group flex-2">
                  <label>Bus Service Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. ANHAR Multi-Axle Volvo"
                    value={newBusForm.name}
                    onChange={(e) => setNewBusForm({
        boardingPointsText: '', droppingPointsText: '', viaStopsText: '', ...newBusForm,
        boardingPoints: customBoarding,
        droppingPoints: customDropping,
        viaStops: customVia, name: e.target.value })}
                  />
                </div>
                <div className="form-group flex-1">
                  <label>Registration Number</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. AP 04 TX 9924"
                    value={newBusForm.busNumber}
                    onChange={(e) => setNewBusForm({
        boardingPointsText: '', droppingPointsText: '', viaStopsText: '', ...newBusForm,
        boardingPoints: customBoarding,
        droppingPoints: customDropping,
        viaStops: customVia, busNumber: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group flex-2">
                  <label>Coach Layout Category</label>
                  <select
                    value={newBusForm.layoutType}
                    onChange={(e) => setNewBusForm({
        boardingPointsText: '', droppingPointsText: '', viaStopsText: '', ...newBusForm,
        boardingPoints: customBoarding,
        droppingPoints: customDropping,
        viaStops: customVia, layoutType: e.target.value })}
                  >
                    <option value="ALL_SLEEPER">All Sleeper Bus (Lower + Upper Berths)</option>
                    <option value="MIXED_SEATER_SLEEPER">Sleeper + Seater Bus (Lower Seats + Upper Berths)</option>
                    <option value="PUSHBACK_ONLY">Seater Only Bus (2+2 Pushback Seater)</option>
                    <option value="SEATER_ONLY">Seater Only Bus (2+2 Classic Seater)</option>
                  </select>
                </div>

                <div className="form-group flex-1">
                  <label>Air Conditioning</label>
                  <div className="ac-toggle-group">
                    <button
                      type="button"
                      className={`ac-toggle-btn ${newBusForm.acType === 'AC' ? 'active' : ''}`}
                      onClick={() => setNewBusForm({
        boardingPointsText: '', droppingPointsText: '', viaStopsText: '', ...newBusForm,
        boardingPoints: customBoarding,
        droppingPoints: customDropping,
        viaStops: customVia, acType: 'AC' })}
                    >
                      â„ï¸ AC
                    </button>
                    <button
                      type="button"
                      className={`ac-toggle-btn ${newBusForm.acType === 'NON_AC' ? 'active' : ''}`}
                      onClick={() => setNewBusForm({
        boardingPointsText: '', droppingPointsText: '', viaStopsText: '', ...newBusForm,
        boardingPoints: customBoarding,
        droppingPoints: customDropping,
        viaStops: customVia, acType: 'NON_AC' })}
                    >
                      ðŸŒ¬ï¸ Non-AC
                    </button>
                  </div>
                </div>
              </div>

              <div className="capacity-config-box">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                  <strong>
                    {newBusForm.layoutType === 'ALL_SLEEPER'
                      ? 'ðŸ›ï¸ Total Sleeper Berths Configuration'
                      : newBusForm.layoutType === 'MIXED_SEATER_SLEEPER'
                        ? 'ðŸšŒ Lower Seater & Upper Sleeper Berths Count'
                        : 'ðŸ’º Total Seater Capacity Configuration'}
                  </strong>
                  <span className="capacity-total-pill">
                    Total Capacity: {isDoubleDeckForm ? Number(newBusForm.lowerCount) + Number(newBusForm.upperCount) : Number(newBusForm.totalSeats)}{' '}
                    {newBusForm.layoutType === 'ALL_SLEEPER' ? 'Berths' : isDoubleDeckForm ? 'Seats + Berths' : 'Seats'}
                  </span>
                </div>

                {isDoubleDeckForm ? (
                  <div className="form-row">
                    <div className="form-group flex-1" style={{ marginBottom: 0 }}>
                      <label>
                        {newBusForm.layoutType === 'ALL_SLEEPER'
                          ? 'Lower Deck Berths (e.g. 15 or 18)'
                          : 'Lower Deck Pushback Seats (e.g. 15 or 18)'}
                      </label>
                      <input
                        type="number"
                        required
                        min="6"
                        max="30"
                        value={newBusForm.lowerCount}
                        onChange={(e) => setNewBusForm({
        boardingPointsText: '', droppingPointsText: '', viaStopsText: '', ...newBusForm,
        boardingPoints: customBoarding,
        droppingPoints: customDropping,
        viaStops: customVia, lowerCount: Number(e.target.value) })}
                      />
                    </div>
                    <div className="form-group flex-1" style={{ marginBottom: 0 }}>
                      <label>Upper Deck Sleeper Berths (e.g. 15 or 18)</label>
                      <input
                        type="number"
                        required
                        min="6"
                        max="30"
                        value={newBusForm.upperCount}
                        onChange={(e) => setNewBusForm({
        boardingPointsText: '', droppingPointsText: '', viaStopsText: '', ...newBusForm,
        boardingPoints: customBoarding,
        droppingPoints: customDropping,
        viaStops: customVia, upperCount: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Total Number of Seats in Bus (e.g. 24, 32, 36, 40)</label>
                    <input
                      type="number"
                      required
                      min="12"
                      max="60"
                      value={newBusForm.totalSeats}
                      onChange={(e) => setNewBusForm({
        boardingPointsText: '', droppingPointsText: '', viaStopsText: '', ...newBusForm,
        boardingPoints: customBoarding,
        droppingPoints: customDropping,
        viaStops: customVia, totalSeats: Number(e.target.value) })}
                    />
                  </div>
                )}
              </div>

              <div className="form-row" style={{ marginTop: '0.85rem' }}>
                <div className="form-group flex-1">
                  <label>Departure Date</label>
                  <input type="date" required value={newBusForm.date} onChange={(e) => setNewBusForm({
        boardingPointsText: '', droppingPointsText: '', viaStopsText: '', ...newBusForm,
        boardingPoints: customBoarding,
        droppingPoints: customDropping,
        viaStops: customVia, date: e.target.value })} />
                </div>
                <div className="form-group flex-1">
                  <label>Departure Time</label>
                  <input type="time" required value={newBusForm.departure} onChange={(e) => {
                    const [h, m] = e.target.value.split(':').map(Number)
                    setNewBusForm({
        boardingPointsText: '', droppingPointsText: '', viaStopsText: '', ...newBusForm,
        boardingPoints: customBoarding,
        droppingPoints: customDropping,
        viaStops: customVia, departure: e.target.value, departureHour: h + m / 60 })
                  }} />
                </div>
                <div className="form-group flex-1">
                  <label>Arrival Time</label>
                  <input type="time" required value={newBusForm.arrival} onChange={(e) => setNewBusForm({
        boardingPointsText: '', droppingPointsText: '', viaStopsText: '', ...newBusForm,
        boardingPoints: customBoarding,
        droppingPoints: customDropping,
        viaStops: customVia, arrival: e.target.value })} />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group flex-1">
                  <label>From (Source)</label>
                  <select value={newBusForm.source} onChange={(e) => setNewBusForm({
        boardingPointsText: '', droppingPointsText: '', viaStopsText: '', ...newBusForm,
        boardingPoints: customBoarding,
        droppingPoints: customDropping,
        viaStops: customVia, source: e.target.value })}>
                    <option value="Bengaluru">Bengaluru</option>
                    <option value="Hyderabad">Hyderabad</option>
                    <option value="Guntakal">Guntakal</option>
                    <option value="Chennai">Chennai</option>
                  </select>
                </div>
                <div className="form-group flex-1">
                  <label>To (Destination)</label>
                  <select value={newBusForm.destination} onChange={(e) => setNewBusForm({
        boardingPointsText: '', droppingPointsText: '', viaStopsText: '', ...newBusForm,
        boardingPoints: customBoarding,
        droppingPoints: customDropping,
        viaStops: customVia, destination: e.target.value })}>
                    <option value="Hyderabad">Hyderabad</option>
                    <option value="Bengaluru">Bengaluru</option>
                    <option value="Guntakal">Guntakal</option>
                    <option value="Chennai">Chennai</option>
                  </select>
                </div>
                <div className="form-group flex-1">
                  <label>Starting Display Fare (â‚¹)</label>
                  <input type="number" required min="100" value={newBusForm.price} onChange={(e) => setNewBusForm({
        boardingPointsText: '', droppingPointsText: '', viaStopsText: '', ...newBusForm,
        boardingPoints: customBoarding,
        droppingPoints: customDropping,
        viaStops: customVia, price: Number(e.target.value) })} />
                </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #cbd5e1', marginTop: '0.4rem' }}>
                <h4 style={{ marginBottom: '0.8rem' }}>Tiered Seat / Berth Price Customization (â‚¹)</h4>
                <div className="form-row">
                  <div className="form-group flex-1">
                    <label>{isDoubleDeckForm ? 'Lower Left Single Berth/Seat (â‚¹)' : 'Left Window Side Seat (â‚¹)'}</label>
                    <input type="number" value={newBusForm.lowerLeftPrice} onChange={(e) => setNewBusForm({
        boardingPointsText: '', droppingPointsText: '', viaStopsText: '', ...newBusForm,
        boardingPoints: customBoarding,
        droppingPoints: customDropping,
        viaStops: customVia, lowerLeftPrice: Number(e.target.value) })} />
                  </div>
                  <div className="form-group flex-1">
                    <label>{isDoubleDeckForm ? 'Lower Right Double Berth/Seat (â‚¹)' : 'Right Side Seat (â‚¹)'}</label>
                    <input type="number" value={newBusForm.lowerRightPrice} onChange={(e) => setNewBusForm({
        boardingPointsText: '', droppingPointsText: '', viaStopsText: '', ...newBusForm,
        boardingPoints: customBoarding,
        droppingPoints: customDropping,
        viaStops: customVia, lowerRightPrice: Number(e.target.value) })} />
                  </div>
                </div>

                <div className="form-row" style={{ marginTop: '0.6rem' }}>
                  {isDoubleDeckForm && (
                    <div className="form-group flex-1">
                      <label>Upper Deck Sleeper Berth (â‚¹)</label>
                      <input type="number" value={newBusForm.upperLeftPrice} onChange={(e) => setNewBusForm({
        boardingPointsText: '', droppingPointsText: '', viaStopsText: '', ...newBusForm,
        boardingPoints: customBoarding,
        droppingPoints: customDropping,
        viaStops: customVia, upperLeftPrice: Number(e.target.value) })} />
                    </div>
                  )}
                  <div className="form-group flex-1">
                    <label>Last Row Discounted Price (â‚¹)</label>
                    <input type="number" value={newBusForm.backPrice} onChange={(e) => setNewBusForm({
        boardingPointsText: '', droppingPointsText: '', viaStopsText: '', ...newBusForm,
        boardingPoints: customBoarding,
        droppingPoints: customDropping,
        viaStops: customVia, backPrice: Number(e.target.value) })} />
                  </div>
                </div>
              </div>

              <div className="form-row">
              <div className="form-group">
                <label>Boarding Points (comma-separated, optional time in brackets)</label>
                <input
                  type="text"
                  placeholder="e.g. Guntakal Bus Stand (21:00), Railway Station (21:15)"
                  value={newBusForm.boardingPointsText || ''}
                  onChange={(e) => setNewBusForm({ ...newBusForm, boardingPointsText: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Dropping Points (comma-separated, optional time in brackets)</label>
                <input
                  type="text"
                  placeholder="e.g. Miyapur (05:30), KPHB (05:45), Lakdikapul (06:15)"
                  value={newBusForm.droppingPointsText || ''}
                  onChange={(e) => setNewBusForm({ ...newBusForm, droppingPointsText: e.target.value })}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Route / Via Stops Where Bus Goes (comma-separated)</label>
              <input
                type="text"
                placeholder="e.g. Anantapur, Kurnool, Jadcherla"
                value={newBusForm.viaStopsText || ''}
                onChange={(e) => setNewBusForm({ ...newBusForm, viaStopsText: e.target.value })}
              />
            </div>
            <button type="submit" className="confirm-btn" style={{ marginTop: '1.2rem', width: '100%' }}>
                Publish Bus to Network âž”
              </button>
            </form>
          </div>
        </div>
      )}

      {/* PASSENGER DETAILS MODAL */}
      {showPassengerModal && (
        <div className="modal-backdrop no-print">
          <div className="modal-box large-modal">
            <form onSubmit={handleProceedToPayment}>
              <div className="modal-header">
                <h3>Passenger Details ({passengerDetails.length} Selected)</h3>
                <button type="button" className="close-btn" onClick={() => setShowPassengerModal(false)}>âœ•</button>
              </div>

              {passengerDetails.map((p, idx) => (
                <div key={p.seatNumber} className="booking-card" style={{ marginBottom: '0.8rem' }}>
                  <h5>Passenger {idx + 1} â€” {p.seatLabel} (â‚¹{p.price})</h5>
                  <div className="form-row" style={{ marginTop: '0.5rem' }}>
                    <div className="form-group flex-2">
                      <input type="text" required placeholder="Full Name (as per Govt ID)" value={p.name} onChange={(e) => {
                        const updated = [...passengerDetails]
                        updated[idx].name = e.target.value
                        setPassengerDetails(updated)
                      }} />
                    </div>
                    <div className="form-group flex-1">
                      <input type="number" required placeholder="Age" min="1" max="100" value={p.age} onChange={(e) => {
                        const updated = [...passengerDetails]
                        updated[idx].age = e.target.value
                        setPassengerDetails(updated)
                      }} />
                    </div>
                    <div className="form-group flex-1">
                      <select value={p.gender} onChange={(e) => {
                        const updated = [...passengerDetails]
                        updated[idx].gender = e.target.value
                        setPassengerDetails(updated)
                      }}>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}

              <div className="form-row">
                <div className="form-group flex-1">
                  <label>Mobile Number (For Ticket SMS)</label>
                  <input type="tel" required pattern="[0-9]{10}" placeholder="10-digit mobile" value={contactInfo.phone} onChange={(e) => setContactInfo({ ...contactInfo, phone: e.target.value })} />
                </div>
                <div className="form-group flex-1">
                  <label>Email Address</label>
                  <input type="email" required placeholder="name@example.com" value={contactInfo.email} onChange={(e) => setContactInfo({ ...contactInfo, email: e.target.value })} />
                </div>
              </div>

              <div className="form-row">
              <div className="form-group">
                <label>Boarding Points (comma-separated, optional time in brackets)</label>
                <input
                  type="text"
                  placeholder="e.g. Guntakal Bus Stand (21:00), Railway Station (21:15)"
                  value={newBusForm.boardingPointsText || ''}
                  onChange={(e) => setNewBusForm({ ...newBusForm, boardingPointsText: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Dropping Points (comma-separated, optional time in brackets)</label>
                <input
                  type="text"
                  placeholder="e.g. Miyapur (05:30), KPHB (05:45), Lakdikapul (06:15)"
                  value={newBusForm.droppingPointsText || ''}
                  onChange={(e) => setNewBusForm({ ...newBusForm, droppingPointsText: e.target.value })}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Route / Via Stops Where Bus Goes (comma-separated)</label>
              <input
                type="text"
                placeholder="e.g. Anantapur, Kurnool, Jadcherla"
                value={newBusForm.viaStopsText || ''}
                onChange={(e) => setNewBusForm({ ...newBusForm, viaStopsText: e.target.value })}
              />
            </div>
            <button type="submit" className="confirm-btn" style={{ width: '100%', marginTop: '1rem' }}>
                Proceed to Payment Gateway (â‚¹{grandTotal}) âž”
              </button>
            </form>
          </div>
        </div>
      )}

      {/* REAL RAZORPAY PAYMENT GATEWAY MODAL */}
      {showPaymentModal && (
        <div className="modal-backdrop no-print">
          <div className="modal-box payment-gateway-modal">
            <div className="modal-header">
              <h3>ðŸ”’ ANHAR Secure Payments</h3>
              <button type="button" className="close-btn" onClick={() => setShowPaymentModal(false)}>âœ•</button>
            </div>

            <div className="payment-breakdown-card" style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span>Base Fare ({selectedSeats.length} Seats)</span>
                <span>â‚¹{totalCalculatedFare}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                <span>GST (5%)</span>
                <span>â‚¹{gstAmount}</span>
              </div>
              {useWalletOffset && walletDeductionPossible > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a', fontWeight: 'bold' }}>
                  <span>ANHAR Wallet Applied</span>
                  <span>- â‚¹{walletDeductionPossible}</span>
                </div>
              )}
              <hr style={{ margin: '0.6rem 0', borderColor: '#e2e8f0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 'bold' }}>
                <span>Net Payable</span>
                <span>â‚¹{finalPayableAfterWallet}</span>
              </div>
            </div>

            {walletBalance > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  padding: '0.6rem',
                  background: useWalletOffset ? '#e0f2fe' : '#f1f5f9',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  marginBottom: '1rem'
                }}
                onClick={() => setUseWalletOffset(!useWalletOffset)}
              >
                <input type="checkbox" checked={useWalletOffset} readOnly />
                <span>Use ANHAR Wallet Balance (Available: â‚¹{walletBalance})</span>
              </div>
            )}

            {finalPayableAfterWallet > 0 && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '0.85rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem', color: '#166534' }}>
                <strong>Powered by Razorpay:</strong> Supports GPay, PhonePe, Paytm UPI, QR Code, Credit/Debit Cards & NetBanking.
              </div>
            )}

            <button
              className="confirm-btn pay-now-btn"
              style={{ width: '100%', marginTop: '0.4rem' }}
              disabled={isProcessingPayment}
              onClick={handlePayNowClick}
            >
              {isProcessingPayment
                ? 'Opening Secure Checkout...'
                : finalPayableAfterWallet === 0
                  ? 'Confirm Booking with ANHAR Wallet âž”'
                  : `Pay â‚¹{finalPayableAfterWallet} via UPI / Card âž”`}
            </button>
          </div>
        </div>
      )}

      {/* BRANDED PRINTABLE BOARDING PASS */}
      {viewTicket && (
        <div className="modal-backdrop printable-modal-backdrop">
          <div className="modal-box printable-ticket-wrapper" style={{ maxWidth: '650px' }}>
            <div className="ticket-actions-bar no-print" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <button className="confirm-btn" onClick={() => window.print()}>ðŸ–¨ï¸ Print / Save PDF</button>
              <button className="close-btn" onClick={() => setViewTicket(null)}>âœ• Close</button>
            </div>
            <div className="boarding-pass" style={{ border: '2px solid #0f172a', padding: '1.2rem', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.8rem' }}>
                <div>
                  <h2>ðŸšŒ ANHAR BUS</h2>
                  <p style={{ fontSize: '0.85rem', color: '#64748b' }}>Official E-Ticket & Boarding Pass</p>
                </div>
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=ANHAR_PASS_PNR_${viewTicket.pnr}`}
                  alt="Boarding Pass QR"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.8rem', margin: '1rem 0' }}>
                <div>
                  <p><strong>PNR:</strong> {viewTicket.pnr}</p>
                  <p><strong>Bus:</strong> {viewTicket.busName} ({viewTicket.busNumber})</p>
                  <p><strong>Journey Date:</strong> {viewTicket.journeyDate} at {viewTicket.departure}</p>
                </div>
                <div>
                  <p><strong>Route:</strong> {viewTicket.route}</p>
                  <p><strong>Boarding Point:</strong> {viewTicket.boarding}</p>
                  <p><strong>Dropping Point:</strong> {viewTicket.dropping}</p>
                </div>
              </div>

              <table className="ticket-passenger-table">
                <thead>
                  <tr><th>#</th><th>Passenger Name</th><th>Age / Gender</th><th>Seat</th></tr>
                </thead>
                <tbody>
                  {(viewTicket.passengers || []).map((p, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td>
                      <td><strong>{p.name}</strong></td>
                      <td>{p.age} yrs / {p.gender}</td>
                      <td><span className="pnr-tag">{p.seatLabel || `Seat ${p.seatNumber}`}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ marginTop: '1rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.8rem', fontSize: '0.8rem', color: '#64748b' }}>
                <p>24x7 Helpline: 1800-425-ANHAR | support@anharbus.com</p>
                <p>Please report to the boarding landmark 15 minutes before scheduled departure.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RESALE MODAL: SELLER LISTING */}
      {resellingBooking && (
        <div className="modal-backdrop no-print">
          <div className="modal-box" style={{ maxWidth: '440px' }}>
            <div className="modal-header">
              <h3>âš¡ Quick-Sale Resale Listing</h3>
              <button type="button" className="close-btn" onClick={() => setResellingBooking(null)}>âœ•</button>
            </div>
            <p style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '1rem' }}>
              Select the seats from booking <strong>{resellingBooking.pnr}</strong> you wish to list on the public marketplace.
            </p>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              {(resellingBooking.passengers || []).map(p => (
                <button
                  key={p.seatNumber}
                  type="button"
                  className={`pill-btn ${seatsToResell.includes(p.seatNumber) ? 'active' : ''}`}
                  onClick={() => toggleSeatToResell(p.seatNumber)}
                >
                  {p.seatLabel || `Seat ${p.seatNumber}`} ({p.name})
                </button>
              ))}
            </div>

            <div className="form-group">
              <label>Markup / Discount Adjust (â‚¹)</label>
              <input
                type="number"
                value={resaleMarkup}
                onChange={(e) => setResaleMarkup(Number(e.target.value))}
                placeholder="0 for original price"
              />
            </div>

            <button
              type="button"
              className="confirm-btn"
              style={{ width: '100%', marginTop: '0.8rem' }}
              disabled={seatsToResell.length === 0 || isSubmittingResale}
              onClick={confirmResaleListing}
            >
              {isSubmittingResale ? 'Publishing...' : `Publish ${seatsToResell.length} Seat(s) to Market âž”`}
            </button>
          </div>
        </div>
      )}

      {/* RESALE MODAL: BUYER PURCHASE */}
      {selectedResaleItem && (
        <div className="modal-backdrop no-print">
          <div className="modal-box" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3>âš¡ Instant Resale Purchase</h3>
              <button type="button" className="close-btn" onClick={() => setSelectedResaleItem(null)}>âœ•</button>
            </div>
            <div style={{ background: '#f8fafc', padding: '0.8rem', borderRadius: '8px', marginBottom: '1rem' }}>
              <p><strong>Bus:</strong> {selectedResaleItem.busName}</p>
              <p><strong>Seat:</strong> {selectedResaleItem.seatNumber} | <strong>Price:</strong> â‚¹{selectedResaleItem.resalePrice}</p>
              <p style={{ fontSize: '0.85rem', color: '#64748b' }}>ðŸ“ {selectedResaleItem.boarding} âž” {selectedResaleItem.dropping}</p>
            </div>

            <form onSubmit={handleResalePurchaseSubmit}>
              <div className="form-group">
                <label>Passenger Full Name</label>
                <input
                  type="text"
                  required
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
                    max="100"
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
                  value={buyerDetails.phone}
                  onChange={(e) => setBuyerDetails({ ...buyerDetails, phone: e.target.value })}
                />
              </div>
              <div className="form-row">
              <div className="form-group">
                <label>Boarding Points (comma-separated, optional time in brackets)</label>
                <input
                  type="text"
                  placeholder="e.g. Guntakal Bus Stand (21:00), Railway Station (21:15)"
                  value={newBusForm.boardingPointsText || ''}
                  onChange={(e) => setNewBusForm({ ...newBusForm, boardingPointsText: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Dropping Points (comma-separated, optional time in brackets)</label>
                <input
                  type="text"
                  placeholder="e.g. Miyapur (05:30), KPHB (05:45), Lakdikapul (06:15)"
                  value={newBusForm.droppingPointsText || ''}
                  onChange={(e) => setNewBusForm({ ...newBusForm, droppingPointsText: e.target.value })}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Route / Via Stops Where Bus Goes (comma-separated)</label>
              <input
                type="text"
                placeholder="e.g. Anantapur, Kurnool, Jadcherla"
                value={newBusForm.viaStopsText || ''}
                onChange={(e) => setNewBusForm({ ...newBusForm, viaStopsText: e.target.value })}
              />
            </div>
            <button type="submit" className="confirm-btn" style={{ width: '100%', marginTop: '0.8rem' }} disabled={isProcessingPayment}>
                {isProcessingPayment ? 'Opening Checkout...' : `Pay â‚¹${selectedResaleItem.resalePrice} & Grab Seat âž”`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* PASSENGER AUTH / OTP MODAL */}
      {showLoginModal && (
        <div className="modal-backdrop no-print">
          <div className="modal-box" style={{ maxWidth: '380px' }}>
            {loginStep === 'DETAILS' ? (
              <form onSubmit={handleRequestOtp}>
                <h3>Passenger Verification</h3>
                <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.4rem', marginBottom: '1rem' }}>
                  Enter your details to receive ticket confirmations via SMS.
                </p>
                <div className="form-group">
                  <label>Full Name</label>
                  <input type="text" required placeholder="Enter full name" value={loginForm.name} onChange={(e) => setLoginForm({ ...loginForm, name: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Email Address</label>
                  <input type="email" required placeholder="name@example.com" value={loginForm.email} onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Mobile Number (For SMS OTP)</label>
                  <input type="tel" required maxLength="10" placeholder="10-digit mobile" value={loginForm.phone} onChange={(e) => setLoginForm({ ...loginForm, phone: e.target.value })} />
                </div>
                <div className="form-row">
              <div className="form-group">
                <label>Boarding Points (comma-separated, optional time in brackets)</label>
                <input
                  type="text"
                  placeholder="e.g. Guntakal Bus Stand (21:00), Railway Station (21:15)"
                  value={newBusForm.boardingPointsText || ''}
                  onChange={(e) => setNewBusForm({ ...newBusForm, boardingPointsText: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Dropping Points (comma-separated, optional time in brackets)</label>
                <input
                  type="text"
                  placeholder="e.g. Miyapur (05:30), KPHB (05:45), Lakdikapul (06:15)"
                  value={newBusForm.droppingPointsText || ''}
                  onChange={(e) => setNewBusForm({ ...newBusForm, droppingPointsText: e.target.value })}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Route / Via Stops Where Bus Goes (comma-separated)</label>
              <input
                type="text"
                placeholder="e.g. Anantapur, Kurnool, Jadcherla"
                value={newBusForm.viaStopsText || ''}
                onChange={(e) => setNewBusForm({ ...newBusForm, viaStopsText: e.target.value })}
              />
            </div>
            <button type="submit" className="confirm-btn" style={{ width: '100%', marginTop: '0.8rem' }} disabled={isSendingOtp}>
                  {isSendingOtp ? 'Sending OTP...' : 'Send OTP via SMS âž”'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp}>
                <h3>Verify 4-Digit Code</h3>
                <p style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.4rem', marginBottom: '1rem' }}>
                  Enter code sent to <strong>+91 {loginForm.phone}</strong>
                </p>
                <div className="form-group">
                  <input
                    type="text"
                    required
                    maxLength="4"
                    placeholder="â€¢â€¢â€¢â€¢"
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value)}
                    style={{ textAlign: 'center', fontSize: '1.4rem', letterSpacing: '0.3rem' }}
                  />
                </div>
                <div className="form-row">
              <div className="form-group">
                <label>Boarding Points (comma-separated, optional time in brackets)</label>
                <input
                  type="text"
                  placeholder="e.g. Guntakal Bus Stand (21:00), Railway Station (21:15)"
                  value={newBusForm.boardingPointsText || ''}
                  onChange={(e) => setNewBusForm({ ...newBusForm, boardingPointsText: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Dropping Points (comma-separated, optional time in brackets)</label>
                <input
                  type="text"
                  placeholder="e.g. Miyapur (05:30), KPHB (05:45), Lakdikapul (06:15)"
                  value={newBusForm.droppingPointsText || ''}
                  onChange={(e) => setNewBusForm({ ...newBusForm, droppingPointsText: e.target.value })}
                />
              </div>
            </div>
            <div className="form-group">
              <label>Route / Via Stops Where Bus Goes (comma-separated)</label>
              <input
                type="text"
                placeholder="e.g. Anantapur, Kurnool, Jadcherla"
                value={newBusForm.viaStopsText || ''}
                onChange={(e) => setNewBusForm({ ...newBusForm, viaStopsText: e.target.value })}
              />
            </div>
            <button type="submit" className="confirm-btn" style={{ width: '100%', marginTop: '0.8rem' }} disabled={isVerifyingOtp}>
                  {isVerifyingOtp ? 'Verifying...' : 'Verify & Continue âž”'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
