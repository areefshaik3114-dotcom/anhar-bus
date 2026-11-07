const API_BASE_URL = 'https://anhar-bus.onrender.com/api';

export const api = {
  // Fetch all bookings from MongoDB
  async getBookings() {
    try {
      const res = await fetch(`${API_BASE_URL}/bookings`);
      const data = await res.json();
      return data.success ? data.bookings : [];
    } catch (err) {
      console.error('Failed to fetch bookings:', err);
      return [];
    }
  },

  // Save a new booking to MongoDB
  async createBooking(bookingData) {
    try {
      const res = await fetch(`${API_BASE_URL}/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookingData),
      });
      return await res.json();
    } catch (err) {
      console.error('Failed to create booking:', err);
      return { success: false, error: err.message };
    }
  },

  // Fetch all active resale tickets from MongoDB
  async getResaleListings() {
    try {
      const res = await fetch(`${API_BASE_URL}/resale`);
      const data = await res.json();
      return data.success ? data.listings : [];
    } catch (err) {
      console.error('Failed to fetch resale listings:', err);
      return [];
    }
  },

  // Publish seats to resale
  async publishResale(listings, updatedBookings) {
    try {
      const res = await fetch(`${API_BASE_URL}/resale`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listings, updatedBookings }),
      });
      return await res.json();
    } catch (err) {
      console.error('Failed to publish resale tickets:', err);
      return { success: false, error: err.message };
    }
  },

  // Buy a resale ticket
  async buyResale(resaleId, buyerBooking) {
    try {
      const res = await fetch(`${API_BASE_URL}/resale/buy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resaleId, buyerBooking }),
      });
      return await res.json();
    } catch (err) {
      console.error('Failed to buy resale ticket:', err);
      return { success: false, error: err.message };
    }
  }
};