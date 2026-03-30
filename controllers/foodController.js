const { db } = require('../config/firebase');
const { sendFoodAvailableEmail } = require('../services/emailService');
const { sendFoodAvailableSMS } = require('../services/smsService');
const { haversineDistance, NOTIFY_RADIUS_KM } = require('../utils/distanceCalculator');

/**
 * Create a new food listing and notify nearby NGOs
 */
const createListing = async (req, res) => {
  const io = req.app.get('io');
  try {
    const { food_type, description, quantity, quantity_unit, expiry_time, pickup_address, latitude, longitude } = req.body;
    const donor_id = req.user.user_id;

    if (!food_type || !quantity || !expiry_time || !pickup_address || !latitude || !longitude) {
      return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    const newListing = {
      donor_id,
      food_type,
      description: description || null,
      quantity,
      quantity_unit: quantity_unit || 'servings',
      expiry_time,
      pickup_address,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      status: 'available',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Insert to Firestore
    const docRef = await db.collection('food_listings').add(newListing);
    const foodId = docRef.id;

    // Get donor details
    const donorDoc = await db.collection('users').doc(donor_id).get();
    const donor = donorDoc.data() || {};

    // Fetch all NGOs to find nearby ones
    const ngosSnapshot = await db.collection('users').where('role', '==', 'ngo').get();
    
    const nearbyNgos = [];
    const RADIUS_KM = NOTIFY_RADIUS_KM;

    ngosSnapshot.forEach(doc => {
      const ngo = doc.data();
      if (ngo.latitude && ngo.longitude) {
        const dist = haversineDistance(parseFloat(latitude), parseFloat(longitude), parseFloat(ngo.latitude), parseFloat(ngo.longitude));
        if (dist <= RADIUS_KM) {
          nearbyNgos.push({ id: doc.id, ...ngo });
        }
      }
    });

    // Send notifications
    for (const ngo of nearbyNgos) {
      // Save notification to Firestore
      await db.collection('notifications').add({
        user_id: ngo.id,
        title: 'New Food Available!',
        message: `${food_type} (${quantity} ${quantity_unit || 'servings'}) available at ${pickup_address}. Expires: ${expiry_time}`,
        type: 'in_app',
        status: 'pending',
        reference_id: foodId,
        reference_type: 'food_listing',
        created_at: new Date().toISOString()
      });

      // Send email
      sendFoodAvailableEmail({
        to: ngo.email,
        ngoName: ngo.name,
        foodType: food_type,
        quantity: `${quantity} ${quantity_unit || 'servings'}`,
        donorName: donor.organization || donor.name || 'A generous donor',
        location: pickup_address,
        expiryTime: expiry_time,
        foodId,
      }).catch(err => console.error('Email send error:', err.message));

      // Send SMS
      if (ngo.phone_number) {
        sendFoodAvailableSMS({
          to: ngo.phone_number,
          ngoName: ngo.name,
          foodType: food_type,
          quantity: `${quantity} ${quantity_unit || 'servings'}`,
          location: pickup_address,
          expiryTime: expiry_time,
        }).catch(err => console.error('SMS send error:', err.message));
      }

      // Socket emit
      if (io) {
        io.to(`user_${ngo.id}`).emit('new_food_listing', {
          food_id: foodId,
          food_type,
          quantity,
          quantity_unit,
          pickup_address,
          expiry_time,
          donor_name: donor.organization || donor.name,
        });
      }
    }

    // Public socket emit
    if (io) {
      io.emit('feed_update', { type: 'new_listing', food_id: foodId, food_type, pickup_address });
    }

    res.status(201).json({
      success: true,
      message: `Food listing created! Notified ${nearbyNgos.length} nearby NGOs.`,
      food_id: foodId,
      notified_ngos: nearbyNgos.length,
    });
  } catch (err) {
    console.error('Create listing error:', err);
    res.status(500).json({ success: false, message: 'Server error creating listing.' });
  }
};

/**
 * Get all available food listings (for NGOs)
 */
const getAllListings = async (req, res) => {
  try {
    const { status, lat, lon, radius = 50 } = req.query;
    
    let query = db.collection('food_listings');
    if (status) query = query.where('status', '==', status);

    const snapshot = await query.get();
    
    let listings = [];
    
    // We need to fetch donor info for each listing
    const userDocs = new Map();

    for (const doc of snapshot.docs) {
      const data = doc.data();
      let donor = userDocs.get(data.donor_id);
      
      if (!donor && data.donor_id) {
        const donorSnapshot = await db.collection('users').doc(data.donor_id).get();
        if (donorSnapshot.exists) {
          donor = donorSnapshot.data();
          userDocs.set(data.donor_id, donor);
        }
      }

      listings.push({
        food_id: doc.id,
        ...data,
        donor_name: donor ? donor.name : 'Unknown',
        donor_org: donor ? donor.organization : null,
        donor_email: donor ? donor.email : null
      });
    }

    // Filter by radius if requested
    if (lat && lon) {
      listings = listings.filter(l => {
        const dist = haversineDistance(parseFloat(lat), parseFloat(lon), parseFloat(l.latitude), parseFloat(l.longitude));
        if (dist <= parseFloat(radius)) {
          l.distance_km = Math.round(dist * 10) / 10;
          return true;
        }
        return false;
      });
    }

    // Sort by created_at descending in memory (avoids composite index requirement)
    listings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({ success: true, listings });
  } catch (err) {
    console.error('Get listings error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * Get listings for the logged-in donor
 */
const getMyListings = async (req, res) => {
  try {
    const snapshot = await db.collection('food_listings')
      .where('donor_id', '==', req.user.user_id)
      .get();
      
    const listings = [];
    
    for (const doc of snapshot.docs) {
      // Also get request count loosely for display
      const requestsSnap = await db.collection('requests').where('food_id', '==', doc.id).get();
      listings.push({
        food_id: doc.id,
        ...doc.data(),
        request_count: requestsSnap.size
      });
    }

    // Sort by created_at descending in memory
    listings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    res.json({ success: true, listings });
  } catch (err) {
    console.error('Get my listings error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * Get single food listing
 */
const getListing = async (req, res) => {
  try {
    const doc = await db.collection('food_listings').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ success: false, message: 'Listing not found.' });

    const data = doc.data();
    
    const donorDoc = await db.collection('users').doc(data.donor_id).get();
    const donor = donorDoc.exists ? donorDoc.data() : {};

    res.json({ 
      success: true, 
      listing: { 
        food_id: doc.id, 
        ...data,
        donor_name: donor.name,
        donor_org: donor.organization,
        donor_phone: donor.phone_number,
        donor_email: donor.email
      } 
    });
  } catch (err) {
    console.error('Get listing error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * Update listing status
 */
const updateListingStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['available', 'accepted', 'completed', 'expired'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }
    
    const listingRef = db.collection('food_listings').doc(req.params.id);
    const doc = await listingRef.get();
    
    if (!doc.exists || doc.data().donor_id !== req.user.user_id) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this listing.' });
    }

    await listingRef.update({ 
      status, 
      updated_at: new Date().toISOString() 
    });
    
    res.json({ success: true, message: 'Status updated.' });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { createListing, getAllListings, getMyListings, getListing, updateListingStatus };
