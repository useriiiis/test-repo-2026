/* ==========================================================================
   Stop Oversharing — Game + AI Chat Logic
   ========================================================================== */

/* ============ PRIVACY MINI-GAME ============ */

const posts = [
  {
    avatar: "😎",
    username: "leo_hs18",
    content: "Just got home at 23 Flower Road! Empty house tonight 🏠 parents out until Sunday 🎉",
    meta: "📍 23 Flower Road · 2 min ago",
    safe: false,
    explanation: "❌ DANGER: You just told strangers your <b>exact address</b> AND that <b>nobody is home</b>. This is a textbook invitation for burglars. Never post live locations when you're alone."
  },
  {
    avatar: "📚",
    username: "leo_hs18",
    content: "Studying for the DSE finals this week. Wish me luck guys!",
    meta: "🕐 Just now",
    safe: true,
    explanation: "✅ SAFE: No location, no sensitive info, no personal data. This is normal sharing that doesn't expose you to risk."
  },
  {
    avatar: "🎂",
    username: "leo_hs18",
    content: "18th birthday today! 🎉 Born on March 15, 2008 — celebrating at my usual spot, Starbucks Sai Ying Pun. My mom's maiden name got me this cake 😂 thanks mom (Wong Mei-ling)!",
    meta: "📍 Starbucks · 5 min ago",
    safe: false,
    explanation: "❌ CRITICAL LEAK: Full birthday + location + mother's maiden name = <b>3 out of 3 common bank security questions</b>. Hackers can literally reset your bank password from this post. (Zhu et al., 2025)"
  },
  {
    avatar: "🎮",
    username: "leo_hs18",
    content: "Finally beat the new game boss after 3 hours 🎮 what a grind",
    meta: "🕐 1h ago",
    safe: true,
    explanation: "✅ SAFE: Opinion/hobby sharing with zero personal identifiers. Safe to post publicly."
  },
  {
    avatar: "🏫",
    username: "leo_hs18",
    content: "Room 301, Block B, every Monday 2 PM - math class is killing me 😩 #Form6 #DSELife",
    meta: "🏫 School · 10 min ago",
    safe: false,
    explanation: "❌ COMBINED RISK: Exact schedule + exact location = anyone can find you at that time. Combined with other posts, this reveals your full routine. (Nicol et al., 2022)"
  }
];

let currentRound = 0;
let score = 0;

function loadPost() {
  const post = posts[currentRound];
  document.getElementById('round').textContent = currentRound + 1;
  document.getElementById('game-card').innerHTML = `
    <div class="fake-post">
      <div class="fake-post-header">
        <div class="fake-avatar">${post.avatar}</div>
        <div>
          <div>@${post.username}</div>
          <div style="font-size:11px;color:#888;font-weight:400;">Instagram</div>
        </div>
      </div>
      <div class="fake-post-content">${post.content}</div>
      <div class="fake-post-meta">${post.meta}</div>
    </div>
  `;
  document.getElementById('game-result').classList.add('hidden');
  document.getElementById('game-buttons').style.display = 'flex';
}

function answer(choice) {
  const post = posts[currentRound];
  const userSaysSafe = (choice === 'share');
  const correct = (userSaysSafe === post.safe);

  if (correct) score++;
  document.getElementById('score').textContent = score;

  // update risk meter
  const wrongs = (currentRound + 1) - score;
  const riskEl = document.getElementById('risk');
  if (wrongs === 0) { riskEl.textContent = 'LOW'; riskEl.className = 'risk-low'; }
  else if (wrongs <= 2) { riskEl.textContent = 'MEDIUM'; riskEl.className = 'risk-mid'; }
  else { riskEl.textContent = 'HIGH'; riskEl.className = 'risk-high'; }

  const result = document.getElementById('game-result');
  result.innerHTML = `
    <div style="font-weight:700;font-size:18px;margin-bottom:8px;">
      ${correct ? '🎉 Correct!' : '⚠️ Wrong!'}
    </div>
    <div>${post.explanation}</div>
    <button class="btn btn-primary" style="margin-top:16px;" onclick="nextRound()">
      ${currentRound + 1 >= posts.length ? 'See Final Score →' : 'Next Post →'}
    </button>
  `;
  result.className = 'game-result ' + (correct ? 'result-correct' : 'result-wrong');
  document.getElementById('game-buttons').style.display = 'none';
}

function nextRound() {
  currentRound++;
  if (currentRound >= posts.length) {
    endGame();
  } else {
    loadPost();
  }
}

