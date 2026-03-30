const { db } = require('../config/firebase');
const { sendAcceptanceEmail } = require('../services/emailService');
const { sendAcceptanceSMS } = require('../services/smsService');

/**
 * NGO requests a food listing
 */
const requestFood = async (req, res) => {
  try {
    const foodId = req.params.id;
    const ngoId = req.user.user_id;
    
    // Check if food exists and is available
    const foodRef = db.collection('food_listings').doc(foodId);
    const foodDoc = await foodRef.get();
    
    if (!foodDoc.exists) return res.status(404).json({ success: false, message: 'Food listing not found.' });
    if (foodDoc.data().status !== 'available') return res.status(400).json({ success: false, message: 'Food is no longer available.' });

    // Check if NGO already requested
    const existingReqSnap = await db.collection('requests')
      .where('food_id', '==', foodId)
      .where('ngo_id', '==', ngoId)
      .get();
      
    if (!existingReqSnap.empty) {
      return res.status(400).json({ success: false, message: 'You have already requested this food.' });
    }

    const { notes, pickup_scheduled } = req.body;

    // Create request
    const docRef = await db.collection('requests').add({
      food_id: foodId,
      ngo_id: ngoId,
      status: 'pending',
      notes: notes || null,
      pickup_scheduled: pickup_scheduled || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    // Notify donor via DB notification
    await db.collection('notifications').add({
      user_id: foodDoc.data().donor_id,
      title: 'New Food Request!',
      message: 'An NGO has requested to collect your food.',
      type: 'in_app',
      status: 'pending',
      reference_id: typeof docRef.id === 'string' ? docRef.id : null,
      reference_type: 'request',
      created_at: new Date().toISOString()
    });

    res.status(201).json({ success: true, message: 'Request sent successfully.', request_id: docRef.id });
  } catch (err) {
    console.error('Request food error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * Donor accepts a request from an NGO
 */
const acceptRequest = async (req, res) => {
  try {
    const requestId = req.params.id;
    const donorId = req.user.user_id;

    // Get Request
    const reqRef = db.collection('requests').doc(requestId);
    const reqDoc = await reqRef.get();
    
    if (!reqDoc.exists) return res.status(404).json({ success: false, message: 'Request not found.' });
    
    const requestData = reqDoc.data();
    const foodId = requestData.food_id;

    // Verify donor owns this food listing
    const foodRef = db.collection('food_listings').doc(foodId);
    const foodDoc = await foodRef.get();
    
    if (!foodDoc.exists || foodDoc.data().donor_id !== donorId) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    // Update Request to accepted
    await reqRef.update({ status: 'accepted', updated_at: new Date().toISOString() });
    
    // Update Food Listing to accepted
    await foodRef.update({ status: 'accepted', updated_at: new Date().toISOString() });

    // Reject all other pending requests for this food
    const otherReqSnap = await db.collection('requests')
      .where('food_id', '==', foodId)
      .where('status', '==', 'pending')
      .get();
      
    // Needs a batch write for atomic update
    const batch = db.batch();
    otherReqSnap.docs.forEach(doc => {
      if (doc.id !== requestId) {
        batch.update(doc.ref, { status: 'rejected', updated_at: new Date().toISOString() });
      }
    });
    await batch.commit();

    // Notify NGO
    const ngoDoc = await db.collection('users').doc(requestData.ngo_id).get();
    const donorDoc = await db.collection('users').doc(donorId).get();
    const foodData = foodDoc.data();

    if (ngoDoc.exists) {
      const ngo = ngoDoc.data();
      const donor = donorDoc.data();

      // DB Notification
      await db.collection('notifications').add({
        user_id: ngoDoc.id,
        title: 'Request Accepted!',
        message: `${donor.organization || donor.name} accepted your request for ${foodData.food_type}.`,
        type: 'in_app',
        status: 'pending',
        reference_id: requestId,
        reference_type: 'request',
        created_at: new Date().toISOString()
      });

      // Email
      sendAcceptanceEmail({
        to: ngo.email,
        donorName: donor.organization || donor.name,
        ngoName: ngo.organization || ngo.name,
        foodType: foodData.food_type,
        pickupTime: requestData.pickup_scheduled || 'ASAP',
      }).catch(err => console.error('Email error:', err));

      // SMS
      if (donor.phone_number) {
        sendAcceptanceSMS({
          to: donor.phone_number,
          ngoName: ngo.organization || ngo.name,
          foodType: foodData.food_type,
        }).catch(err => console.error('SMS error:', err));
      }

      // Socket
      const io = req.app.get('io');
      if (io) {
        io.to(`user_${ngoDoc.id}`).emit('request_accepted', {
          request_id: requestId,
          food_type: foodData.food_type,
          donor_name: donor.organization || donor.name
        });
      }
    }

    res.json({ success: true, message: 'Request accepted successfully.' });
  } catch (err) {
    console.error('Accept request error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * Get incoming requests for donor's food listings
 */
const getDonorRequests = async (req, res) => {
  try {
    const donorId = req.user.user_id;

    // Fast but requires 2 queries in Firestore natively
    // 1. Get all food_listings by donor
    const foodsSnap = await db.collection('food_listings').where('donor_id', '==', donorId).get();
    if (foodsSnap.empty) return res.json({ success: true, requests: [] });

    // Extract raw food IDs
    const foodIds = foodsSnap.docs.map(doc => doc.id);
    const foodMap = {};
    foodsSnap.forEach(doc => foodMap[doc.id] = doc.data());

    // 2. Get requests with those food IDs (note: Firestore 'in' query has a limit of 10)
    // For a real app with many foods, we'd query requests first if we had compound indices 
    // or fetch by chunks. Here we handle it via chunking.
    const requests = [];
    
    // Chunking to respect the 10-item limit for 'in' operator
    for (let i = 0; i < foodIds.length; i += 10) {
      const chunk = foodIds.slice(i, i + 10);
      const reqSnap = await db.collection('requests').where('food_id', 'in', chunk).get();
      
      for (const reqDoc of reqSnap.docs) {
        const reqData = reqDoc.data();
        
        // Fetch NGO details
        const ngoSnap = await db.collection('users').doc(reqData.ngo_id).get();
        const ngo = ngoSnap.exists ? ngoSnap.data() : { name: 'Unknown' };

        requests.push({
          request_id: reqDoc.id,
          ...reqData,
          food_type: foodMap[reqData.food_id].food_type,
          ngo_name: ngo.name,
          ngo_org: ngo.organization
        });
      }
    }

    // Sort by Date descending (manual sort due to chunking)
    requests.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({ success: true, requests });
  } catch (err) {
    console.error('Get donor requests error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * Get requests made by the NGO
 */
const getNgoRequests = async (req, res) => {
  try {
    const ngoId = req.user.user_id;
    
    const reqSnap = await db.collection('requests')
      .where('ngo_id', '==', ngoId)
      .get();
      
    const requests = [];
    for (const reqDoc of reqSnap.docs) {
      const reqData = reqDoc.data();
      
      const foodSnap = await db.collection('food_listings').doc(reqData.food_id).get();
      const foodData = foodSnap.exists ? foodSnap.data() : { food_type: 'Unknown', donor_id: null };
      
      let donorName = 'Unknown';
      if (foodData.donor_id) {
        const donorSnap = await db.collection('users').doc(foodData.donor_id).get();
        donorName = donorSnap.exists ? donorSnap.data().organization || donorSnap.data().name : 'Unknown';
      }

      requests.push({
        request_id: reqDoc.id,
        ...reqData,
        food_type: foodData.food_type,
        pickup_address: foodData.pickup_address,
        donor_name: donorName,
      });
    }

    res.json({ success: true, requests });
  } catch (err) {
    console.error('Get NGO requests error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { requestFood, acceptRequest, getDonorRequests, getNgoRequests };
