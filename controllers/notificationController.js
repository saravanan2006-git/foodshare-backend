const { db } = require('../config/firebase');

/**
 * Get my notifications
 */
const getMyNotifications = async (req, res) => {
  try {
    const snap = await db.collection('notifications')
      .where('user_id', '==', req.user.user_id)
      .get();
      
    const notifications = snap.docs.map(doc => ({
      notification_id: doc.id,
      ...doc.data()
    })).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json({ success: true, notifications });
  } catch (err) {
    console.error('Notifications error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * Mark notification as read
 */
const markAsRead = async (req, res) => {
  try {
    const notifRef = db.collection('notifications').doc(req.params.id);
    const doc = await notifRef.get();
    
    if (!doc.exists || doc.data().user_id !== req.user.user_id) {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }

    await notifRef.update({ status: 'read' });
    res.json({ success: true, message: 'Notification read.' });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
};

module.exports = { getMyNotifications, markAsRead };
