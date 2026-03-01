// ============================================================
// ROZGARX - routes/notifications.js
// Push Notifications via FCM
// ============================================================
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticate } = require('../middleware/auth');
const admin = require('firebase-admin');

// Initialize Firebase Admin (for FCM only - free)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

// ─── HELPER: Send FCM push ────────────────────────────────────
const sendFCM = async (token, title, body, data = {}) => {
  try {
    await admin.messaging().send({
      token,
      notification: { title, body },
      data,
      android: {
        priority: 'high',
        notification: {
          channelId: 'rozgarx_jobs',
          sound: 'default',
          icon: 'ic_notification',
          color: '#1A3C6E'
        }
      }
    });
  } catch (err) {
    console.error('FCM Error:', err.message);
  }
};

// ─── HELPER: Broadcast to all/filtered users ─────────────────
const broadcastNotification = async (title, body, filter = {}) => {
  let query = `SELECT id, fcm_token FROM users WHERE fcm_token IS NOT NULL AND is_blocked=false`;
  const params = [];

  if (filter.subscription === 'premium') {
    query += ` AND subscription_status='premium'`;
  }
  if (filter.job_preference) {
    query += ` AND (job_preference=$${params.length + 1} OR job_preference='both')`;
    params.push(filter.job_preference);
  }

  const users = await pool.query(query, params);

  // Store notifications in DB
  for (const user of users.rows) {
    await pool.query(
      `INSERT INTO notifications (user_id, title, body, type) VALUES ($1,$2,$3,$4)`,
      [user.id, title, body, filter.type || 'general']
    );
    if (user.fcm_token) {
      sendFCM(user.fcm_token, title, body);
    }
  }
  return users.rows.length;
};

// Get user notifications
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM notifications WHERE user_id=$1
       ORDER BY sent_at DESC LIMIT 50`,
      [req.user.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark all as read
router.put('/read-all', authenticate, async (req, res) => {
  await pool.query('UPDATE notifications SET is_read=true WHERE user_id=$1', [req.user.id]);
  res.json({ message: 'All marked as read' });
});

// Mark one as read
router.put('/:id/read', authenticate, async (req, res) => {
  await pool.query(
    'UPDATE notifications SET is_read=true WHERE id=$1 AND user_id=$2',
    [req.params.id, req.user.id]
  );
  res.json({ message: 'Marked as read' });
});

// Update notification preferences
router.put('/preferences', authenticate, async (req, res) => {
  const { job_preference, notification_types } = req.body;
  await pool.query(
    `UPDATE users SET job_preference=$1 WHERE id=$2`,
    [job_preference, req.user.id]
  );
  res.json({ message: 'Preferences updated' });
});

// Unread count
router.get('/unread-count', authenticate, async (req, res) => {
  const result = await pool.query(
    'SELECT COUNT(*) FROM notifications WHERE user_id=$1 AND is_read=false',
    [req.user.id]
  );
  res.json({ count: parseInt(result.rows[0].count) });
});

module.exports = { router, broadcastNotification, sendFCM };
