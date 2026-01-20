// api/anthropic.js - CORRECTED MODEL AND ERROR HANDLING

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ 
        error: 'Invalid request: messages array required' 
      });
    }

    // Check API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('⚠️ ANTHROPIC_API_KEY not set');
      return res.status(200).json({ 
        text: "AI features are being configured. Check your Vercel environment variables!" 
      });
    }

    // ✅ FIXED: Use correct model name and API version
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022', // ✅ This should work
        max_tokens: 1024,
        messages: messages
      })
    });

    console.log('Anthropic status:', anthropicResponse.status);

    // Get response text for debugging
    const responseText = await anthropicResponse.text();
    console.log('Anthropic raw response:', responseText);

    if (!anthropicResponse.ok) {
      console.error('Anthropic API error:', anthropicResponse.status, responseText);
      
      // Check if it's an auth error
      if (anthropicResponse.status === 401) {
        return res.status(200).json({ 
          text: "AI authentication failed. Check your API key in Vercel settings." 
        });
      }
      
      // Check if it's a 404 (wrong endpoint/model)
      if (anthropicResponse.status === 404) {
        return res.status(200).json({ 
          text: "AI model not found. The API might have changed - contact support." 
        });
      }
      
      return res.status(200).json({ 
        text: `AI error (${anthropicResponse.status}). Please try again later.` 
      });
    }

    // Parse response
    const data = JSON.parse(responseText);
    const text = data.content?.[0]?.text || "AI response unavailable";

    return res.status(200).json({ text });

  } catch (error) {
    console.error('Exception:', error.message);
    return res.status(200).json({ 
      text: "AI temporarily unavailable. Your learning continues!" 
    });
  }
}