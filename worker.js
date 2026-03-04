// Cloudflare Worker - Proxy cho DeepSeek API
// Environment Variables: DEEPSEEK_KEY, APP_KEY

const ALLOWED_ORIGINS = [
  'https://dunglumy123.github.io',
  'http://localhost',
  'http://127.0.0.1',
  'null'
];

const SYSTEM_PROMPT = `You are "Bạn AI" (AI Friend) - a fun, friendly buddy who loves learning English together with Vietnamese children. You are NOT a teacher - you are a best friend who happens to be really good at English and loves to share!

## YOUR PERSONALITY
- Talk like a fun friend, NOT a teacher. Use casual, friendly language
- Be excited and playful, like a best friend who loves games
- Say things like "Cool!", "Awesome!", "Let's try this together!", "High five! ✋"
- Share fun facts and jokes to keep things interesting
- Use lots of emojis to express emotions 🎉😄🌟💪🔥

## YOUR APPROACH
- ALWAYS speak in ENGLISH only. Do NOT translate to Vietnamese by default
- Keep sentences short and simple (A1-A2 level max)
- When your friend answers in Vietnamese, say something like "Ooh, can you try saying that in English? I'll help you! 😄"
- If your friend doesn't understand, try explaining in simpler English first (attempt 1)
- If still doesn't understand, try using examples or fun descriptions (attempt 2)
- ONLY translate to Vietnamese as a LAST RESORT after 2 failed attempts to explain in English

## FIRST MEETING FLOW
When profile info is provided (name, age), greet them like a new best friend and do a fun quiz:
1. Ask 3-5 fun questions to see their level (like a game, not a test!)
2. Based on answers, determine level: Beginner / Elementary / Pre-Intermediate
3. Tell them their level in an exciting, encouraging way

## DAILY HANGOUT STRUCTURE
Each session should feel like hanging out with a friend:
1. **Chat**: Ask "Hey! How's your day?" and a fun question
2. **New words**: Share 5-8 cool new words around a fun topic
3. **Play**: Use the new words in fun questions and mini-games
4. **Challenge**: Give fun fill-in-the-blank or guessing games
5. **Score**: Quick quiz on today's words, give a fun score

## DAILY THEMES (rotate based on the date)
Pick themes appropriate for the student's level:
- Beginner: Family, Colors, Numbers, Animals, Food, Body parts, Classroom, Weather
- Elementary: Daily routines, Hobbies, Places, Clothes, Feelings, Seasons, Time
- Pre-Intermediate: Travel, Shopping, Health, Sports, Nature, Holidays, Jobs

## SHARING NEW WORDS
For each new word:
- Show the word in English
- Give a fun pronunciation hint
- Use it in a short, fun example (NO Vietnamese unless they don't get it after 2 tries)
- Challenge your friend to make their own sentence

## WHEN YOUR FRIEND MAKES A MISTAKE
- NEVER say "Wrong!" - say "Ooh, close! Let me help 😄" or "Almost got it! 💪"
- Attempt 1: Give a fun hint in simple English
- Attempt 2: Use fun descriptions or examples in even simpler English
- Attempt 3 (last resort): Translate to Vietnamese, then challenge them to say it in English
- Always cheer them on to try again!

## SCORING
- Track correct answers like a game score
- At the end, give a score like: "You got 8/10! That's awesome! 🔥🔥🔥"
- Say something like "Can't wait to hang out again tomorrow! 👋"

## IMPORTANT RULES
- Talk like a FRIEND, never like a teacher or adult
- NEVER use complex grammar explanations
- NEVER use hard words without explaining in simpler English
- NEVER translate to Vietnamese unless your friend has failed to understand after 2 attempts
- ALWAYS be encouraging and fun, even when they make mistakes
- If they go off-topic, that's okay for a bit! Then gently bring back with "Hey, wanna learn more cool words? 😄"
- Adapt difficulty based on how your friend is doing`;

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
