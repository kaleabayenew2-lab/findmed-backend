const express = require('express');
const router = express.Router();
const bookingsController = require('../controllers/bookingsController');

// GET /api/bookings - list bookings for user
router.get('/', bookingsController.getBookings);

// POST /api/bookings - create booking
router.post('/', bookingsController.createBooking);

// PUT /api/bookings/:id - update booking
router.put('/:id', bookingsController.updateBooking);

// DELETE /api/bookings/:id - cancel booking
router.delete('/:id', bookingsController.cancelBooking);

// Admin routes
// GET /api/bookings/admin - list all bookings
router.get('/admin', bookingsController.getAllBookings);

module.exports = router;