const Booking = require('../models/booking');
const User = require('../models/user');
const Facility = require('../models/facility');

// GET /api/bookings - get user's bookings
exports.getBookings = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null; // assuming auth middleware sets req.user
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    const bookings = await Booking.find({ user: userId }).populate('facility').sort({ date: 1 });
    res.json({ bookings });
  } catch (err) {
    console.error('getBookings error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/bookings - create booking
exports.createBooking = async (req, res) => {
  try {
    const { facilityId, date, time, notes } = req.body;
    const userId = req.user ? req.user.id : null;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });
    if (!facilityId || !date || !time) return res.status(400).json({ message: 'Missing required fields' });

    const booking = new Booking({
      facility: facilityId,
      user: userId,
      date: new Date(date),
      time,
      notes
    });
    await booking.save();
    await booking.populate('facility');
    res.status(201).json({ booking });
  } catch (err) {
    console.error('createBooking error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/bookings/:id - update booking
exports.updateBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const userId = req.user ? req.user.id : null;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const booking = await Booking.findOne({ _id: id, user: userId });
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    Object.assign(booking, updates);
    booking.updatedAt = new Date();
    await booking.save();
    await booking.populate('facility');
    res.json({ booking });
  } catch (err) {
    console.error('updateBooking error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/bookings/:id - cancel booking
exports.cancelBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user ? req.user.id : null;
    if (!userId) return res.status(401).json({ message: 'Unauthorized' });

    const booking = await Booking.findOneAndUpdate(
      { _id: id, user: userId },
      { status: 'cancelled', updatedAt: new Date() },
      { new: true }
    ).populate('facility');
    if (!booking) return res.status(404).json({ message: 'Booking not found' });
    res.json({ booking });
  } catch (err) {
    console.error('cancelBooking error', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// Admin: GET /api/bookings/admin - get all bookings
exports.getAllBookings = async (req, res) => {
  try {
    const bookings = await Booking.find().populate('facility').populate('user', 'fullName email').sort({ date: 1 });
    res.json({ bookings });
  } catch (err) {
    console.error('getAllBookings error', err);
    res.status(500).json({ message: 'Server error' });
  }
};