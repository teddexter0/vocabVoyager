// src/lib/pesapal.js - Pesapal Payment Integration
export const pesapalConfig = {
  // Replace with your actual Pesapal credentials
  PESAPAL_CONSUMER_KEY: process.env.REACT_APP_PESAPAL_CONSUMER_KEY || 'qkio1BGWYWMiG6EGSBdyCoIGUbdvTBdGx0bEEgJfbKhyb2F-gLbTdJYhZJFqJdQIhqxJ',
  PESAPAL_CONSUMER_SECRET: process.env.REACT_APP_PESAPAL_CONSUMER_SECRET || 'QSqhKpRK2QhJoQqJhv6dIaJnJZJ9aQGmUwQqJ',
  PESAPAL_BASE_URL: 'https://cybqa.pesapal.com/pesapalv3', // Use https://pay.pesapal.com/v3 for production
  
  // Your app URLs
  CALLBACK_URL: process.env.REACT_APP_CALLBACK_URL || 'http://localhost:3000/payment-callback',
  NOTIFICATION_URL: process.env.REACT_APP_NOTIFICATION_URL || 'http://localhost:3000/api/pesapal-ipn'
}

// Payment service functions
export const pesapalService = {
  // Generate OAuth token for Pesapal API
  async getAccessToken() {
    try {
      console.log('🔑 Getting Pesapal access token...')
      
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
      })
      
      const data = await response.json()
      
      if (data.status === '200') {
        console.log('✅ Pesapal token obtained')
        return data.token
      } else {
        throw new Error(data.message || 'Failed to get access token')
      }
    } catch (error) {
      console.error('❌ Error getting Pesapal token:', error)
      throw error
    }
  },

  // Register IPN URL with Pesapal
  async registerIPN(token) {
    try {
      console.log('📡 Registering IPN URL with Pesapal...')
      
      const response = await fetch(`${pesapalConfig.PESAPAL_BASE_URL}/api/URLSetup/RegisterIPN`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          url: pesapalConfig.NOTIFICATION_URL,
          ipn_notification_type: 'GET'
        })
      })
      
      const data = await response.json()
      
      if (data.status === '200') {
        console.log('✅ IPN URL registered:', data.ipn_id)
        return data.ipn_id
      } else {
        throw new Error(data.message || 'Failed to register IPN')
      }
    } catch (error) {
      console.error('❌ Error registering IPN:', error)
      throw error
    }
  },

  // Submit payment order to Pesapal
  async submitPaymentOrder(token, ipnId, orderData) {
    try {
      console.log('💳 Submitting payment order to Pesapal...', orderData)
      
      const pesapalOrder = {
        id: orderData.orderId,
        currency: 'KES',
        amount: orderData.amount,
        description: orderData.description,
        callback_url: pesapalConfig.CALLBACK_URL,
        notification_id: ipnId,
        billing_address: {
          email_address: orderData.email,
          phone_number: orderData.phone || '',
          country_code: 'KE',
          first_name: orderData.firstName || orderData.email.split('@')[0],
          last_name: orderData.lastName || 'User',
          line_1: orderData.address || 'Nairobi, Kenya',
          city: 'Nairobi',
          state: 'Nairobi',
          postal_code: '00100'
        }
      }
      
      const response = await fetch(`${pesapalConfig.PESAPAL_BASE_URL}/api/Transactions/SubmitOrderRequest`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(pesapalOrder)
      })
      
      const data = await response.json()
      
      if (data.status === '200') {
        console.log('✅ Payment order submitted:', data.order_tracking_id)
        return {
          success: true,
          orderTrackingId: data.order_tracking_id,
          redirectUrl: data.redirect_url
        }
      } else {
        throw new Error(data.message || 'Failed to submit payment order')
      }
    } catch (error) {
      console.error('❌ Error submitting payment order:', error)
      return {
        success: false,
        error: error.message
      }
    }
  },

  // Check payment status
  async getPaymentStatus(token, orderTrackingId) {
    try {
      console.log('🔍 Checking payment status for:', orderTrackingId)
      
      const response = await fetch(
        `${pesapalConfig.PESAPAL_BASE_URL}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
          }
        }
      )
      
      const data = await response.json()
      
      if (data.status === '200') {
        return {
          success: true,
          paymentStatus: data.payment_status_description,
          paymentMethod: data.payment_method,
          amount: data.amount,
          currency: data.currency,
          merchantReference: data.merchant_reference,
          paymentAccount: data.payment_account,
          confirmed: data.payment_status_description === 'Completed'
        }
      } else {
        throw new Error(data.message || 'Failed to get payment status')
      }
    } catch (error) {
      console.error('❌ Error checking payment status:', error)
      return {
        success: false,
        error: error.message
      }
    }
  },

  // Complete payment flow
  async initiatePayment(userEmail, planType = 'premium') {
    try {
      // Plan configurations
      const plans = {
        premium: {
          amount: 499, // KES 499 for monthly premium
          description: 'VocabVoyager Premium - Monthly Subscription',
          duration: 30 // days
        }
      }
      
      const selectedPlan = plans[planType]
      if (!selectedPlan) {
        throw new Error('Invalid plan type')
      }
      
      // Generate unique order ID
      const orderId = `VV_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      // Step 1: Get access token
      const token = await this.getAccessToken()
      
      // Step 2: Register IPN (you might want to cache this)
      const ipnId = await this.registerIPN(token)
      
      // Step 3: Submit payment order
      const orderData = {
        orderId,
        amount: selectedPlan.amount,
        description: selectedPlan.description,
        email: userEmail,
        phone: '', // You can collect this in a form
        firstName: userEmail.split('@')[0],
        lastName: 'User'
      }
      
      const paymentResult = await this.submitPaymentOrder(token, ipnId, orderData)
      
      if (paymentResult.success) {
        // Store order in localStorage for callback handling
        localStorage.setItem('pending_payment', JSON.stringify({
          orderId,
          orderTrackingId: paymentResult.orderTrackingId,
          email: userEmail,
          planType,
          amount: selectedPlan.amount,
          timestamp: Date.now()
        }))
        
        return {
          success: true,
          redirectUrl: paymentResult.redirectUrl,
          orderTrackingId: paymentResult.orderTrackingId
        }
      } else {
        throw new Error(paymentResult.error)
      }
      
    } catch (error) {
      console.error('❌ Payment initiation failed:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
}

// Payment verification service (for callback handling)
export const paymentVerificationService = {
  async verifyPayment(orderTrackingId) {
    try {
      const token = await pesapalService.getAccessToken()
      const status = await pesapalService.getPaymentStatus(token, orderTrackingId)
      
      return status
    } catch (error) {
      console.error('❌ Payment verification failed:', error)
      return {
        success: false,
        error: error.message
      }
    }
  },

  // Handle payment callback from Pesapal
  handlePaymentCallback(urlParams) {
    const orderTrackingId = urlParams.get('OrderTrackingId')
    const merchantReference = urlParams.get('OrderMerchantReference')
    
    if (!orderTrackingId) {
      return {
        success: false,
        error: 'Missing order tracking ID'
      }
    }
    
    return {
      success: true,
      orderTrackingId,
      merchantReference
    }
  }
}