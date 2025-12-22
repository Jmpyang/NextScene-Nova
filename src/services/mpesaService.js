const axios = require('axios');
const crypto = require('crypto');

/**
 * M-Pesa Daraja API Service
 * Handles STK Push, payment verification, and callbacks
 */

class MpesaService {
  constructor() {
    this.consumerKey = process.env.MPESA_CONSUMER_KEY;
    this.consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    this.passkey = process.env.MPESA_PASSKEY;
    this.shortcode = process.env.MPESA_SHORTCODE;
    this.environment = process.env.MPESA_ENVIRONMENT || 'sandbox'; // 'sandbox' or 'production'
    
    this.baseUrl = this.environment === 'production' 
      ? 'https://api.safaricom.co.ke'
      : 'https://sandbox.safaricom.co.ke';
    
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
      const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
      const response = await axios.get(`${this.baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
        headers: {
          Authorization: `Basic ${auth}`
        }
      });

      this.accessToken = response.data.access_token;
      // Set expiry to 55 minutes (tokens expire in 1 hour)
      this.tokenExpiry = Date.now() + (55 * 60 * 1000);
      
      return this.accessToken;
    } catch (error) {
      console.error('M-Pesa OAuth Error:', error.response?.data || error.message);
      throw new Error('Failed to get M-Pesa access token');
    }
  }

  /**
   * Generate password for STK Push
   */
  generatePassword() {
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
    const password = Buffer.from(`${this.shortcode}${this.passkey}${timestamp}`).toString('base64');
    return { password, timestamp };
  }

  /**
   * Initiate STK Push payment
   * @param {string} phoneNumber - Phone number in format 254712345678
   * @param {number} amount - Amount to charge
   * @param {string} accountReference - Reference for the transaction
   * @param {string} transactionDesc - Description of the transaction
   */
  async initiateSTKPush(phoneNumber, amount, accountReference, transactionDesc = 'Premium Subscription') {
    try {
      const accessToken = await this.getAccessToken();
      const { password, timestamp } = this.generatePassword();
      
      // Ensure phone number is in correct format (254XXXXXXXXX)
      let formattedPhone = phoneNumber.replace(/\D/g, ''); // Remove non-digits
      if (formattedPhone.startsWith('0')) {
        formattedPhone = '254' + formattedPhone.substring(1);
      } else if (!formattedPhone.startsWith('254')) {
        formattedPhone = '254' + formattedPhone;
      }

      const callbackUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/api/premium/mpesa/callback`;
      
      const payload = {
        BusinessShortCode: this.shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: amount,
        PartyA: formattedPhone,
        PartyB: this.shortcode,
        PhoneNumber: formattedPhone,
        CallBackURL: callbackUrl,
        AccountReference: accountReference,
        TransactionDesc: transactionDesc
      };

      const response = await axios.post(
        `${this.baseUrl}/mpesa/stkpush/v1/processrequest`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        checkoutRequestID: response.data.CheckoutRequestID,
        customerMessage: response.data.CustomerMessage,
        responseCode: response.data.ResponseCode
      };
    } catch (error) {
      console.error('M-Pesa STK Push Error:', error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.errorMessage || 'Failed to initiate M-Pesa payment'
      };
    }
  }

  /**
   * Query STK Push status
   * @param {string} checkoutRequestID - The checkout request ID from STK Push
   */
  async querySTKStatus(checkoutRequestID) {
    try {
      const accessToken = await this.getAccessToken();
      const { password, timestamp } = this.generatePassword();

      const payload = {
        BusinessShortCode: this.shortcode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestID
      };

      const response = await axios.post(
        `${this.baseUrl}/mpesa/stkpushquery/v1/query`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        resultCode: response.data.ResultCode,
        resultDesc: response.data.ResultDesc,
        checkoutRequestID: response.data.CheckoutRequestID,
        merchantRequestID: response.data.MerchantRequestID
      };
    } catch (error) {
      console.error('M-Pesa Query Error:', error.response?.data || error.message);
      return {
        success: false,
        message: 'Failed to query payment status'
      };
    }
  }

  /**
   * Verify callback data from M-Pesa
   * @param {object} callbackData - Callback data from M-Pesa
   */
  verifyCallback(callbackData) {
    // Verify the callback structure
    if (!callbackData.Body || !callbackData.Body.stkCallback) {
      return { valid: false, message: 'Invalid callback structure' };
    }

    const stkCallback = callbackData.Body.stkCallback;
    const resultCode = stkCallback.ResultCode;
    
    // ResultCode 0 means success
    if (resultCode === 0) {
      const callbackMetadata = stkCallback.CallbackMetadata;
      const items = callbackMetadata?.Item || [];
      
      const metadata = {};
      items.forEach(item => {
        metadata[item.Name] = item.Value;
      });

      return {
        valid: true,
        success: true,
        merchantRequestID: stkCallback.MerchantRequestID,
        checkoutRequestID: stkCallback.CheckoutRequestID,
        amount: metadata.Amount,
        mpesaReceiptNumber: metadata.MpesaReceiptNumber,
        transactionDate: metadata.TransactionDate,
        phoneNumber: metadata.PhoneNumber
      };
    }

    return {
      valid: true,
      success: false,
      resultCode,
      resultDesc: stkCallback.ResultDesc
    };
  }
}

module.exports = new MpesaService();

