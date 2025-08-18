// vocabVoyager/api/pesapal.js - FIXED VERSION
export default async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { pesapalData, pesapalEndpoint, pesapalMethod } = req.body;

    if (!pesapalEndpoint) {
      return res.status(400).json({ error: 'Missing Pesapal endpoint' });
    }

    const PESAPAL_BASE_URL = process.env.NODE_ENV === 'production' 
      ? 'https://pay.pesapal.com/v3'
      : 'https://cybqa.pesapal.com/pesapalv3';

    const CONSUMER_KEY = process.env.REACT_APP_PESAPAL_CONSUMER_KEY;
    const CONSUMER_SECRET = process.env.REACT_APP_PESAPAL_CONSUMER_SECRET;

    if (!CONSUMER_KEY || !CONSUMER_SECRET) {
      console.error('❌ Missing Pesapal credentials');
      return res.status(500).json({ 
        error: 'Payment system configuration error',
        details: 'Missing API credentials'
      });
    }

    const pesapalUrl = `${PESAPAL_BASE_URL}${pesapalEndpoint}`;
    
    const fetchOptions = {
      method: pesapalMethod || 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      }
    };

    // ✅ CRITICAL FIX: Handle phone number correctly
    if (pesapalData && typeof pesapalData === 'object') {
      if (pesapalEndpoint.includes('/api/Auth/RequestToken')) {
        fetchOptions.body = JSON.stringify({
          consumer_key: CONSUMER_KEY,
          consumer_secret: CONSUMER_SECRET
        });
      } else {
        // ✅ For payment orders, preserve the phone number!
        console.log('📱 Received payment data with phone:', pesapalData.billing_address?.phone_number);
        fetchOptions.body = JSON.stringify(pesapalData);
        
        if (pesapalData.token) {
          fetchOptions.headers['Authorization'] = `Bearer ${pesapalData.token}`;
        }
      }
    }

    console.log(`📡 Making request to Pesapal: ${pesapalMethod} ${pesapalUrl}`);
    console.log('📱 Request body phone:', JSON.parse(fetchOptions.body || '{}')?.billing_address?.phone_number);

    const response = await fetch(pesapalUrl, fetchOptions);
    
    if (!response.ok) {
      console.error(`❌ Pesapal API error: ${response.status} ${response.statusText}`);
      
      let errorDetails;
      try {
        errorDetails = await response.text();
      } catch (e) {
        errorDetails = 'Unknown error';
      }
      
      return res.status(response.status).json({
        error: `Pesapal API error: ${response.statusText}`,
        details: errorDetails,
        status: response.status
      });
    }

    const data = await response.json();
    console.log('✅ Pesapal API response received');
    
    return res.status(200).json(data);

  } catch (error) {
    console.error('❌ Serverless function error:', error);
    
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}