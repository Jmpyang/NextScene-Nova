const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../middleware/auth');
const { isPremium } = require('../middleware/premium');
const userController = require('../controllers/userController');

// Premium content page (requires premium subscription)
router.get('/', isLoggedIn, isPremium, userController.getPremiumContent);

// Handle premium upgrade (generic endpoint used after successful payment)
router.post('/upgrade', isLoggedIn, userController.postPremiumUpgrade);

// --- Payment provider specific endpoints (PayPal / M-Pesa) ---
// NOTE: these are minimal scaffolds; you must configure credentials in .env

// PayPal webhook / capture handler (for example, after client-side approval)
router.post('/paypal/capture', isLoggedIn, async (req, res) => {
  // In production, verify the PayPal order ID with PayPal REST API using your credentials
  // and only then call postPremiumUpgrade logic.
  try {
    const { plan } = req.body;
    // TODO: verify PayPal order here
    req.body.plan = plan || 'monthly';
    return userController.postPremiumUpgrade(req, res);
  } catch (e) {
    console.error('PayPal capture error:', e);
    res.status(500).json({ success: false, message: 'PayPal capture failed' });
  }
});

// M-Pesa (Safaricom Daraja) callback stub
router.post('/mpesa/callback', async (req, res) => {
  // Implement validation of M-Pesa STK push or C2B confirmation here.
  // Once validated, locate the user and set their premium status.
  // For now we simply acknowledge receipt.
  res.json({ ResultCode: 0, ResultDesc: 'Received' });
});

module.exports = router;
