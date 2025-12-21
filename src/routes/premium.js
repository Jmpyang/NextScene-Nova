const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../middleware/auth');
const { isPremium } = require('../middleware/premium');
const userController = require('../controllers/userController');

// Premium content page (requires premium subscription)
router.get('/', isLoggedIn, isPremium, userController.getPremiumContent);

// Premium upgrade API
// router.get('/upgrade', isLoggedIn, userController.getPremiumUpgrade); // Removed in favor of client logic

// Handle premium upgrade
router.post('/upgrade', isLoggedIn, userController.postPremiumUpgrade);

module.exports = router;
