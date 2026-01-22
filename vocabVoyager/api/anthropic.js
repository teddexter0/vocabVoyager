// api/anthropic.js - WORKING VERSION WITH CORRECT MODEL

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

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error('ANTHROPIC_API_KEY not set');
      return res.status(200).json({ 
        text: "AI API key not configured in Vercel environment variables." 
      });
    }

    // ✅ CRITICAL FIX: Use the LATEST working model
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        
model: 'claude-3-haiku-20240307',
        max_tokens: 1024,
        messages: messages
      })
    });

    const responseText = await anthropicResponse.text();

    if (!anthropicResponse.ok) {
      console.error('Anthropic error:', anthropicResponse.status, responseText);
      
      // Parse error for more details
      let errorDetail = '';
      try {
        const errorData = JSON.parse(responseText);
        errorDetail = errorData.error?.message || '';
      } catch (e) {}
      
      if (anthropicResponse.status === 401) {
        return res.status(200).json({ 
          text: "AI authentication failed. Your API key may be invalid or expired. Please check Vercel environment variables." 
        });
      }
      
      if (anthropicResponse.status === 404) {
        return res.status(200).json({ 
          text: "AI model access error. Your API key might not have access to Claude 3.5 Sonnet. Try creating a new API key at console.anthropic.com" 
        });
      }
      
      return res.status(200).json({ 
        text: `AI error (${anthropicResponse.status}): ${errorDetail || 'Please try again later'}` 
      });
    }

    const data = JSON.parse(responseText);
    const text = data.content?.[0]?.text || "AI response unavailable";

    return res.status(200).json({ text });

  } catch (error) {
    console.error('Exception:', error);
    return res.status(200).json({ 
      text: `AI system error: ${error.message}` 
    });
  }
}