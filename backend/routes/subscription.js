// ============================================================
// ROZGARX - routes/subscription.js
// Razorpay Payment + Subscription Management
// ============================================================
const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const pool = require('../db');
const { authenticate } = require('../middleware/auth');

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

const PLANS = {
  monthly: {
    name: 'Premium Monthly',
    amount: 4900,      // ₹49 in paise (₹49 × 100)
    duration_days: 30,
    currency: 'INR'
  },
  quarterly: {
    name: 'Premium Quarterly',
    amount: 11900,     // ₹119
    duration_days: 90,
    currency: 'INR'
  },
  yearly: {
    name: 'Premium Yearly',
    amount: 39900,     // ₹399
    duration_days: 365,
    currency: 'INR'
  }
};

// Get plans
router.get('/plans', (req, res) => {
  res.json(PLANS);
});

// Create Razorpay order
router.post('/create-order', authenticate, async (req, res) => {
  const { plan } = req.body;
  if (!PLANS[plan]) return res.status(400).json({ error: 'Invalid plan' });

  try {
    const planData = PLANS[plan];
    const order = await razorpay.orders.create({
      amount: planData.amount,
      currency: planData.currency,
      notes: {
        user_id: req.user.id,
        plan: plan
      }
    });
    res.json({
      order_id: order.id,
      amount: planData.amount,
      currency: planData.currency,
      key: process.env.RAZORPAY_KEY_ID,
      plan_name: planData.name
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create order: ' + err.message });
  }
});

// Verify payment and activate subscription
router.post('/verify-payment', authenticate, async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan } = req.body;

  // Signature verification
  const sign = razorpay_order_id + '|' + razorpay_payment_id;
  const expectedSign = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(sign)
    .digest('hex');

  if (expectedSign !== razorpay_signature) {
    return res.status(400).json({ error: 'Invalid payment signature' });
  }

  try {
    const planData = PLANS[plan];
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + planData.duration_days);

    // Save subscription
    await pool.query(
      `INSERT INTO subscriptions (user_id, plan, end_date, payment_id, razorpay_order_id, amount)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [req.user.id, plan, endDate, razorpay_payment_id, razorpay_order_id, planData.amount]
    );

    // Update user status
    await pool.query(
      `UPDATE users SET subscription_status='premium', subscription_end=$1 WHERE id=$2`,
      [endDate, req.user.id]
    );

    res.json({
      message: 'Subscription activated!',
      subscription_end: endDate,
      plan: plan
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get current subscription status
router.get('/status', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT subscription_status, subscription_end FROM users WHERE id=$1`,
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
