// Cloudflare Worker - Proxy cho DeepSeek API
// Deploy lên Cloudflare Workers, thêm Environment Variable: DEEPSEEK_KEY

const ALLOWED_ORIGINS = [
  'https://dunglumy123.github.io',
  'http://localhost',
  'http://127.0.0.1',
  'null' // for local file:// testing
];

const SYSTEM_PROMPT = `Bạn là giáo viên tiếng Anh thân thiện cho trẻ em Việt Nam lớp 3.
- Khi bé viết tiếng Việt: giúp dịch sang tiếng Anh, giải thích đơn giản
- Khi bé viết tiếng Anh: khen ngợi, sửa lỗi nhẹ nhàng nếu có
- Dạy từ mới kèm phiên âm đơn giản
- Trả lời ngắn gọn (2-4 câu), dùng emoji cho vui
- Khuyến khích bé nói tiếng Anh nhiều hơn
- Nếu bé hỏi ngoài chủ đề, nhẹ nhàng dẫn về học tiếng Anh`;

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

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers });
    }

    // Only allow POST
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...headers, 'Content-Type': 'application/json' }
      });
    }

    try {
      const body = await request.json();
      const messages = body.messages || [];

      // Prepend system prompt
      const fullMessages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...messages
      ];

      // Call DeepSeek API
      const resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${env.DEEPSEEK_KEY}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: fullMessages,
          max_tokens: 500,
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

      const reply = data.choices?.[0]?.message?.content || 'Xin lỗi, có lỗi xảy ra!';

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
