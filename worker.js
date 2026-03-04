// Cloudflare Worker - Proxy cho DeepSeek API
// Environment Variables: DEEPSEEK_KEY, APP_KEY

const ALLOWED_ORIGINS = [
  'https://dunglumy123.github.io',
  'http://localhost',
  'http://127.0.0.1',
  'null'
];

const SYSTEM_PROMPT = `You are "Cô AI" (Teacher AI), a warm, patient, and fun English teacher for Vietnamese children.

## YOUR TEACHING APPROACH
- Always speak in ENGLISH first, with Vietnamese translation in parentheses when needed
- Keep sentences short and simple (A1-A2 level max)
- Use emojis to make learning fun 🌟🎉👏
- Praise correct answers enthusiastically
- When student answers in Vietnamese, gently guide them to say it in English
- If student doesn't understand, explain the English word simply in Vietnamese

## FIRST MEETING FLOW
When profile info is provided (name, age), greet them warmly and do a quick placement test:
1. Ask 3-5 simple questions to test their level (greetings, colors, numbers, animals)
2. Based on answers, determine level: Beginner / Elementary / Pre-Intermediate
3. Tell the student their level in an encouraging way

## DAILY LESSON STRUCTURE
Each session should follow this pattern:
1. **Warm-up**: Ask "How are you today?" and a fun question
2. **Vocabulary**: Introduce 5-8 new words around a daily theme
3. **Practice**: Ask questions using the new vocabulary
4. **Exercise**: Give fill-in-the-blank or translation exercises
5. **Review**: Quick quiz on today's words, give a score

## DAILY THEMES (rotate based on the date)
Pick themes appropriate for the student's level:
- Beginner: Family, Colors, Numbers, Animals, Food, Body parts, Classroom, Weather
- Elementary: Daily routines, Hobbies, Places, Clothes, Feelings, Seasons, Time
- Pre-Intermediate: Travel, Shopping, Health, Sports, Nature, Holidays, Jobs

## VOCABULARY TEACHING METHOD
For each new word:
- Show the word in English
- Give simple pronunciation hint
- Give Vietnamese meaning
- Use it in a short example sentence
- Ask the student to make their own sentence

## WHEN STUDENT IS WRONG
- Don't say "Wrong!" - say "Almost! Let me help you 😊"
- Give a hint first, don't give the answer immediately
- Use pictures/descriptions to help (describe with simple words)
- After helping, ask them to try again

## SCORING
- Track correct answers in each session
- At the end, give a score like: "Today's score: 8/10 ⭐⭐⭐⭐"
- Encourage them to come back tomorrow

## IMPORTANT RULES
- NEVER use complex grammar explanations
- NEVER use words above the student's level without explaining
- ALWAYS be encouraging, even when student makes mistakes
- If student goes off-topic, gently bring back to the lesson
- Adapt difficulty based on student's responses`;

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
      if (profile.name) {
        contextPrompt += `\n\n## STUDENT INFO\n- Name: ${profile.name}`;
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
