// vocabVoyager/api/pesapal-callback.js - COMPLETE FILE
import { createClient } from '@supabase/supabase-js';

// Support both naming conventions for the service role key
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.REACT_APP_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase env vars in callback. Set SUPABASE_SERVICE_ROLE_KEY and REACT_APP_SUPABASE_URL in Vercel.');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
      await updatePaymentStatus(OrderTrackingId, 'completed', isVerified.data, OrderMerchantReference);

      console.log('✅ Payment verified and user upgraded to premium');

      // Redirect to success page
      const successUrl = process.env.NODE_ENV === 'production'
        ? `https://${req.headers.host}?payment_success=1&OrderTrackingId=${OrderTrackingId}`
        : `http://localhost:3000?payment_success=1&OrderTrackingId=${OrderTrackingId}`;

      res.redirect(302, successUrl);
    } else {
      // ❌ PAYMENT FAILED
      await updatePaymentStatus(OrderTrackingId, 'failed', isVerified.data, OrderMerchantReference);
      
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
async function updatePaymentStatus(orderTrackingId, status, paymentData, merchantReference) {
  try {
    // Find the payment record - try pesapal_tracking_id first, then fall back to order_id
    let payment = null;

    const { data: byTracking, error: trackingError } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('pesapal_tracking_id', orderTrackingId)
      .maybeSingle();

    if (byTracking) {
      payment = byTracking;
      console.log('✅ Found payment record by pesapal_tracking_id');
    } else if (merchantReference) {
      // Fallback: look up by our own order_id (OrderMerchantReference from Pesapal)
      const { data: byOrderId, error: orderIdError } = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('order_id', merchantReference)
        .maybeSingle();

      if (byOrderId) {
        payment = byOrderId;
        console.log('✅ Found payment record by order_id (fallback)');
        // Store the tracking id now that we have it
        await supabase
          .from('payment_transactions')
          .update({ pesapal_tracking_id: orderTrackingId })
          .eq('id', payment.id);
      }
    }

    if (!payment) {
      console.error('❌ Payment record not found for tracking id:', orderTrackingId, 'merchant ref:', merchantReference);
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
      const premiumUntil = new Date(Date.now() + (30 * 24 * 60 * 60 * 1000)).toISOString();

      // Try UPDATE first (user already has a progress row after sign-up)
      const { data: updatedRow, error: updateError } = await supabase
        .from('user_progress')
        .update({
          is_premium: true,
          premium_until: premiumUntil,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', payment.user_id)
        .select()
        .single();

      if (updateError || !updatedRow) {
        // Row doesn't exist yet - upsert with all required fields
        console.warn('⚠️ user_progress row not found, upserting with defaults');
        const { error: upsertError } = await supabase
          .from('user_progress')
          .upsert({
            user_id: payment.user_id,
            streak: 1,
            words_learned: 0,
            current_level: 1,
            total_days: 1,
            is_premium: true,
            premium_until: premiumUntil,
            last_visit: new Date().toISOString().split('T')[0],
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });

        if (upsertError) {
          console.error('❌ Failed to upsert user premium status:', upsertError);
        } else {
          console.log('✅ user_progress created with premium status');
        }
      } else {
        console.log('✅ user_progress updated to premium for user:', payment.user_id);
      }
    }

    return true;

  } catch (error) {
    console.error('❌ Database update failed:', error);
    return false;
  }
}