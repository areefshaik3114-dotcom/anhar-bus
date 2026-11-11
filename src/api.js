// Automatically switches between Localhost and Render
const API_BASE = (typeof window !== 'undefined' && window.location.hostname === 'localhost')
  ? 'http://localhost:5000'
  : 'https://anhar-bus.onrender.com';

export const api = {
  // 1. Bookings Management
  getBookings: async () => {
    try {
      const res = await fetch(`${API_BASE}/api/bookings`);
      const data = await res.json();
      return data.bookings || [];
    } catch (err) {
      console.error('API Error (getBookings):', err);
      return [];
    }
  },

  createBooking: async (bookingData) => {
    try {
      const res = await fetch(`${API_BASE}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingData)
      });
      return await res.json();
    } catch (err) {
      console.error('API Error (createBooking):', err);
      return { success: false, error: err.message };
    }
  },

  // 2. Cancellation with redBus Tiered Refund & Wallet Credit
  cancelBooking: async (pnr) => {
    try {
      const res = await fetch(`${API_BASE}/api/bookings/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pnr })
      });
      return await res.json();
    } catch (err) {
      console.error('API Error (cancelBooking):', err);
      return { success: false, message: err.message };
    }
  },

  // 3. Resale Marketplace Engine
  getResaleListings: async () => {
    try {
      const res = await fetch(`${API_BASE}/api/resale`);
      const data = await res.json();
      return data.listings || [];
    } catch (err) {
      console.error('API Error (getResaleListings):', err);
      return [];
    }
  },

  publishResale: async (listings, updatedBookings) => {
    try {
      const res = await fetch(`${API_BASE}/api/resale`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listings, updatedBookings })
      });
      return await res.json();
    } catch (err) {
      console.error('API Error (publishResale):', err);
      return { success: false, error: err.message };
    }
  },

  buyResale: async (resaleId, buyerBooking) => {
    try {
      const res = await fetch(`${API_BASE}/api/resale/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resaleId, buyerBooking })
      });
      return await res.json();
    } catch (err) {
      console.error('API Error (buyResale):', err);
      return { success: false, error: err.message };
    }
  },

  // 4. Dynamic Fleet Search & Operator Routes
  searchBuses: async (source, destination) => {
    try {
      const query = new URLSearchParams();
      if (source) query.append('source', source);
      if (destination) query.append('destination', destination);
      const res = await fetch(`${API_BASE}/api/buses/search?${query.toString()}`);
      const data = await res.json();
      return data.buses || [];
    } catch (err) {
      console.error('API Error (searchBuses):', err);
      return [];
    }
  },

  getOperatorBuses: async (phone) => {
    try {
      const cleanPhone = phone ? String(phone).replace(/\D/g, '').slice(-10) : '';
      const res = await fetch(`${API_BASE}/api/operator/my-buses?phone=${cleanPhone}`);
      return await res.json();
    } catch (err) {
      console.error('API Error (getOperatorBuses):', err);
      return { success: false, buses: [] };
    }
  },

  createOperatorBus: async (busData) => {
    try {
      const res = await fetch(`${API_BASE}/api/operator/buses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(busData)
      });
      return await res.json();
    } catch (err) {
      console.error('API Error (createOperatorBus):', err);
      return { success: false, error: err.message };
    }
  },

  deleteBus: async (busId) => {
    try {
      const res = await fetch(`${API_BASE}/api/buses/${busId}`, {
        method: 'DELETE'
      });
      return await res.json();
    } catch (err) {
      console.error('API Error (deleteBus):', err);
      return { success: false, message: err.message };
    }
  },

  getTripManifest: async (busId, date) => {
    try {
      const res = await fetch(`${API_BASE}/api/operator/manifest/${busId}/${date}`);
      return await res.json();
    } catch (err) {
      console.error('API Error (getTripManifest):', err);
      return { success: false, manifest: [] };
    }
  },

  // Fixed Admin Phone (8977733885) Operator Auth Endpoints
  operatorSendSetupOtp: async () => {
    try {
      const res = await fetch(`${API_BASE}/api/operator/send-setup-otp`, { method: 'POST' });
      return await res.json();
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  operatorRegisterWithOtp: async (name, password, otp) => {
    try {
      const res = await fetch(`${API_BASE}/api/operator/register-with-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password, otp })
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  operatorLogin: async (name, password) => {
    try {
      const res = await fetch(`${API_BASE}/api/operator/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password })
      });
      return await res.json();
    } catch (err) {
      return { success: false, message: err.message };
    }
  },

  // 5. In-App User Wallet
  getWallet: async (phone) => {
    try {
      const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
      const res = await fetch(`${API_BASE}/api/wallet/${cleanPhone}`);
      return await res.json();
    } catch (err) {
      console.error('API Error (getWallet):', err);
      return { success: false, balance: 0 };
    }
  },

  updateWallet: async (phone, amount) => {
    try {
      const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
      const res = await fetch(`${API_BASE}/api/wallet/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone, amount })
      });
      return await res.json();
    } catch (err) {
      console.error('API Error (updateWallet):', err);
      return { success: false, balance: 0 };
    }
  },

  // 6. Fast2SMS Passenger OTP Authentication
  sendOtp: async (phone) => {
    try {
      const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
      const res = await fetch(`${API_BASE}/api/auth/send-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: cleanPhone })
      });
      return await res.json();
    } catch (err) {
      console.error('API Error (sendOtp):', err);
      return { success: false, message: err.message };
    }
  },

  verifyOtp: async (payload) => {
    try {
      const cleanPhone = String(payload.phone).replace(/\D/g, '').slice(-10);
      const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, phone: cleanPhone })
      });
      return await res.json();
    } catch (err) {
      console.error('API Error (verifyOtp):', err);
      return { success: false, message: err.message };
    }
  }
};