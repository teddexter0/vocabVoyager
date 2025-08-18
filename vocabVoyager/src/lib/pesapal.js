// src/lib/pesapal.js - PRODUCTION READY VERSION
export const pesapalConfig = {
  PESAPAL_CONSUMER_KEY: process.env.REACT_APP_PESAPAL_CONSUMER_KEY,
  PESAPAL_CONSUMER_SECRET: process.env.REACT_APP_PESAPAL_CONSUMER_SECRET,
  
  // ✅ FIXED: Dynamic URL handling for production
  PESAPAL_BASE_URL: process.env.NODE_ENV === 'production' 
    ? 'https://pay.pesapal.com/v3'  // Production Pesapal
    : 'https://cybqa.pesapal.com/pesapalv3', // Sandbox for staging
  
  // ✅ FIXED: Dynamic callback URL
  get CALLBACK_URL() {
    if (process.env.NODE_ENV === 'production') {
      // Vercel provides this automatically in production
      return process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}` 
        : window.location.origin;
    }
    return window.location.origin;
  }
};

export const pesapalService = {
  // Check environment
  isDevelopmentMode() {
    return process.env.NODE_ENV === 'development' && 
           typeof window !== 'undefined' && 
           window.location.hostname === 'localhost';
  },

  isProductionMode() {
    return process.env.NODE_ENV === 'production' || 
           (typeof window !== 'undefined' && 
            !window.location.hostname.includes('localhost'));
  },

  // ✅ PRODUCTION: Use Vercel serverless function to avoid CORS
  async makeApiRequest(endpoint, method = 'GET', body = null) {
    try {
      const baseUrl = this.isProductionMode() 
        ? '/api/pesapal'  // Vercel serverless function
        : pesapalConfig.PESAPAL_BASE_URL; // Direct API in dev

      const url = this.isProductionMode() 
        ? `/api/pesapal?endpoint=${encodeURIComponent(endpoint)}&method=${method}`
        : `${baseUrl}${endpoint}`;

      const options = {
        method: this.isProductionMode() ? 'POST' : method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        }
      };

      if (body) {
        options.body = JSON.stringify({
          pesapalData: body,
          pesapalEndpoint: endpoint,
          pesapalMethod: method
        });
      }

      const response = await fetch(url, options);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('❌ API request failed:', error);
      throw error;
    }
  },

  // Get access token with proper error handling
  async getAccessToken() {
    try {
      console.log('🔑 Getting Pesapal access token...');
      
      if (!pesapalConfig.PESAPAL_CONSUMER_KEY || !pesapalConfig.PESAPAL_CONSUMER_SECRET) {
        throw new Error('Pesapal credentials not configured. Please check your environment variables.');
      }

      const data = await this.makeApiRequest('/api/Auth/RequestToken', 'POST', {
        consumer_key: pesapalConfig.PESAPAL_CONSUMER_KEY,
        consumer_secret: pesapalConfig.PESAPAL_CONSUMER_SECRET
      });
      
      if (data.status === '200' || data.token) {
        console.log('✅ Pesapal token obtained');
        return data.token;
      } else {
        throw new Error(data.message || 'Failed to get access token');
      }
    } catch (error) {
      console.error('❌ Error getting Pesapal token:', error);
      if (error.message.includes('CORS')) {
        throw new Error('Payment system configuration error. Please contact support.');
      }
      throw new Error(`Payment system unavailable: ${error.message}`);
    }
  },

  // Register IPN with better error handling
  async registerIPN(token) {
    try {
      const data = await this.makeApiRequest('/api/URLSetup/RegisterIPN', 'POST', {
        url: `${pesapalConfig.CALLBACK_URL}/api/pesapal-callback`,
        ipn_notification_type: 'GET'
      });
      
      if (data.status === '200' || data.ipn_id) {
        return data.ipn_id;
      } else {
        throw new Error(data.message || 'Failed to register IPN');
      }
    } catch (error) {
      console.error('❌ IPN registration failed:', error);
      throw error;
    }
  },

  // Submit payment order with enhanced validation
  async submitPaymentOrder(token, ipnId, orderData) {
    try {
      // Validate order data
      if (!orderData.email || !orderData.amount || !orderData.orderId) {
        throw new Error('Invalid order data provided');
      }

      const pesapalOrder = {
        id: orderData.orderId,
        currency: 'KES',
        amount: parseFloat(orderData.amount),
        description: orderData.description || 'VocabVoyager Premium Subscription',
        callback_url: pesapalConfig.CALLBACK_URL,
        notification_id: ipnId,
        billing_address: {
          email_address: orderData.email,
          phone_number: orderData.phone || '254700000000',
          country_code: 'KE',
          first_name: orderData.firstName || orderData.email.split('@')[0],
          last_name: orderData.lastName || 'User',
          line_1: orderData.address || 'Nairobi, Kenya',
          city: orderData.city || 'Nairobi',
          state: orderData.state || 'Nairobi',
          postal_code: orderData.postalCode || '00100'
        }
      };
      
      const data = await this.makeApiRequest('/api/Transactions/SubmitOrderRequest', 'POST', pesapalOrder);
      
      if (data.status === '200' || data.redirect_url) {
        return {
          success: true,
          orderTrackingId: data.order_tracking_id,
          redirectUrl: data.redirect_url
        };
      } else {
        throw new Error(data.message || 'Failed to submit payment order');
      }
    } catch (error) {
      console.error('❌ Payment order submission failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  // Enhanced payment status check
  async getPaymentStatus(token, orderTrackingId) {
    // Handle development simulation
    if (orderTrackingId?.startsWith('DEV_')) {
      const urlParams = new URLSearchParams(window.location.search);
      const isDev = urlParams.get('dev_payment') === 'success';
      
      return {
        success: true,
        paymentStatus: isDev ? 'Completed' : 'Failed',
        confirmed: isDev,
        amount: 499,
        currency: 'KES',
        isDevelopment: true
      };
    }

    try {
      const data = await this.makeApiRequest(
        `/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
        'GET'
      );
      
      if (data.status === '200') {
        return {
          success: true,
          paymentStatus: data.payment_status_description,
          confirmed: data.payment_status_description === 'Completed',
          amount: data.amount,
          currency: data.currency
        };
      } else {
        throw new Error(data.message || 'Failed to get payment status');
      }
    } catch (error) {
      console.error('❌ Payment status check failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  },

  // Development simulation (unchanged)
  async simulatePayment(userEmail, planType) {
    const orderId = `DEV_${Date.now()}`;
    
    return new Promise((resolve) => {
      setTimeout(() => {
        const confirmed = window.confirm(
          `🔧 DEVELOPMENT MODE PAYMENT\n\n` +
          `Email: ${userEmail}\n` +
          `Plan: ${planType} (KES 499/month)\n\n` +
          `This is a simulation for development.\n` +
          `In production, users will be redirected to Pesapal.\n\n` +
          `Click OK to simulate successful payment\n` +
          `Click Cancel to simulate payment failure`
        );
        
        if (confirmed) {
          localStorage.setItem('dev_payment_success', JSON.stringify({
            orderId,
            email: userEmail,
            planType,
            timestamp: Date.now()
          }));
          
          window.location.href = `${window.location.origin}?dev_payment=success&OrderTrackingId=${orderId}`;
          
          resolve({
            success: true,
            redirectUrl: '#dev-payment',
            orderTrackingId: orderId,
            isDev: true
          });
        } else {
          resolve({
            success: false,
            error: 'Payment cancelled by user (development mode)'
          });
        }
      }, 500);
    });
  },

  // 💳 MAIN PAYMENT FLOW - Production Ready
  async initiatePayment(userEmail, planType = 'premium') {
    try {
      console.log(`💳 Initiating payment for ${userEmail} - ${planType}`);
      
      // Validate inputs
      if (!userEmail || !userEmail.includes('@')) {
        throw new Error('Valid email address is required');
      }

      if (!pesapalConfig.PESAPAL_CONSUMER_KEY || !pesapalConfig.PESAPAL_CONSUMER_SECRET) {
        throw new Error('Payment system is not properly configured. Please contact support.');
      }

      const plans = {
        premium: {
          amount: 499,
          description: 'VocabVoyager Premium - Monthly Subscription (KES 499)'
        }
      };
      
      const selectedPlan = plans[planType];
      if (!selectedPlan) {
        throw new Error('Invalid subscription plan selected');
      }

      // 🔧 DEVELOPMENT MODE: Use simulation
      if (this.isDevelopmentMode()) {
        console.log('🔧 Development mode - using payment simulation');
        return await this.simulatePayment(userEmail, planType);
      }
      
      // 🚀 PRODUCTION MODE: Real Pesapal integration
      console.log('🚀 Production mode - processing real payment');
      
      const orderId = `VV_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Get access token
      const token = await this.getAccessToken();
      
      // Register IPN (or get cached one)
      let ipnId = localStorage.getItem('pesapal_ipn_id');
      if (!ipnId) {
        ipnId = await this.registerIPN(token);
        localStorage.setItem('pesapal_ipn_id', ipnId);
      }
      
      // Prepare order data
      const orderData = {
        orderId,
        amount: selectedPlan.amount,
        description: selectedPlan.description,
        email: userEmail,
        firstName: userEmail.split('@')[0],
        lastName: 'User'
      };
      
      // Submit payment order
      const paymentResult = await this.submitPaymentOrder(token, ipnId, orderData);
      
      if (paymentResult.success) {
        // Store pending payment info
        localStorage.setItem('pending_payment', JSON.stringify({
          orderId,
          orderTrackingId: paymentResult.orderTrackingId,
          email: userEmail,
          planType,
          amount: selectedPlan.amount,
          timestamp: Date.now()
        }));
        
        console.log('✅ Payment initiated successfully');
        
        return {
          success: true,
          redirectUrl: paymentResult.redirectUrl,
          orderTrackingId: paymentResult.orderTrackingId
        };
      } else {
        throw new Error(paymentResult.error || 'Payment initiation failed');
      }
      
    } catch (error) {
      console.error('❌ Payment initiation failed:', error);
      
      // Provide user-friendly error messages
      let userMessage = 'Payment system temporarily unavailable. Please try again later.';
      
      if (error.message.includes('credentials')) {
        userMessage = 'Payment system configuration error. Please contact support.';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        userMessage = 'Network error. Please check your connection and try again.';
      } else if (error.message.includes('email')) {
        userMessage = 'Please provide a valid email address.';
      }
      
      return {
        success: false,
        error: userMessage,
        technicalError: error.message // For debugging
      };
    }
  }
};

// Export helper for backward compatibility
export const paymentVerificationService = {
  async verifyPayment(orderTrackingId) {
    try {
      if (orderTrackingId?.startsWith('DEV_')) {
        return await pesapalService.getPaymentStatus(null, orderTrackingId);
      }
      
      const token = await pesapalService.getAccessToken();
      return await pesapalService.getPaymentStatus(token, orderTrackingId);
    } catch (error) {
      console.error('❌ Payment verification failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
};