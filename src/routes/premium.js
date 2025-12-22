const express = require('express');
const router = express.Router();
const { isLoggedIn } = require('../middleware/auth');
const { isPremium } = require('../middleware/premium');
const userController = require('../controllers/userController');
const mpesaService = require('../services/mpesaService');
const paypalService = require('../services/paypalService');
const Payment = require('../models/Payment');
const User = require('../models/User');

// Premium content page (requires premium subscription)
router.get('/', isLoggedIn, isPremium, userController.getPremiumContent);

// Handle premium upgrade (generic endpoint used after successful payment)
router.post('/upgrade', isLoggedIn, userController.postPremiumUpgrade);

// --- Payment provider specific endpoints (PayPal / M-Pesa) ---

/**
 * Initiate PayPal payment
 */
router.post('/paypal/create-order', isLoggedIn, async (req, res) => {
  try {
    const { plan } = req.body; // 'monthly' or 'annual'
    
    if (!plan || !['monthly', 'annual'].includes(plan)) {
      return res.status(400).json({ success: false, message: 'Invalid plan' });
    }

    const amounts = {
      monthly: 9.99,
      annual: 99.99
    };
    const amount = amounts[plan];

    // Create payment record
    const payment = new Payment({
      user: req.user._id,
      plan,
      amount,
      currency: 'USD',
      paymentMethod: 'paypal',
      status: 'pending'
    });
    await payment.save();

    // Create PayPal order
    const result = await paypalService.createOrder(
      amount,
      'USD',
      `NextScene Nova Premium - ${plan === 'monthly' ? 'Monthly' : 'Annual'} Subscription`,
      payment._id.toString()
    );

    if (!result.success) {
      payment.status = 'failed';
      await payment.save();
      return res.status(500).json({ success: false, message: result.message });
    }

    // Update payment with PayPal order ID
    payment.paypalOrderId = result.orderId;
    await payment.save();

    res.json({
      success: true,
      orderId: result.orderId,
      approvalUrl: result.approvalUrl
    });
  } catch (error) {
    console.error('PayPal create order error:', error);
    res.status(500).json({ success: false, message: 'Failed to create PayPal order' });
  }
});

/**
 * Capture PayPal payment (after user approval)
 */
router.post('/paypal/capture', isLoggedIn, async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ success: false, message: 'Order ID required' });
    }

    // Find payment record
    const payment = await Payment.findOne({ paypalOrderId: orderId, user: req.user._id });
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    // Capture the order
    const captureResult = await paypalService.captureOrder(orderId);

    if (!captureResult.success) {
      payment.status = 'failed';
      await payment.save();
      return res.status(400).json({ success: false, message: captureResult.message || 'Payment capture failed' });
    }

    // Update payment record
    payment.status = 'completed';
    payment.paypalCaptureId = captureResult.captureId;
    payment.metadata = new Map([
      ['payerEmail', captureResult.payerEmail],
      ['payerName', captureResult.payerName]
    ]);
    await payment.save();

    // Upgrade user to premium
    req.body.plan = payment.plan;
    await userController.postPremiumUpgrade(req, res);
  } catch (error) {
    console.error('PayPal capture error:', error);
    res.status(500).json({ success: false, message: 'PayPal capture failed' });
  }
});

/**
 * PayPal success redirect handler
 */
router.get('/paypal/success', isLoggedIn, async (req, res) => {
  try {
    const { token } = req.query; // PayPal returns orderId as 'token' parameter
    
    if (!token) {
      return res.redirect('/premium?error=no_token');
    }

    // Capture the order
    const captureResult = await paypalService.captureOrder(token);

    if (!captureResult.success) {
      return res.redirect('/premium?error=payment_failed');
    }

    // Find and update payment
    const payment = await Payment.findOne({ paypalOrderId: token, user: req.user._id });
    if (payment && payment.status === 'pending') {
      payment.status = 'completed';
      payment.paypalCaptureId = captureResult.captureId;
      await payment.save();

      // Upgrade user
      const user = await User.findById(req.user._id);
      user.isPremium = true;
      const expiresAt = new Date();
      if (payment.plan === 'monthly') {
        expiresAt.setMonth(expiresAt.getMonth() + 1);
      } else {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      }
      user.premiumExpiresAt = expiresAt;
      await user.save();
    }

    res.redirect('/premium?success=true');
  } catch (error) {
    console.error('PayPal success handler error:', error);
    res.redirect('/premium?error=processing_failed');
  }
});

/**
 * PayPal webhook handler
 * Note: This route should be registered before express.json() middleware
 * For now, we'll parse the body manually if it's a Buffer
 */
router.post('/paypal/webhook', async (req, res) => {
  try {
    // Handle raw body (webhooks send raw JSON)
    let event;
    if (Buffer.isBuffer(req.body)) {
      event = JSON.parse(req.body.toString());
    } else if (typeof req.body === 'string') {
      event = JSON.parse(req.body);
    } else {
      event = req.body;
    }

    // Verify webhook signature
    const verification = await paypalService.verifyWebhook(req.headers, event);
    if (!verification.valid) {
      return res.status(400).send('Invalid webhook signature');
    }
    
    // Handle payment capture completed event
    if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const orderId = event.resource?.supplementary_data?.related_ids?.order_id;
      if (orderId) {
        const payment = await Payment.findOne({ paypalOrderId: orderId });
        if (payment && payment.status === 'pending') {
          payment.status = 'completed';
          payment.paypalCaptureId = event.resource.id;
          await payment.save();

          // Upgrade user
          const user = await User.findById(payment.user);
          if (user) {
            user.isPremium = true;
            const expiresAt = new Date();
            if (payment.plan === 'monthly') {
              expiresAt.setMonth(expiresAt.getMonth() + 1);
            } else {
              expiresAt.setFullYear(expiresAt.getFullYear() + 1);
            }
            user.premiumExpiresAt = expiresAt;
            await user.save();
          }
        }
      }
    }

    res.status(200).send('OK');
  } catch (error) {
    console.error('PayPal webhook error:', error);
    res.status(500).send('Webhook processing failed');
  }
});

