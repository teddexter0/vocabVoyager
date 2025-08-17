// src/lib/pesapal.js - HYBRID SOLUTION (Development + Production)
export const pesapalConfig = {
  PESAPAL_CONSUMER_KEY: process.env.REACT_APP_PESAPAL_CONSUMER_KEY,
  PESAPAL_CONSUMER_SECRET: process.env.REACT_APP_PESAPAL_CONSUMER_SECRET,
  PESAPAL_BASE_URL: process.env.NODE_ENV === 'production' 
    ? 'https://pay.pesapal.com/v3'  // Production 
    : 'https://cybqa.pesapal.com/pesapalv3', // Sandbox
  
  CALLBACK_URL: process.env.NODE_ENV === 'production'
    ? 'https://your-vercel-app.vercel.app'  // Update with your actual Vercel URL
    : window.location.origin,
}

export const pesapalService = {
  // Check if we're in development and can't use real Pesapal due to CORS
  isDevelopmentMode() {
    return process.env.NODE_ENV === 'development';
  },

  // Development mode payment simulation
  async simulatePayment(userEmail, planType) {
    const orderId = `DEV_${Date.now()}`;
    
    return new Promise((resolve) => {
      // Show development payment dialog
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
          // Simulate successful payment
          localStorage.setItem('dev_payment_success', JSON.stringify({
            orderId,
            email: userEmail,
            planType,
            timestamp: Date.now()
          }));
          
          // Simulate redirect back with success
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

  // Real Pesapal integration for production
  async getAccessToken() {
    try {
      console.log('🔑 Getting Pesapal access token...');
      
      // In production, this will work because Vercel can make server-side requests
      const response = await fetch(`${pesapalConfig.PESAPAL_BASE_URL}/api/Auth/RequestToken`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          consumer_key: pesapalConfig.PESAPAL_CONSUMER_KEY,
          consumer_secret: pesapalConfig.PESAPAL_CONSUMER_SECRET
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
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

  // Register IPN URL
  async registerIPN(token) {
    try {
      const response = await fetch(`${pesapalConfig.PESAPAL_BASE_URL}/api/URLSetup/RegisterIPN`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          url: `${pesapalConfig.CALLBACK_URL}/api/pesapal-ipn`,
          ipn_notification_type: 'GET'
        })
      });
      
      const data = await response.json();
      
      if (data.status === '200' || data.ipn_id) {
        return data.ipn_id;
      } else {
        throw new Error(data.message || 'Failed to register IPN');
      }
    } catch (error) {
      throw error;
    }
  },

  // Submit payment order
  async submitPaymentOrder(token, ipnId, orderData) {
    try {
      const pesapalOrder = {
        id: orderData.orderId,
        currency: 'KES',
        amount: orderData.amount,
        description: orderData.description,
        callback_url: pesapalConfig.CALLBACK_URL,
        notification_id: ipnId,
        billing_address: {
          email_address: orderData.email,
          phone_number: '254700000000',
          country_code: 'KE',
          first_name: orderData.firstName || orderData.email.split('@')[0],
          last_name: 'User',
          line_1: 'Nairobi, Kenya',
          city: 'Nairobi',
          state: 'Nairobi',
          postal_code: '00100'
        }
      };
      
      const response = await fetch(`${pesapalConfig.PESAPAL_BASE_URL}/api/Transactions/SubmitOrderRequest`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(pesapalOrder)
      });
      
      const data = await response.json();
      
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
      return {
        success: false,
        error: error.message
      };
    }
  },

  // Check payment status
  async getPaymentStatus(token, orderTrackingId) {
    // Handle development mode
    if (orderTrackingId.startsWith('DEV_')) {
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
      const response = await fetch(
        `${pesapalConfig.PESAPAL_BASE_URL}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          }
        }
      );
      
      const data = await response.json();
      
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
      return {
        success: false,
        error: error.message
      };
    }
  },

  // 💳 MAIN PAYMENT FLOW - Works in both development and production
  async initiatePayment(userEmail, planType = 'premium') {
    try {
      // Check credentials
      if (!pesapalConfig.PESAPAL_CONSUMER_KEY || !pesapalConfig.PESAPAL_CONSUMER_SECRET) {
        throw new Error('Pesapal credentials not configured');
      }

      const plans = {
        premium: {
          amount: 499,
          description: 'VocabVoyager Premium - Monthly Subscription'
        }
      };
      
      const selectedPlan = plans[planType];
      if (!selectedPlan) {
        throw new Error('Invalid plan type');
      }

      // 🔧 DEVELOPMENT MODE: Use simulation due to CORS limitations
      if (this.isDevelopmentMode()) {
        console.log('🔧 Development mode - using payment simulation');
        return await this.simulatePayment(userEmail, planType);
      }
      
      // 🚀 PRODUCTION MODE: Use real Pesapal
      console.log('🚀 Production mode - using real Pesapal');
      
      const orderId = `VV_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const token = await this.getAccessToken();
      
      let ipnId = localStorage.getItem('pesapal_ipn_id');
      if (!ipnId) {
        ipnId = await this.registerIPN(token);
        localStorage.setItem('pesapal_ipn_id', ipnId);
      }
      
      const orderData = {
        orderId,
        amount: selectedPlan.amount,
        description: selectedPlan.description,
        email: userEmail,
        firstName: userEmail.split('@')[0]
      };
      
      const paymentResult = await this.submitPaymentOrder(token, ipnId, orderData);
      
      if (paymentResult.success) {
        localStorage.setItem('pending_payment', JSON.stringify({
          orderId,
          orderTrackingId: paymentResult.orderTrackingId,
          email: userEmail,
          planType,
          amount: selectedPlan.amount,
          timestamp: Date.now()
        }));
        
        return {
          success: true,
          redirectUrl: paymentResult.redirectUrl,
          orderTrackingId: paymentResult.orderTrackingId
        };
      } else {
        throw new Error(paymentResult.error);
      }
      
    } catch (error) {
      console.error('❌ Payment initiation failed:', error);
      return {
        success: false,
        error: error.message || 'Payment system temporarily unavailable'
      };
    }
  }
};

// Export for backward compatibility
export const paymentVerificationService = {
  async verifyPayment(orderTrackingId) {
    try {
      if (orderTrackingId.startsWith('DEV_')) {
        return await pesapalService.getPaymentStatus(null, orderTrackingId);
      }
      
      const token = await pesapalService.getAccessToken();
      return await pesapalService.getPaymentStatus(token, orderTrackingId);
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
};