function endGame() {
  document.getElementById('game-card').classList.add('hidden');
  document.getElementById('game-buttons').classList.add('hidden');
  document.getElementById('game-result').classList.add('hidden');
  const endEl = document.getElementById('game-end');
  endEl.classList.remove('hidden');
  document.getElementById('final-score').textContent = score;

  let verdict;
  if (score === 5) verdict = "🔒 <b>Privacy Pro!</b> You spotted every risk. Now help a friend do the same.";
  else if (score >= 3) verdict = "🛡️ <b>Good instincts</b> — but some leaks slipped through. Review your Instagram settings tonight.";
  else verdict = "🚨 <b>High risk!</b> Your posts could expose you to identity theft. Please read the Action Steps below — tonight.";
  document.getElementById('final-verdict').innerHTML = verdict;
}

function resetGame() {
  currentRound = 0;
  score = 0;
  document.getElementById('score').textContent = 0;
  document.getElementById('risk').textContent = 'LOW';
  document.getElementById('risk').className = 'risk-low';
  document.getElementById('game-card').classList.remove('hidden');
  document.getElementById('game-buttons').classList.remove('hidden');
  document.getElementById('game-end').classList.add('hidden');
  loadPost();
}

// start game on load
document.addEventListener('DOMContentLoaded', loadPost);


/* ============ DEEPSEEK AI CHAT ============ */
/* WARNING: For a public GitHub Pages demo, the API key is exposed in client-side JS.
   Please revoke / rotate this key immediately after your school presentation. */

const DEEPSEEK_API_KEY = "sk-a16821d80dcd4ceebc995d150e37d5d9";
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

const SYSTEM_PROMPT = `You are "Privacy AI", a friendly assistant for high school students (age 18) on the topic of social media privacy and oversharing.

Your job:
- Warn users about the risks of oversharing (identity theft, cyberbullying, stalkers, data leaks).
- Give SHORT, direct, and practical advice (max 4-5 sentences per reply).
- Use a friendly, Gen-Z-friendly tone with occasional emojis 🔒📱⚠️.
- When relevant, cite research briefly: Zhu et al. (2025) for identity-theft risk; Nicol et al. (2022) for how combined digital traces leak private info; Jia & Xu (2016) for how small privacy-setting changes help.
- Encourage small, realistic steps ("You don't need to quit social media, just adjust settings").
- Always end with one concrete action the user can take tonight.

Never: lecture, use corporate jargon, or give replies longer than 120 words.`;

const chatHistory = [
  { role: "system", content: SYSTEM_PROMPT }
];

function addMessage(role, text) {
  const chatBox = document.getElementById('chat-box');
  const isUser = (role === 'user');
  const div = document.createElement('div');
  div.className = 'msg ' + (isUser ? 'msg-user' : 'msg-ai');
  div.innerHTML = `
    <div class="msg-avatar">${isUser ? '🧑' : '🤖'}</div>
    <div class="msg-bubble">${text}</div>
  `;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
  return div;
}

function addTypingIndicator() {
  const chatBox = document.getElementById('chat-box');
  const div = document.createElement('div');
  div.className = 'msg msg-ai msg-typing';
  div.id = 'typing-indicator';
  div.innerHTML = `
    <div class="msg-avatar">🤖</div>
    <div class="msg-bubble">Privacy AI is thinking<span class="dots">...</span></div>
  `;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

function removeTypingIndicator() {
  const el = document.getElementById('typing-indicator');
  if (el) el.remove();
}

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text) return;

  addMessage('user', escapeHtml(text));
  chatHistory.push({ role: 'user', content: text });
  input.value = '';
  addTypingIndicator();

  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + DEEPSEEK_API_KEY
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: chatHistory,
        temperature: 0.7,
        max_tokens: 400
      })
    });
    removeTypingIndicator();

    if (!res.ok) {
      const errText = await res.text();
      addMessage('ai', `⚠️ API error (${res.status}). Please check the API key or network.<br><small>${escapeHtml(errText).slice(0,200)}</small>`);
      return;
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || "⚠️ No reply from AI.";
    chatHistory.push({ role: 'assistant', content: reply });
    addMessage('ai', formatReply(reply));
  } catch (err) {
    removeTypingIndicator();
    addMessage('ai', `⚠️ Network error: ${escapeHtml(err.message)}. Try again in a moment.`);
  }
}

function quickAsk(question) {
  const input = document.getElementById('chat-input');
  input.value = question;
  sendMessage();
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatReply(text) {
  // Minimal markdown: bold, line breaks
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\n/g, '<br>');
}
