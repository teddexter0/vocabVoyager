

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid request: messages array required' });
    }

    // Check if API key is configured
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('⚠️ ANTHROPIC_API_KEY not configured in Vercel environment variables');
      return res.status(200).json({ 
        text: "AI features are being configured. Your vocabulary learning continues below!" 
      });
    }

    // Call Anthropic API from server-side (secure)
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY, // ✅ This is the correct header
        'anthropic-version': '2023-06-01' // ✅ Latest stable version
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022', // ✅ Latest Sonnet model (Jan 2025)
        max_tokens: 1024,
        messages: messages
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Anthropic API error:', response.status, errorText);
      throw new Error(`Anthropic API returned ${response.status}`);
    }

    const data = await response.json();
    
    // Extract text from Anthropic response format
    const text = data.content?.[0]?.text || "AI response unavailable";
    
    // Return just the text string
    res.status(200).json({ text });

  } catch (error) {
    console.error('❌ Anthropic API error:', error);
    
    // Return graceful fallback instead of error
    res.status(200).json({ 
      text: "AI features temporarily unavailable. Your learning experience continues below!" 
    });
  }
}