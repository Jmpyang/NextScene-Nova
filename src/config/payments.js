const paypal = require('paypal-rest-sdk');
const axios = require('axios');

class PaymentService {
  constructor() {
    // Configure PayPal SDK
    paypal.configure({
      'mode': process.env.PAYPAL_MODE || 'sandbox',
      'client_id': process.env.PAYPAL_CLIENT_ID,
      'client_secret': process.env.PAYPAL_CLIENT_SECRET
    });

    // M-Pesa configuration
    this.mpesa = {
      consumerKey: process.env.MPESA_CONSUMER_KEY,
      consumerSecret: process.env.MPESA_CONSUMER_SECRET,
      passkey: process.env.MPESA_PASSKEY,
      shortcode: process.env.MPESA_SHORTCODE,
      callbackUrl: process.env.MPESA_CALLBACK_URL,
      baseUrl: process.env.NODE_ENV === 'production' 
        ? 'https://api.safaricom.co.ke' 
        : 'https://sandbox.safaricom.co.ke'
    };
  }

  // PayPal Payment Methods
  async createPayPalPayment(amount, description, returnUrl, cancelUrl) {
    try {
      const payment_data = {
        intent: 'sale',
        payer: {
          payment_method: 'paypal'
        },
        redirect_urls: {
          return_url: returnUrl,
          cancel_url: cancelUrl
        },
        transactions: [{
          amount: {
            total: amount.toFixed(2),
            currency: 'USD'
          },
          description: description
        }]
      };

      return new Promise((resolve, reject) => {
        paypal.payment.create(payment_data, (error, payment) => {
          if (error) {
            console.error('PayPal payment creation error:', error);
            reject(error);
          } else {
            console.log('PayPal payment created:', payment.id);
            resolve(payment);
          }
        });
      });
    } catch (error) {
      console.error('PayPal payment error:', error);
      throw error;
    }
  }

  async executePayPalPayment(paymentId, payerId) {
    try {
      return new Promise((resolve, reject) => {
        paypal.payment.execute(paymentId, { payer_id: payerId }, (error, payment) => {
          if (error) {
            console.error('PayPal payment execution error:', error);
            reject(error);
          } else {
            console.log('PayPal payment executed:', payment.id);
            resolve(payment);
          }
        });
      });
    } catch (error) {
      console.error('PayPal execution error:', error);
      throw error;
    }
  }

  // M-Pesa Payment Methods
  async getMpesaAccessToken() {
    try {
      const auth = Buffer.from(`${this.mpesa.consumerKey}:${this.mpesa.consumerSecret}`).toString('base64');
      
      const response = await axios.get(
        `${this.mpesa.baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
        {
          headers: {
            'Authorization': `Basic ${auth}`
          }
        }
      );

      return response.data.access_token;
    } catch (error) {
      console.error('M-Pesa access token error:', error);
      throw error;
    }
  }

  async initiateMpesaSTKPush(phoneNumber, amount, accountReference, transactionDesc) {
    try {
      const accessToken = await this.getMpesaAccessToken();
      const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, -4);
      const password = Buffer.from(
        `${this.mpesa.shortcode}${this.mpesa.passkey}${timestamp}`
      ).toString('base64');

      const response = await axios.post(
        `${this.mpesa.baseUrl}/mpesa/stkpush/v1/processrequest`,
        {
          BusinessShortCode: this.mpesa.shortcode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: 'CustomerPayBillOnline',
          Amount: amount,
          PartyA: phoneNumber,
          PartyB: this.mpesa.shortcode,
          PhoneNumber: phoneNumber,
          CallBackURL: this.mpesa.callbackUrl,
          AccountReference: accountReference,
          TransactionDesc: transactionDesc
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('M-Pesa STK Push initiated:', response.data);
      return response.data;
    } catch (error) {
      console.error('M-Pesa STK Push error:', error);
      throw error;
    }
  }

  async verifyMpesaTransaction(checkoutRequestId) {
    try {
      const accessToken = await this.getMpesaAccessToken();
      const timestamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, -4);
      const password = Buffer.from(
        `${this.mpesa.shortcode}${this.mpesa.passkey}${timestamp}`
      ).toString('base64');

      const response = await axios.post(
        `${this.mpesa.baseUrl}/mpesa/stkpushquery/v1/query`,
        {
          BusinessShortCode: this.mpesa.shortcode,
          Password: password,
          Timestamp: timestamp,
          CheckoutRequestID: checkoutRequestId
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      console.error('M-Pesa transaction verification error:', error);
      throw error;
    }
  }

  // Generic payment validation
  validatePaymentResponse(paymentData, provider) {
    switch (provider) {
      case 'paypal':
        return this.validatePayPalResponse(paymentData);
      case 'mpesa':
        return this.validateMpesaResponse(paymentData);
      default:
        throw new Error('Unsupported payment provider');
    }
  }

  validatePayPalResponse(payment) {
    return {
      isValid: payment.state === 'approved' || payment.payer?.state === 'verified',
      transactionId: payment.id,
      amount: parseFloat(payment.transactions?.[0]?.amount?.total || '0'),
      currency: payment.transactions?.[0]?.amount?.currency || 'USD',
      status: payment.state
    };
  }

  validateMpesaResponse(response) {
    const resultCode = response.ResultCode;
    const isValid = resultCode === '0';
    
    return {
      isValid,
      transactionId: response.CheckoutRequestID,
      amount: parseFloat(response.CallbackMetadata?.Item?.find(item => item.Name === 'Amount')?.Value || '0'),
      phoneNumber: response.CallbackMetadata?.Item?.find(item => item.Name === 'PhoneNumber')?.Value,
      status: isValid ? 'completed' : 'failed',
      resultCode,
      resultDesc: response.ResultDesc
    };
  }
}

module.exports = new PaymentService();