/**
 * Initiate M-Pesa STK Push
 */
router.post('/mpesa/initiate', isLoggedIn, async (req, res) => {
  try {
    const { plan, phoneNumber } = req.body;

    if (!plan || !['monthly', 'annual'].includes(plan)) {
      return res.status(400).json({ success: false, message: 'Invalid plan' });
    }

    if (!phoneNumber) {
      return res.status(400).json({ success: false, message: 'Phone number required' });
    }

    const amounts = {
      monthly: 1000, // KES 1000 (approximately $9.99)
      annual: 10000  // KES 10000 (approximately $99.99)
    };
    const amount = amounts[plan];

    // Create payment record
    const payment = new Payment({
      user: req.user._id,
      plan,
      amount,
      currency: 'KES',
      paymentMethod: 'mpesa',
      status: 'pending',
      mpesaPhoneNumber: phoneNumber
    });
    await payment.save();

    // Initiate STK Push
    const result = await mpesaService.initiateSTKPush(
      phoneNumber,
      amount,
      `PREMIUM-${payment._id}`,
      `NextScene Nova Premium - ${plan === 'monthly' ? 'Monthly' : 'Annual'} Subscription`
    );

    if (!result.success) {
      payment.status = 'failed';
      await payment.save();
      return res.status(500).json({ success: false, message: result.message });
    }

    // Update payment with checkout request ID
    payment.mpesaCheckoutRequestID = result.checkoutRequestID;
    await payment.save();

    res.json({
      success: true,
      checkoutRequestID: result.checkoutRequestID,
      customerMessage: result.customerMessage
    });
  } catch (error) {
    console.error('M-Pesa initiate error:', error);
    res.status(500).json({ success: false, message: 'Failed to initiate M-Pesa payment' });
  }
});

/**
 * Query M-Pesa payment status
 */
router.get('/mpesa/status/:checkoutRequestID', isLoggedIn, async (req, res) => {
  try {
    const { checkoutRequestID } = req.params;

    const payment = await Payment.findOne({ 
      mpesaCheckoutRequestID: checkoutRequestID, 
      user: req.user._id 
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment not found' });
    }

    // Query M-Pesa for status
    const result = await mpesaService.querySTKStatus(checkoutRequestID);

    if (result.success && result.resultCode === 0) {
      // Payment successful
      if (payment.status === 'pending') {
        payment.status = 'completed';
        await payment.save();

        // Upgrade user
        req.body.plan = payment.plan;
        await userController.postPremiumUpgrade(req, res);
      }
    }

    res.json({
      success: result.success,
      status: payment.status,
      resultCode: result.resultCode,
      resultDesc: result.resultDesc
    });
  } catch (error) {
    console.error('M-Pesa status query error:', error);
    res.status(500).json({ success: false, message: 'Failed to query payment status' });
  }
});

/**
 * M-Pesa callback handler
 * Note: M-Pesa sends JSON in the request body
 */
router.post('/mpesa/callback', async (req, res) => {
  try {
    // Handle raw body if needed
    let callbackData;
    if (Buffer.isBuffer(req.body)) {
      callbackData = JSON.parse(req.body.toString());
    } else if (typeof req.body === 'string') {
      callbackData = JSON.parse(req.body);
    } else {
      callbackData = req.body;
    }
    const verification = mpesaService.verifyCallback(callbackData);

    if (!verification.valid) {
      return res.status(400).json({ ResultCode: 1, ResultDesc: 'Invalid callback' });
    }

    if (verification.success) {
      // Extract reference from AccountReference (format: PREMIUM-{paymentId})
      const accountReference = callbackData.Body?.stkCallback?.CallbackMetadata?.Item?.find(
        item => item.Name === 'AccountReference'
      )?.Value;

      if (accountReference && accountReference.startsWith('PREMIUM-')) {
        const paymentId = accountReference.split('-')[1];
        const payment = await Payment.findById(paymentId);

        if (payment && payment.status === 'pending') {
          payment.status = 'completed';
          payment.mpesaReceiptNumber = verification.mpesaReceiptNumber;
          payment.mpesaPhoneNumber = verification.phoneNumber;
          await payment.save();

          // Upgrade user to premium
          const user = await User.findById(payment.user);
          if (user) {
            user.isPremium = true;
            const expiresAt = new Date();
            if (payment.plan === 'monthly') {
              expiresAt.setMonth(expiresAt.getMonth() + 1);
            } else {
              expiresAt.setFullYear(expiresAt.getFullYear() + 1);
            }
            user.premiumExpiresAt = expiresAt;
            await user.save();
          }
        }
      }
    }

    // Always acknowledge receipt
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    console.error('M-Pesa callback error:', error);
    res.json({ ResultCode: 1, ResultDesc: 'Error processing callback' });
  }
});

module.exports = router;
