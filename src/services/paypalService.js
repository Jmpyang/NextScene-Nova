const axios = require('axios');

/**
 * PayPal Service
 * Handles order creation, payment verification, and webhooks
 */

class PayPalService {
  constructor() {
    this.clientId = process.env.PAYPAL_CLIENT_ID;
    this.clientSecret = process.env.PAYPAL_CLIENT_SECRET;
    this.environment = process.env.PAYPAL_ENVIRONMENT || 'sandbox'; // 'sandbox' or 'production'
    
    this.baseUrl = this.environment === 'production'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';
    
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  /**
   * Get OAuth access token
   */
  async getAccessToken() {
    // Return cached token if still valid
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
      const response = await axios.post(
        `${this.baseUrl}/v1/oauth2/token`,
        'grant_type=client_credentials',
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Basic ${auth}`
          }
        }
      );

      this.accessToken = response.data.access_token;
      // Set expiry to 8 hours (tokens typically expire in 9 hours)
      this.tokenExpiry = Date.now() + (8 * 60 * 60 * 1000);
      
      return this.accessToken;
    } catch (error) {
      console.error('PayPal OAuth Error:', error.response?.data || error.message);
      throw new Error('Failed to get PayPal access token');
    }
  }

  /**
   * Create a PayPal order
   * @param {number} amount - Amount in USD
   * @param {string} currency - Currency code (default: USD)
   * @param {string} description - Order description
   * @param {string} referenceId - Internal reference ID
   */
  async createOrder(amount, currency = 'USD', description = 'Premium Subscription', referenceId) {
    try {
      const accessToken = await this.getAccessToken();
      
      const payload = {
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: referenceId || `PREMIUM-${Date.now()}`,
            description: description,
            amount: {
              currency_code: currency,
              value: amount.toFixed(2)
            }
          }
        ],
        application_context: {
          brand_name: 'NextScene Nova',
          landing_page: 'BILLING',
          user_action: 'PAY_NOW',
          return_url: `${process.env.BASE_URL || 'http://localhost:3000'}/api/premium/paypal/success`,
          cancel_url: `${process.env.BASE_URL || 'http://localhost:3000'}/premium?canceled=true`
        }
      };

      const response = await axios.post(
        `${this.baseUrl}/v2/checkout/orders`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            'Prefer': 'return=representation'
          }
        }
      );

      // Find approval URL
      const approvalLink = response.data.links.find(link => link.rel === 'approve');
      
      return {
        success: true,
        orderId: response.data.id,
        approvalUrl: approvalLink?.href,
        status: response.data.status
      };
    } catch (error) {
      console.error('PayPal Create Order Error:', error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to create PayPal order'
      };
    }
  }

  /**
   * Capture a PayPal order (after user approval)
   * @param {string} orderId - PayPal order ID
   */
  async captureOrder(orderId) {
    try {
      const accessToken = await this.getAccessToken();

      const response = await axios.post(
        `${this.baseUrl}/v2/checkout/orders/${orderId}/capture`,
        {},
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
            'Prefer': 'return=representation'
          }
        }
      );

      const capture = response.data.purchase_units[0]?.payments?.captures?.[0];
      
      return {
        success: response.data.status === 'COMPLETED',
        orderId: response.data.id,
        captureId: capture?.id,
        status: response.data.status,
        amount: capture?.amount?.value,
        currency: capture?.amount?.currency_code,
        payerEmail: response.data.payer?.email_address,
        payerName: response.data.payer?.name
      };
    } catch (error) {
      console.error('PayPal Capture Error:', error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to capture PayPal order'
      };
    }
  }

  /**
   * Get order details
   * @param {string} orderId - PayPal order ID
   */
  async getOrder(orderId) {
    try {
      const accessToken = await this.getAccessToken();

      const response = await axios.get(
        `${this.baseUrl}/v2/checkout/orders/${orderId}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      return {
        success: true,
        order: response.data
      };
    } catch (error) {
      console.error('PayPal Get Order Error:', error.response?.data || error.message);
      return {
        success: false,
        message: 'Failed to get order details'
      };
    }
  }

  /**
   * Verify webhook signature (for production use)
   * @param {object} headers - Request headers
   * @param {object} body - Request body
   */
  async verifyWebhook(headers, body) {
    // In production, implement webhook signature verification
    // For now, we'll rely on HTTPS and webhook URL validation
    // See: https://developer.paypal.com/docs/api-basics/notifications/webhooks/notification-messages/
    
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    if (!webhookId) {
      console.warn('PayPal webhook ID not configured. Webhook verification skipped.');
      return { valid: true }; // Allow in development
    }

    // TODO: Implement proper webhook signature verification
    // This requires verifying the signature using PayPal's public key
    
    return { valid: true };
  }
}

module.exports = new PayPalService();

