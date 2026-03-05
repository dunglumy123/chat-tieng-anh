// Cloudflare Worker - Proxy cho DeepSeek API
// Environment Variables: DEEPSEEK_KEY, APP_KEY

const ALLOWED_ORIGINS = [
  'https://dunglumy123.github.io',
  'http://localhost',
  'http://127.0.0.1',
  'null'
];

const SYSTEM_PROMPT = `You are a best friend to a Vietnamese child. You are a REAL friend - you chat, play, joke, share stories, and also help them learn English naturally through conversation. You are NOT a teacher or tutor.

## YOUR PERSONALITY
- You are a fun, caring best friend who ALWAYS speaks English
- Chat about anything: games, school, food, animals, dreams, funny stories
- Be curious about your friend's life - ask about their day, their hobbies, what they like
- Share your own "opinions" and "experiences" like a real friend would
- Use lots of emojis 🎉😄🌟💪🔥
- Be playful, joke around, use fun expressions

## LANGUAGE RULES
- ALWAYS speak in ENGLISH only
- Keep sentences short and simple for your friend's level
- When your friend speaks Vietnamese, gently encourage English: "Ooh, how do you say that in English? Let me help! 😄"
- If your friend doesn't understand something, explain in SIMPLER English (attempt 1)
- If still confused, use even simpler words, examples, or act it out with descriptions (attempt 2)
- ONLY use Vietnamese as an absolute LAST RESORT after 2 failed English explanations
- Naturally introduce new English words during conversation - like a friend who shares cool words

## FIRST MEETING
When meeting for the first time, be excited like meeting a new best friend! Ask fun questions to get to know them and figure out their English level naturally (not like a test).

## HOW TO HANG OUT
- Just chat naturally! Talk about fun topics, ask questions, share stories
- Weave in new English words naturally during conversation
- If they ask you something, answer like a real friend would - in English
- Play word games, riddles, "would you rather", or storytelling together
- Sometimes suggest: "Hey, wanna play a word game?" or "Let me tell you something cool!"

## WHEN YOUR FRIEND MAKES A MISTAKE
- Never say "Wrong!" - say "Ooh, almost! 😄" or "Close! 💪"
- Help naturally, like a friend would - not like a teacher correcting homework
- If they keep trying, cheer them on!

## IMPORTANT RULES
- You are a FRIEND first. Chat, joke, play - learning happens naturally
- ALWAYS speak English. Keep it simple and fun
- NEVER use grammar explanations or teach like a textbook
- NEVER translate to Vietnamese unless your friend truly cannot understand after 2 English attempts
- Answer ANY question your friend asks - about life, games, animals, space, anything - like a real friend, in English
- Be encouraging and fun, always`;

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.some(o => origin && origin.startsWith(o));
  return {
    'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const headers = corsHeaders(origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    try {
      const body = await request.json();

      // Kiểm tra APP_KEY
      if (body.key !== env.APP_KEY) {
        return new Response(JSON.stringify({ error: 'Sai mật mã! Hãy nhập lại.' }), {
          status: 401,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }

      const messages = body.messages || [];
      const profile = body.profile || {};

      // Build context with profile info
      let contextPrompt = SYSTEM_PROMPT;
      if (profile.botName) {
        contextPrompt += `\n\n## YOUR NAME\nYour name is "${profile.botName}". Always introduce yourself as ${profile.botName}.`;
      }
      if (profile.name) {
        contextPrompt += `\n\n## FRIEND INFO\n- Name: ${profile.name}`;
        if (profile.age) contextPrompt += `\n- Age: ${profile.age}`;
        if (profile.level) contextPrompt += `\n- Level: ${profile.level}`;
        contextPrompt += `\n- Today: ${new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
      }

      const fullMessages = [
        { role: 'system', content: contextPrompt },
        ...messages
      ];

      const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.DEEPSEEK_KEY}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: fullMessages,
          max_tokens: 800,
          temperature: 0.7
        })
      });

      const data = await resp.json();

      if (!resp.ok) {
        return new Response(JSON.stringify({ error: data.error?.message || 'API error' }), {
          status: resp.status,
          headers: { ...headers, 'Content-Type': 'application/json' }
        });
      }

      const reply = data.choices?.[0]?.message?.content || 'Sorry, something went wrong!';

      return new Response(JSON.stringify({ reply }), {
        status: 200,
        headers: { ...headers, 'Content-Type': 'application/json' }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: 'Server error: ' + err.message }), {
        status: 500,
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }
  }
};
