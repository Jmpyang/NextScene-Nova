const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../middleware/auth');
const CoinService = require('../services/coinService');
const MonetizationService = require('../services/monetizationService');
const User = require('../models/User');
const upload = require('../middleware/upload');

/**
 * COIN MANAGEMENT ROUTES
 */

// Get user's coin balance
router.get('/coins/balance', isLoggedIn, async (req, res) => {
  try {
    const coins = await CoinService.getBalance(req.user._id);
    res.json({ coins });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get coin transaction history
router.get('/coins/history', isLoggedIn, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const skip = parseInt(req.query.skip) || 0;

    const { transactions, total } = await CoinService.getTransactionHistory(
      req.user._id,
      limit,
      skip
    );

    res.json({ transactions, total, limit, skip });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get coin earnings summary
router.get('/coins/summary', isLoggedIn, async (req, res) => {
  try {
    const months = parseInt(req.query.months) || 3;
    const summary = await CoinService.getEarningsSummary(req.user._id, months);
    res.json({ summary, period: `${months} months` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Convert coins to cash (view conversion rate)
router.get('/coins/conversion', isLoggedIn, async (req, res) => {
  try {
    const coins = parseInt(req.query.coins) || 100;
    const kes = CoinService.convertCoinsToKES(coins);
    res.json({
      coins,
      currency: 'KES',
      amount: kes.toFixed(2),
      rate: `1 coin = KSh ${process.env.COIN_VALUE_KES || 0.1}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * MONETIZATION ROUTES
 */

// Check monetization eligibility
router.get('/monetization/eligibility', isLoggedIn, async (req, res) => {
  try {
    const eligibility = await CoinService.checkMonetizationEligibility(req.user._id);
    res.json(eligibility);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get monetization status
router.get('/monetization/status', isLoggedIn, async (req, res) => {
  try {
    const status = await MonetizationService.getMonetizationStatus(req.user._id);
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Submit monetization application
router.post('/monetization/apply', isLoggedIn, upload.single('document'), async (req, res) => {
  try {
    // Check eligibility first
    const eligibility = await CoinService.checkMonetizationEligibility(req.user._id);
    if (!eligibility.eligible) {
      return res.status(400).json({
        error: 'You do not meet the monetization requirements',
        requirements: eligibility
      });
    }

    const { idType } = req.body;
    if (!idType || !req.file) {
      return res.status(400).json({ error: 'ID type and document are required' });
    }

    // Upload document
    const documentUrl = req.file.path; // Adjust based on your upload setup

    const documents = [{
      idType,
      documentUrl
    }];

    const application = await MonetizationService.submitApplication(
      req.user._id,
      documents
    );

    res.json(application);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Renew monetization (monthly)
router.post('/monetization/renew', isLoggedIn, async (req, res) => {
  try {
    const result = await CoinService.verifyMonetizationRenewal(req.user._id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Withdraw coins (convert to cash)
router.post('/monetization/withdraw', isLoggedIn, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user.monetizationStatus !== 'APPROVED') {
      return res.status(400).json({ error: 'You are not approved for monetization' });
    }

    const { coinsToWithdraw } = req.body;
    const coins = parseInt(coinsToWithdraw);

    if (coins < 100) {
      return res.status(400).json({ error: 'Minimum withdrawal is 100 coins' });
    }

    if (user.coins < coins) {
      return res.status(400).json({ error: 'Insufficient coins' });
    }

    // Deduct coins
    await CoinService.deductCoins(
      req.user._id,
      coins,
      'Withdrawn to wallet'
    );

    const kshAmount = CoinService.convertCoinsToKES(coins);

    res.json({
      success: true,
      coinsWithdrawn: coins,
      amountReceived: kshAmount,
      currency: 'KES',
      message: 'Withdrawal initiated. Funds will be transferred within 24 hours.'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * ADMIN MONETIZATION ROUTES
 */

// Get pending monetization applications (admin only)
router.get('/admin/monetization/pending', isLoggedIn, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const limit = parseInt(req.query.limit) || 20;
    const skip = parseInt(req.query.skip) || 0;

    const { applications, total } = await MonetizationService.getPendingApplications(
      limit,
      skip
    );

    res.json({ applications, total, limit, skip });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Approve monetization application (admin only)
router.post('/admin/monetization/approve/:applicationId', isLoggedIn, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { notes } = req.body;
    const result = await MonetizationService.approveApplication(
      req.params.applicationId,
      req.user._id,
      notes
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reject monetization application (admin only)
router.post('/admin/monetization/reject/:applicationId', isLoggedIn, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { rejectionReason, notes } = req.body;
    if (!rejectionReason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    const result = await MonetizationService.rejectApplication(
      req.params.applicationId,
      req.user._id,
      rejectionReason,
      notes
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ban user from monetization (admin only)
router.post('/admin/monetization/ban/:userId', isLoggedIn, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ error: 'Ban reason is required' });
    }

    const result = await MonetizationService.banUserFromMonetization(
      req.params.userId,
      reason
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
