const API_BASE = 'https://anhar-bus.onrender.com'

export const api = {
  // 1. Fetch all bookings
  getBookings: async () => {
    const res = await fetch(`${API_BASE}/api/bookings`)
    const data = await res.json()
    return data.bookings || []
  },

  // 2. Create primary booking
  createBooking: async (bookingData) => {
    const res = await fetch(`${API_BASE}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookingData)
    })
    return res.json()
  },

  // 3. Fetch resale marketplace listings
  getResaleListings: async () => {
    const res = await fetch(`${API_BASE}/api/resale`)
    const data = await res.json()
    return data.listings || []
  },

  // 4. Publish resale listings
  publishResale: async (listings, updatedBookings) => {
    const res = await fetch(`${API_BASE}/api/resale`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listings, updatedBookings })
    })
    return res.json()
  },

  // 5. Purchase resale seat
  buyResale: async (resaleId, buyerBooking) => {
    const res = await fetch(`${API_BASE}/api/resale/buy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resaleId, buyerBooking })
    })
    return res.json()
  },

  // 5.5 Cancel booking with redBus tiered refund & wallet credit
  cancelBooking: async (pnr) => {
    const res = await fetch(`${API_BASE}/api/bookings/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pnr })
    })
    return res.json()
  },

  // 6. MongoDB Atlas User Wallet Endpoints
  getWallet: async (phone) => {
    const res = await fetch(`${API_BASE}/api/wallet/${phone}`)
    return res.json()
  },

  updateWallet: async (phone, amount) => {
    const res = await fetch(`${API_BASE}/api/wallet/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, amount })
    })
    return res.json()
  },

  // 7. Passenger OTP Verification Endpoints
  sendOtp: async (phone) => {
    const res = await fetch(`${API_BASE}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    })
    return res.json()
  },

  verifyOtp: async (payload) => {
    const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    return res.json()
  }
}