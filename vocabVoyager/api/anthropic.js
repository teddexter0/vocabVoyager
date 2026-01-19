// api/anthropic.js - FIXED VERSION WITH PROPER RETURNS AND LOGGING

export default async function handler(req, res) {
  // Add CORS headers for local testing
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow POST
  if (req.method !== 'POST') {
    console.log('❌ Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('📥 Received request');
    const { messages } = req.body;

    // Validate input
    if (!messages || !Array.isArray(messages)) {
      console.log('❌ Invalid messages format');
      return res.status(400).json({ 
        error: 'Invalid request: messages array required' 
      });
    }

    console.log('📝 Messages:', JSON.stringify(messages));

    // Check API key
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('⚠️ ANTHROPIC_API_KEY not configured in Vercel');
      return res.status(200).json({ 
        text: "AI features are being configured. Your vocabulary learning continues below!" 
      });
    }

    console.log('🔑 API key found, calling Anthropic...');

    // Call Anthropic API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: messages
      })
    });

    console.log('📡 Anthropic response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Anthropic API error:', response.status, errorText);
      return res.status(200).json({ 
        text: `AI request failed (${response.status}). Your learning continues!` 
      });
    }

    const data = await response.json();
    console.log('✅ Anthropic response:', JSON.stringify(data));

    // Extract text from response
    const text = data.content?.[0]?.text || "AI response unavailable";
    
    console.log('📤 Sending response:', text.substring(0, 100) + '...');

    // ✅ CRITICAL: Must return here!
    return res.status(200).json({ text });

  } catch (error) {
    console.error('❌ Exception in handler:', error);
    
    // ✅ CRITICAL: Must return here too!
    return res.status(200).json({ 
      text: "AI features temporarily unavailable. Your learning experience continues below!" 
    });
  }
}