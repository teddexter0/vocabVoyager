// api/pesapal-callback.js - Payment Callback Handler
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

    // Log the payment callback for monitoring
    console.log(`📊 Payment callback: ${OrderTrackingId}`);

    // In a real implementation, you might want to:
    // 1. Verify the payment with Pesapal
    // 2. Update the user's subscription in your database
    // 3. Send confirmation email
    
    // For now, we'll redirect back to the app with the tracking ID
    const redirectUrl = process.env.NODE_ENV === 'production'
      ? `https://${req.headers.host}?OrderTrackingId=${OrderTrackingId}`
      : `http://localhost:3000?OrderTrackingId=${OrderTrackingId}`;

    // Redirect user back to the app
    res.redirect(302, redirectUrl);

  } catch (error) {
    console.error('❌ Payment callback error:', error);
    
    // Redirect to app with error
    const errorUrl = process.env.NODE_ENV === 'production'
      ? `https://${req.headers.host}?payment_error=1`
      : `http://localhost:3000?payment_error=1`;
    
    res.redirect(302, errorUrl);
  }
}