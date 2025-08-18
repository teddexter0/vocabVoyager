// api/pesapal.js - Vercel Serverless Function
// This handles Pesapal API calls server-side to avoid CORS issues

export default async function handler(req, res) {
  // ✅ CORS Headers for production
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Only allow POST requests for API calls
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { pesapalData, pesapalEndpoint, pesapalMethod } = req.body;

    if (!pesapalEndpoint) {
      return res.status(400).json({ error: 'Missing Pesapal endpoint' });
    }

    // Environment variables (set in Vercel dashboard)
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

    // Prepare the request to Pesapal
    const pesapalUrl = `${PESAPAL_BASE_URL}${pesapalEndpoint}`;
    
    const fetchOptions = {
      method: pesapalMethod || 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      }
    };

    // Add authorization header if we have token data
    if (pesapalData && typeof pesapalData === 'object') {
      // Check if this is an auth request
      if (pesapalEndpoint.includes('/api/Auth/RequestToken')) {
        fetchOptions.body = JSON.stringify({
          consumer_key: CONSUMER_KEY,
          consumer_secret: CONSUMER_SECRET
        });
      } else {
        // For other requests, include the data as-is
        fetchOptions.body = JSON.stringify(pesapalData);
        
        // If pesapalData has a token field, use it for authorization
        if (pesapalData.token) {
          fetchOptions.headers['Authorization'] = `Bearer ${pesapalData.token}`;
        }
      }
    }

    console.log(`📡 Making request to Pesapal: ${pesapalMethod} ${pesapalUrl}`);

    // Make the request to Pesapal
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
    
    // Return the Pesapal response
    return res.status(200).json(data);

  } catch (error) {
    console.error('❌ Serverless function error:', error);
    
    // Provide detailed error information for debugging
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

// ✅ IMPORTANT: This config ensures the function works properly
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
}