// src/lib/pesapal.js - COMPLETE FIXED VERSION
import { supabase } from './supabase'; // ✅ CRITICAL: This was missing!

export const pesapalConfig = {
  PESAPAL_CONSUMER_KEY: process.env.REACT_APP_PESAPAL_CONSUMER_KEY,
  PESAPAL_CONSUMER_SECRET: process.env.REACT_APP_PESAPAL_CONSUMER_SECRET,
  
  PESAPAL_BASE_URL: process.env.NODE_ENV === 'production' 
    ? 'https://pay.pesapal.com/v3'
    : 'https://cybqa.pesapal.com/pesapalv3',
  
  get CALLBACK_URL() {
    if (process.env.NODE_ENV === 'production') {
      return window.location.origin;
    }
    return window.location.origin;
  }
};

export const pesapalService = {
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

  async makeApiRequest(endpoint, method = 'GET', body = null) {
    try {
      if (this.isProductionMode()) {
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

  async getAccessToken() {
    try {
      console.log('🔑 Getting Pesapal access token...');
      
      if (!pesapalConfig.PESAPAL_CONSUMER_KEY || !pesapalConfig.PESAPAL_CONSUMER_SECRET) {
        throw new Error('Pesapal credentials not configured');
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
      throw new Error(`Payment system unavailable: ${error.message}`);
    }
  },

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

  async submitPaymentOrder(token, ipnId, orderData) {
    try {
      if (!orderData.email || !orderData.amount || !orderData.orderId) {
        throw new Error('Invalid order data provided');
      }

      const customerPhone = orderData.phone || '254700000000';

      const pesapalOrder = {
        id: orderData.orderId,
        currency: 'KES',
        amount: parseFloat(orderData.amount),
        description: orderData.description || 'VocabVoyager Premium Subscription',
        callback_url: pesapalConfig.CALLBACK_URL,
        notification_id: ipnId,
        billing_address: {
          email_address: orderData.email,
          phone_number: customerPhone,
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
      console.log('🔍 Full Pesapal order:', JSON.stringify(pesapalOrder, null, 2));
      
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

  // ✅ COMPLETELY REWRITTEN - This is where the bug was!
  async initiatePayment(userEmail, planType = 'premium', customerPhone = null) {
    try {
      console.log(`💳 Initiating payment for ${userEmail}`);
      console.log(`📱 Customer phone: ${customerPhone}`);
      
      // Validate inputs
      if (!userEmail || !userEmail.includes('@')) {
        throw new Error('Valid email address is required');
      }

      if (!pesapalConfig.PESAPAL_CONSUMER_KEY || !pesapalConfig.PESAPAL_CONSUMER_SECRET) {
        throw new Error('Payment system is not properly configured');
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

      // Development mode simulation
      if (this.isDevelopmentMode()) {
        console.log('🔧 Development mode - using payment simulation');
        return await this.simulatePayment(userEmail, planType);
      }
      
      console.log('🚀 Production mode - processing real payment');
      
      const orderId = `VV_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // ✅ CRITICAL FIX #1: Get authenticated user FIRST
      console.log('🔐 Getting authenticated user...');
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.error('❌ User not authenticated:', userError);
        throw new Error('Please sign in again to continue with payment');
      }
      
      console.log('✅ User authenticated:', user.id);

      // ✅ CRITICAL FIX #2: Create database record BEFORE Pesapal
      console.log('💾 Creating payment record in database...');
      
      const { data: paymentRecord, error: dbError } = await supabase
        .from('payment_transactions')
        .insert({
          user_id: user.id,
          order_id: orderId,
          email: userEmail,
          phone: customerPhone,
          amount: selectedPlan.amount,
          currency: 'KES',
          status: 'pending',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (dbError) {
        console.error('❌ Database insert failed:', dbError);
        throw new Error(`Failed to initialize payment: ${dbError.message}`);
      }

      console.log('✅ Payment record created:', paymentRecord.id);
      
      // Get Pesapal access token
      console.log('🔑 Getting Pesapal token...');
      const token = await this.getAccessToken();
      
      // Register IPN
      let ipnId = localStorage.getItem('pesapal_ipn_id');
      if (!ipnId) {
        console.log('📡 Registering IPN...');
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
        lastName: 'User',
        phone: customerPhone
      };
      
      // Submit to Pesapal
      console.log('📤 Submitting order to Pesapal...');
      const paymentResult = await this.submitPaymentOrder(token, ipnId, orderData);
      
      if (paymentResult.success) {
        // Update database with Pesapal tracking ID
        console.log('🔄 Updating payment record with tracking ID...');
        await supabase
          .from('payment_transactions')
          .update({
            pesapal_tracking_id: paymentResult.orderTrackingId
          })
          .eq('id', paymentRecord.id);

        console.log('✅ Payment initiated successfully');
        console.log('🔗 Redirect URL:', paymentResult.redirectUrl);
        
        return {
          success: true,
          redirectUrl: paymentResult.redirectUrl,
          orderTrackingId: paymentResult.orderTrackingId
        };
      } else {
        // Mark payment as failed in database
        console.error('❌ Pesapal submission failed');
        await supabase
          .from('payment_transactions')
          .update({ status: 'failed' })
          .eq('id', paymentRecord.id);

        throw new Error(paymentResult.error || 'Payment initiation failed');
      }
      
    } catch (error) {
      console.error('❌ Payment initiation failed:', error);
      
      // User-friendly error messages
      let userMessage = 'Payment system temporarily unavailable. Please try again later.';
      
      if (error.message.includes('credentials')) {
        userMessage = 'Payment system configuration error. Please contact support.';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        userMessage = 'Network error. Please check your connection and try again.';
      } else if (error.message.includes('email')) {
        userMessage = 'Please provide a valid email address.';
      } else if (error.message.includes('sign in')) {
        userMessage = 'Please sign in again to continue with payment.';
      }
      
      return {
        success: false,
        error: userMessage,
        technicalError: error.message
      };
    }
  },

  async getPaymentStatus(token, orderTrackingId) {
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

  async simulatePayment(userEmail, planType) {
    const orderId = `DEV_${Date.now()}`;
    
    return new Promise((resolve) => {
      setTimeout(() => {
        const confirmed = window.confirm(
          `🔧 DEVELOPMENT MODE PAYMENT\n\n` +
          `Email: ${userEmail}\n` +
          `Plan: ${planType} (KES 499/month)\n\n` +
          `Click OK to simulate successful payment`
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
  }
};

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