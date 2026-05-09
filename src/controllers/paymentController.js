const paymentService = require('../config/payments');
const Payment = require('../models/Payment');
const UserService = require('../models/User');

// PayPal payment initiation
exports.initiatePayPalPayment = async (req, res) => {
  try {
    const { plan, amount } = req.body;
    
    if (!plan || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Plan and amount are required'
      });
    }

    const returnUrl = `${process.env.BASE_URL}/api/payments/paypal/success`;
    const cancelUrl = `${process.env.BASE_URL}/api/payments/paypal/cancel`;
    const description = `NextScene Nova ${plan} subscription`;

    const payment = await paymentService.createPayPalPayment(
      amount,
      description,
      returnUrl,
      cancelUrl
    );

    // Find the approval URL
    const approvalUrl = payment.links.find(link => link.rel === 'approval_url')?.href;

    if (!approvalUrl) {
      return res.status(500).json({
        success: false,
        message: 'Failed to generate PayPal approval URL'
      });
    }

    // Store payment intent in database
    await Payment.create({
      userId: req.user.id,
      plan,
      amount,
      currency: 'USD',
      paymentMethod: 'paypal',
      status: 'pending',
      paypalOrderId: payment.id
    });

    res.json({
      success: true,
      paymentId: payment.id,
      approvalUrl
    });
  } catch (error) {
    console.error('PayPal payment initiation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate PayPal payment'
    });
  }
};

// PayPal payment success callback
exports.payPalSuccess = async (req, res) => {
  try {
    const { paymentId, PayerID } = req.query;

    if (!paymentId || !PayerID) {
      return res.status(400).json({
        success: false,
        message: 'Missing payment parameters'
      });
    }

    const payment = await paymentService.executePayPalPayment(paymentId, PayerID);
    const validation = paymentService.validatePayPalResponse(payment);

    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: 'Payment validation failed'
      });
    }

    // Update payment record
    const paymentRecord = await Payment.findByPayPalOrderId(paymentId);
    if (paymentRecord) {
      await Payment.update(paymentRecord.id, {
        status: 'completed',
        paypalCaptureId: payment.transactions[0]?.related_resources?.[0]?.sale?.id,
        metadata: payment
      });

      // Update user premium status
      await UserService.updatePremium(paymentRecord.userId, paymentRecord.plan);
    }

    res.json({
      success: true,
      message: 'Payment completed successfully',
      payment: validation
    });
  } catch (error) {
    console.error('PayPal success callback error:', error);
    res.status(500).json({
      success: false,
      message: 'Payment processing failed'
    });
  }
};

// PayPal payment cancel callback
exports.payPalCancel = async (req, res) => {
  try {
    const { paymentId } = req.query;

    if (paymentId) {
      // Update payment record to cancelled
      const paymentRecord = await Payment.findByPayPalOrderId(paymentId);
      if (paymentRecord) {
        await Payment.update(paymentRecord.id, {
          status: 'cancelled'
        });
      }
    }

    res.json({
      success: false,
      message: 'Payment was cancelled'
    });
  } catch (error) {
    console.error('PayPal cancel callback error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process payment cancellation'
    });
  }
};

// M-Pesa STK Push initiation
exports.initiateMpesaPayment = async (req, res) => {
  try {
    const { phoneNumber, amount, plan } = req.body;

    if (!phoneNumber || !amount || !plan) {
      return res.status(400).json({
        success: false,
        message: 'Phone number, amount, and plan are required'
      });
    }

    // Format phone number (remove leading +254 if present)
    const formattedPhone = phoneNumber.replace(/^\+254/, '').replace(/^254/, '');

    const accountReference = `NextScene-${plan}-${req.user.id}`;
    const transactionDesc = `NextScene Nova ${plan} subscription`;

    const response = await paymentService.initiateMpesaSTKPush(
      formattedPhone,
      amount,
      accountReference,
      transactionDesc
    );

    // Store payment intent in database
    await Payment.create({
      userId: req.user.id,
      plan,
      amount,
      currency: 'KES',
      paymentMethod: 'mpesa',
      status: 'pending',
      mpesaCheckoutRequestID: response.CheckoutRequestID,
      metadata: response
    });

    res.json({
      success: true,
      checkoutRequestId: response.CheckoutRequestID,
      merchantRequestId: response.MerchantRequestID,
      message: 'M-Pesa STK Push sent successfully'
    });
  } catch (error) {
    console.error('M-Pesa payment initiation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to initiate M-Pesa payment'
    });
  }
};

// M-Pesa callback webhook
exports.mpesaCallback = async (req, res) => {
  try {
    const { Body } = req.body;
    const { stkCallback } = Body;

    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback;

    // Find payment record
    const paymentRecord = await Payment.findByMpesaCheckoutId(CheckoutRequestID);
    if (!paymentRecord) {
      console.log('Payment record not found for CheckoutRequestID:', CheckoutRequestID);
      return res.status(404).json({ success: false, message: 'Payment record not found' });
    }

    const validation = paymentService.validateMpesaResponse(stkCallback);

    // Update payment record
    await Payment.update(paymentRecord.id, {
      status: validation.isValid ? 'completed' : 'failed',
      metadata: req.body
    });

    if (validation.isValid) {
      // Update user premium status
      await UserService.updatePremium(paymentRecord.userId, paymentRecord.plan);
      console.log('M-Pesa payment completed for user:', paymentRecord.userId);
    } else {
      console.log('M-Pesa payment failed:', ResultDesc);
    }

    res.json({
      success: true,
      message: 'Callback processed successfully'
    });
  } catch (error) {
    console.error('M-Pesa callback error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process M-Pesa callback'
    });
  }
};

// Verify payment status
exports.verifyPayment = async (req, res) => {
  try {
    const { paymentId, provider } = req.query;

    if (!paymentId || !provider) {
      return res.status(400).json({
        success: false,
        message: 'Payment ID and provider are required'
      });
    }

    let paymentRecord;
    if (provider === 'paypal') {
      paymentRecord = await Payment.findByPayPalOrderId(paymentId);
    } else if (provider === 'mpesa') {
      paymentRecord = await Payment.findByMpesaCheckoutId(paymentId);
    }

    if (!paymentRecord) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found'
      });
    }

    res.json({
      success: true,
      payment: {
        id: paymentRecord.id,
        status: paymentRecord.status,
        plan: paymentRecord.plan,
        amount: paymentRecord.amount,
        currency: paymentRecord.currency,
        createdAt: paymentRecord.createdAt
      }
    });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify payment'
    });
  }
};

// Get user payment history
exports.getPaymentHistory = async (req, res) => {
  try {
    const payments = await Payment.findByUserId(req.user.id);

    res.json({
      success: true,
      payments
    });
  } catch (error) {
    console.error('Payment history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment history'
    });
  }
};
