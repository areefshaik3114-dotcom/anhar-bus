const API_BASE = 'https://anhar-bus.onrender.com'

export const api = {
  getBookings: async () => {
    const res = await fetch(`${API_BASE}/api/bookings`)
    const data = await res.json()
    return data.bookings || []
  },

  createBooking: async (bookingData) => {
    const res = await fetch(`${API_BASE}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookingData)
    })
    return res.json()
  },

  getResaleListings: async () => {
    const res = await fetch(`${API_BASE}/api/resale`)
    const data = await res.json()
    return data.listings || []
  },

  publishResale: async (listings, updatedBookings) => {
    const res = await fetch(`${API_BASE}/api/resale`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listings, updatedBookings })
    })
    return res.json()
  },

  buyResale: async (resaleId, buyerBooking) => {
    const res = await fetch(`${API_BASE}/api/resale/buy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resaleId, buyerBooking })
    })
    return res.json()
  },

  // MongoDB Atlas User Wallet Endpoints
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
  }
}