const express = require('express');
const router = express.Router();

const { authenticate, requireRole } = require('../middleware/auth');
const authCtrl = require('../controllers/authController');
const foodCtrl = require('../controllers/foodController');
const reqCtrl = require('../controllers/requestController');
const notifCtrl = require('../controllers/notificationController');

// --- Auth Routes ---
router.post('/auth/register', authCtrl.register);
router.post('/auth/login', authCtrl.login);
router.get('/auth/profile', authenticate, authCtrl.getProfile);

// --- Food Listing Routes ---
// Create listing (Donor only)
router.post('/food', authenticate, requireRole('donor'), foodCtrl.createListing);
// Get all listings (mainly NGO, or public feed)
router.get('/food', foodCtrl.getAllListings);
// Get donor's own listings
router.get('/food/me', authenticate, requireRole('donor'), foodCtrl.getMyListings);
// Get single listing
router.get('/food/:id', authenticate, foodCtrl.getListing);
// Update listing status
router.patch('/food/:id/status', authenticate, requireRole('donor'), foodCtrl.updateListingStatus);

// --- Request Routes ---
// NGO requests food
router.post('/requests/:id', authenticate, requireRole('ngo'), reqCtrl.requestFood);
// Donor accepts request
router.post('/requests/:id/accept', authenticate, requireRole('donor'), reqCtrl.acceptRequest);
// Get incoming requests for Donor
router.get('/requests/incoming', authenticate, requireRole('donor'), reqCtrl.getDonorRequests);
// Get outgoing requests for NGO
router.get('/requests/outgoing', authenticate, requireRole('ngo'), reqCtrl.getNgoRequests);

// --- Notification Routes ---
router.get('/notifications', authenticate, notifCtrl.getMyNotifications);
router.patch('/notifications/:id/read', authenticate, notifCtrl.markAsRead);

module.exports = router;
