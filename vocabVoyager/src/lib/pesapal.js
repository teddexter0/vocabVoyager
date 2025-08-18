// src/lib/pesapal.js - FIXED VERSION
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
      return window.location.origin;
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

  // ✅ FIXED: Proper API request formatting
  async makeApiRequest(endpoint, method = 'GET', body = null) {
    try {
      if (this.isProductionMode()) {
        // Production: Use serverless function
        const response = await fetch('/api/pesapal', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            pesapalEndpoint: endpoint,
            pesapalMethod: method,
            pesapalData: body
          })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        return await response.json();
      } else {
        // Development: Direct API call
        const url = `${pesapalConfig.PESAPAL_BASE_URL}${endpoint}`;
        const options = {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          }
        };

        if (body) {
          options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
      }
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
        ipn_notification_type: 'GET',
        token: token
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

  // vocabVoyager/src/lib/pesapal.js - CORRECT submitPaymentOrder function

// Replace the submitPaymentOrder function:
async submitPaymentOrder(token, ipnId, orderData) {
  try {
    // Validate order data
    if (!orderData.email || !orderData.amount || !orderData.orderId) {
      throw new Error('Invalid order data provided');
    }

    // ✅ CORRECT: Use customer's real phone number
    const customerPhone = orderData.phone || '254700000000'; // Fallback to dummy if no phone

    const pesapalOrder = {
      id: orderData.orderId,
      currency: 'KES',
      amount: parseFloat(orderData.amount),
      description: orderData.description || 'VocabVoyager Premium Subscription',
      callback_url: pesapalConfig.CALLBACK_URL,
      notification_id: ipnId,
      billing_address: {
        email_address: orderData.email,
        phone_number: customerPhone, // ✅ CUSTOMER'S real phone number
        country_code: 'KE',
        first_name: orderData.firstName || orderData.email.split('@')[0],
        last_name: orderData.lastName || 'User',
        line_1: orderData.address || 'Nairobi, Kenya',
        city: orderData.city || 'Nairobi',
        state: orderData.state || 'Nairobi',
        postal_code: orderData.postalCode || '00100'
      },
      token: token
    };
    
    console.log('📱 Sending payment with customer phone:', customerPhone);
    
    const data = await this.makeApiRequest('/api/Transactions/SubmitOrderRequest', 'POST', pesapalOrder);
    // Add this right before the makeApiRequest call:
console.log('🔍 ABOUT TO SEND TO API:', JSON.stringify(pesapalOrder, null, 2));
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

// Also update initiatePayment to handle phone parameter:
async initiatePayment(userEmail, planType = 'premium', customerPhone = null) {
  try {
    console.log(`💳 Initiating payment for ${userEmail} - ${planType}`);
    console.log(`📱 Customer phone: ${customerPhone}`);
    
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
    
    // 🔒 CREATE PAYMENT RECORD IN DATABASE FIRST
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      throw new Error('User not authenticated');
    }

    const { data: paymentRecord, error: dbError } = await supabase
      .from('payment_transactions')
      .insert({
        user_id: userData.user.id,
        order_id: orderId,
        email: userEmail,
        phone: customerPhone, // ✅ Store customer's phone
        amount: selectedPlan.amount,
        currency: 'KES',
        status: 'pending'
      })
      .select()
      .single();

    if (dbError) {
      console.error('❌ Failed to create payment record:', dbError);
      throw new Error('Failed to initialize payment. Please try again.');
    }

    console.log('✅ Payment record created in database');
    
    // Get access token
    const token = await this.getAccessToken();
    
    // Register IPN (or get cached one)
    let ipnId = localStorage.getItem('pesapal_ipn_id');
    if (!ipnId) {
      ipnId = await this.registerIPN(token);
      localStorage.setItem('pesapal_ipn_id', ipnId);
    }
    
    // ✅ PREPARE ORDER DATA WITH CUSTOMER'S PHONE
    const orderData = {
      orderId,
      amount: selectedPlan.amount,
      description: selectedPlan.description,
      email: userEmail,
      firstName: userEmail.split('@')[0],
      lastName: 'User',
      phone: customerPhone // ✅ Include customer's phone number
    };
    
    // Submit payment order
    const paymentResult = await this.submitPaymentOrder(token, ipnId, orderData);
    
    if (paymentResult.success) {
      // 🔒 UPDATE PAYMENT RECORD WITH PESAPAL TRACKING ID
      await supabase
        .from('payment_transactions')
        .update({
          pesapal_tracking_id: paymentResult.orderTrackingId
        })
        .eq('id', paymentRecord.id);

      // Store pending payment info (as backup)
      localStorage.setItem('pending_payment', JSON.stringify({
        orderId,
        orderTrackingId: paymentResult.orderTrackingId,
        email: userEmail,
        phone: customerPhone, // ✅ Store customer's phone
        planType,
        amount: selectedPlan.amount,
        timestamp: Date.now(),
        paymentRecordId: paymentRecord.id
      }));
      
      console.log('✅ Payment initiated successfully');
      
      return {
        success: true,
        redirectUrl: paymentResult.redirectUrl,
        orderTrackingId: paymentResult.orderTrackingId
      };
    } else {
      // 🔒 MARK PAYMENT AS FAILED
      await supabase
        .from('payment_transactions')
        .update({ status: 'failed' })
        .eq('id', paymentRecord.id);

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
    } else if (error.message.includes('authenticated')) {
      userMessage = 'Please sign in again to continue with payment.';
    }
    
    return {
      success: false,
      error: userMessage,
      technicalError: error.message // For debugging
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
        'GET',
        { token: token }
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
// vocabVoyager/src/lib/pesapal.js - UPDATE INITIATE PAYMENT FUNCTION

// Replace the initiatePayment function signature:
async initiatePayment(userEmail, planType = 'premium', phoneNumber = null) {
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
    
    // ✅ PREPARE ORDER DATA WITH PHONE
    const orderData = {
      orderId,
      amount: selectedPlan.amount,
      description: selectedPlan.description,
      email: userEmail,
      firstName: userEmail.split('@')[0],
      lastName: 'User',
      phone: phoneNumber // ✅ Include phone number
    };
    
    // Submit payment order
    const paymentResult = await this.submitPaymentOrder(token, ipnId, orderData);
    
    if (paymentResult.success) {
      // Store pending payment info
      localStorage.setItem('pending_payment', JSON.stringify({
        orderId,
        orderTrackingId: paymentResult.orderTrackingId,
        email: userEmail,
        phone: phoneNumber, // ✅ Store phone too
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