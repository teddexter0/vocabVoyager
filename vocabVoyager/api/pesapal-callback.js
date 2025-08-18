// vocabVoyager/api/pesapal-callback.js - COMPLETE FILE
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    console.log('💳 Payment callback received:', req.query);

    const { OrderTrackingId, OrderMerchantReference } = req.query;

    if (!OrderTrackingId) {
      console.error('❌ No OrderTrackingId in callback');
      return res.status(400).json({ error: 'Missing OrderTrackingId' });
    }

    // 🔒 VERIFY PAYMENT WITH PESAPAL
    const isVerified = await verifyPaymentWithPesapal(OrderTrackingId);
    
    if (isVerified.success && isVerified.confirmed) {
      // ✅ PAYMENT VERIFIED - Update database
      await updatePaymentStatus(OrderTrackingId, 'completed', isVerified.data);
      
      console.log('✅ Payment verified and user upgraded to premium');
      
      // Redirect to success page
      const successUrl = process.env.NODE_ENV === 'production'
        ? `https://${req.headers.host}?payment_success=1&OrderTrackingId=${OrderTrackingId}`
        : `http://localhost:3000?payment_success=1&OrderTrackingId=${OrderTrackingId}`;
      
      res.redirect(302, successUrl);
    } else {
      // ❌ PAYMENT FAILED
      await updatePaymentStatus(OrderTrackingId, 'failed', isVerified.data);
      
      console.log('❌ Payment verification failed');
      
      // Redirect to failure page
      const failureUrl = process.env.NODE_ENV === 'production'
        ? `https://${req.headers.host}?payment_failed=1&OrderTrackingId=${OrderTrackingId}`
        : `http://localhost:3000?payment_failed=1&OrderTrackingId=${OrderTrackingId}`;
      
      res.redirect(302, failureUrl);
    }

  } catch (error) {
    console.error('❌ Payment callback error:', error);
    
    // Log error but still redirect to prevent user confusion
    const errorUrl = process.env.NODE_ENV === 'production'
      ? `https://${req.headers.host}?payment_error=1`
      : `http://localhost:3000?payment_error=1`;
    
    res.redirect(302, errorUrl);
  }
}

// 🔒 VERIFY PAYMENT WITH PESAPAL API
async function verifyPaymentWithPesapal(orderTrackingId) {
  try {
    // Get access token
    const tokenResponse = await fetch('https://pay.pesapal.com/v3/api/Auth/RequestToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        consumer_key: process.env.REACT_APP_PESAPAL_CONSUMER_KEY,
        consumer_secret: process.env.REACT_APP_PESAPAL_CONSUMER_SECRET
      })
    });

    if (!tokenResponse.ok) {
      throw new Error('Failed to get Pesapal token');
    }

    const tokenData = await tokenResponse.json();
    const token = tokenData.token;

    // Verify payment status
    const statusResponse = await fetch(
      `https://pay.pesapal.com/v3/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        }
      }
    );

    if (!statusResponse.ok) {
      throw new Error('Failed to get payment status');
    }

    const statusData = await statusResponse.json();
    
    return {
      success: true,
      confirmed: statusData.payment_status_description === 'Completed',
      data: statusData
    };

  } catch (error) {
    console.error('❌ Payment verification failed:', error);
    return {
      success: false,
      confirmed: false,
      error: error.message
    };
  }
}

// 🔒 UPDATE PAYMENT STATUS IN DATABASE
async function updatePaymentStatus(orderTrackingId, status, paymentData) {
  try {
    // Find the payment record
    const { data: payment, error: findError } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('pesapal_tracking_id', orderTrackingId)
      .single();

    if (findError) {
      console.error('❌ Payment record not found:', findError);
      return false;
    }

    // Extract phone from payment data if Pesapal provides it
    const extractedPhone = paymentData?.phone_number || paymentData?.billing_address?.phone_number || null;

    // Update payment status
    const { error: updateError } = await supabase
      .from('payment_transactions')
      .update({
        status: status,
        pesapal_status: paymentData?.payment_status_description,
        payment_method: paymentData?.payment_method,
        phone: extractedPhone, // Save the real phone number Pesapal used
        verified_at: new Date().toISOString(),
        metadata: paymentData || {}
      })
      .eq('id', payment.id);

    if (updateError) {
      console.error('❌ Failed to update payment:', updateError);
      return false;
    }

    // If payment completed, update user premium status
    if (status === 'completed') {
      const { error: progressError } = await supabase
        .from('user_progress')
        .upsert({
          user_id: payment.user_id,
          is_premium: true,
          premium_until: new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)).toISOString(),
          updated_at: new Date().toISOString()
        });

      if (progressError) {
        console.error('❌ Failed to update user premium status:', progressError);
      }
    }

    return true;

  } catch (error) {
    console.error('❌ Database update failed:', error);
    return false;
  }
}