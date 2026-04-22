/* ==========================================================================
   Stop Oversharing — Game + AI Chat + Leaderboard
   by Mikey · EELC2010 · 2026
   ========================================================================== */

/* ============================================================
   GLOBAL LEADERBOARD (jsonblob.com — free, no signup)
   Each row: { name, score, total, timeSec, at }
   If the remote call fails we silently fall back to localStorage.
   ============================================================ */
const LB_ENDPOINT = 'https://jsonblob.com/api/jsonBlob/019db646-9c74-704b-be9c-743c25413253';
// ^ dedicated public blob for this project's leaderboard (works with GET + PUT, no auth).
//   If blob is gone / rate-limited, local leaderboard still works.

const LB_LOCAL_KEY = 'oversharing.lb.local.v2';
let globalBoardCache = null;   // in-memory cache to avoid hammering the API

async function fetchGlobalBoard() {
  if (globalBoardCache) return globalBoardCache;
  try {
    const r = await fetch(LB_ENDPOINT, { cache: 'no-store' });
    if (!r.ok) throw new Error('lb fetch ' + r.status);
    const data = await r.json();
    globalBoardCache = Array.isArray(data) ? data : (data.rows || []);
    return globalBoardCache;
  } catch (e) {
    console.warn('Global leaderboard unavailable, using local only.', e);
    return null;
  }
}

async function pushGlobalBoard(entry) {
  // Optimistic: update cache then send.
  const current = (await fetchGlobalBoard()) || [];
  const next = [...current, entry]
    .sort((a, b) => (b.score - a.score) || (a.timeSec - b.timeSec))
    .slice(0, 100);
  globalBoardCache = next;

  try {
    const r = await fetch(LB_ENDPOINT, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(next)
    });
    if (!r.ok) throw new Error('lb push ' + r.status);
    return true;
  } catch (e) {
    console.warn('Global leaderboard push failed.', e);
    return false;
  }
}

function getLocalBoard() {
  try {
    return JSON.parse(localStorage.getItem(LB_LOCAL_KEY) || '[]');
  } catch { return []; }
}
function saveLocalBoard(entry) {
  const arr = getLocalBoard();
  arr.push(entry);
  arr.sort((a, b) => (b.score - a.score) || (a.timeSec - b.timeSec));
  const trimmed = arr.slice(0, 50);
  try { localStorage.setItem(LB_LOCAL_KEY, JSON.stringify(trimmed)); } catch {}
}


/* ============================================================
   GAME: 8 QUESTIONS
   ============================================================ */
const questions = [
  {
    avatar: '😎',
    username: 'leo_hs18',
    body: 'Just got home at 23 Flower Road! Empty house tonight 🏠 parents out till Sunday 🎉',
    meta: '📍 23 Flower Road · just now',
    safe: false,
    why: "❌ <b>Danger.</b> You broadcast your exact address AND that no one is home — a textbook invitation for burglars. Never post live locations when you're alone. <small>(Zhu et al., 2025)</small>"
  },
  {
    avatar: '📚',
    username: 'leo_hs18',
    body: 'Studying for DSE finals this week. Wish me luck guys!',
    meta: '🕐 just now',
    safe: true,
    why: "✅ <b>Safe.</b> No location, no sensitive data, no personal identifiers. Sharing a general feeling or activity like this is low-risk."
  },
  {
    avatar: '🎂',
    username: 'leo_hs18',
    body: "18th birthday! 🎉 Born 15 March 2008. Celebrating at Starbucks Sai Ying Pun. Mom (Wong Mei-ling) got me the cake 😂",
    meta: '📍 Starbucks · 5 min ago',
    safe: false,
    why: "❌ <b>Critical leak.</b> Full birthday + mother's maiden name + location are <b>3 out of 3 common bank security answers</b>. A hacker can literally reset your bank password with this post. <small>(Zhu et al., 2025)</small>"
  },
  {
    avatar: '🎮',
    username: 'leo_hs18',
    body: 'Finally beat the new boss after 3 hours 🎮 what a grind.',
    meta: '🕐 1h ago',
    safe: true,
    why: "✅ <b>Safe.</b> Opinion / hobby sharing with zero personal identifiers. This is the kind of post social media is designed for."
  },
  {
    avatar: '🏫',
    username: 'leo_hs18',
    body: "Room 301, Block B, Monday 2 PM — math class is killing me 😩 #Form6 #DSELife",
    meta: '🏫 School · 10 min ago',
    safe: false,
    why: "❌ <b>Combined risk.</b> Exact classroom + exact time = anyone can find you. Combined with your other posts, this reveals your full weekly routine to strangers. <small>(Nicol et al., 2022)</small>"
  },
  {
    avatar: '💔',
    username: 'leo_hs18',
    body: "Tagged my bestie Ashley in last night's party pics at her house — she looked SO drunk lol, everyone needs to see 🍾",
    meta: '🏠 Tagged @ashley_k · 2h ago',
    safe: false,
    why: "❌ <b>Not your info to share.</b> You just exposed your friend's location, private behaviour, and face to everyone — without her permission. People are especially concerned about friends unintentionally making private info public. <small>(Jia &amp; Xu, 2016)</small>"
  },
  {
    avatar: '😔',
    username: 'leo_hs18',
    body: "Feeling really depressed and anxious lately. Been on antidepressants (Sertraline 50mg) since July. Just venting 💔",
    meta: '🕐 30 min ago',
    safe: false,
    why: "❌ <b>Sensitive health data.</b> Health and medication info can affect future job offers, insurance rates, and invites targeted scams. Share this with close friends / a DM, not publicly. <small>(Zhu et al., 2025)</small>"
  },
  {
    avatar: '✈️',
    username: 'leo_hs18',
    body: "Airport vibes! ✈️ 2-week trip to Japan starts NOW. House is empty. See you in April!",
    meta: '📍 HKIA · boarding soon',
    safe: false,
    why: "❌ <b>Announcing an empty home.</b> Telling strangers your home will be unoccupied for 2 weeks is one of the fastest ways to get burgled. Post your travel photos <b>after</b> you come back."
  }
];

let currentRound = 0;
let score = 0;
let startTs = 0;
let timerId = null;
let playerName = '';

function bootGameUI() {
  document.getElementById('game-start').classList.remove('hidden');
  document.getElementById('game-play').classList.add('hidden');
  document.getElementById('game-end').classList.add('hidden');
}

function startGame() {
  const input = document.getElementById('player-name');
  const name = (input.value || '').trim();
  if (!name) {
    input.style.borderColor = 'var(--coral)';
    input.placeholder = 'Please enter a name first';
    input.focus();
    return;
  }
  playerName = name.slice(0, 20);
  document.getElementById('hud-name').textContent = playerName;

  currentRound = 0;
  score = 0;
  document.getElementById('score').textContent = 0;

  document.getElementById('game-start').classList.add('hidden');
  document.getElementById('game-end').classList.add('hidden');
  document.getElementById('game-play').classList.remove('hidden');

  startTs = Date.now();
  if (timerId) clearInterval(timerId);
  timerId = setInterval(() => {
    const sec = Math.floor((Date.now() - startTs) / 1000);
    document.getElementById('timer').textContent = sec + 's';
  }, 500);

  loadRound();
}

function loadRound() {
  const q = questions[currentRound];
  document.getElementById('round').textContent = currentRound + 1;
  document.getElementById('progress-bar').style.width = ((currentRound) / questions.length * 100) + '%';
  document.getElementById('game-card').innerHTML = `
    <article class="fake-post">
      <div class="fp-head">
        <div class="fp-avatar">${q.avatar}</div>
        <div>
          <b>@${q.username}</b>
          <small>Instagram</small>
        </div>
      </div>
      <div class="fp-body">${q.body}</div>
      <div class="fp-meta">${q.meta}</div>
    </article>
  `;
  document.getElementById('game-result').classList.add('hidden');
  document.getElementById('game-buttons').style.display = 'grid';
}

function answer(choice) {
  const q = questions[currentRound];
  const userSaysSafe = (choice === 'share');
  const correct = (userSaysSafe === q.safe);
  if (correct) score++;
  document.getElementById('score').textContent = score;

  const r = document.getElementById('game-result');
  r.className = 'game-result ' + (correct ? 'correct' : 'wrong');
  r.innerHTML = `
    <div class="result-head">${correct ? '✓ Correct' : '✗ Wrong'}</div>
    <div class="result-text">${q.why}</div>
    <button class="btn btn-primary" style="margin-top:14px;" onclick="nextRound()">
      ${currentRound + 1 >= questions.length ? 'See results →' : 'Next post →'}
    </button>
  `;
  document.getElementById('game-buttons').style.display = 'none';
}

function nextRound() {
  currentRound++;
  if (currentRound >= questions.length) endGame();
  else loadRound();
}

async function endGame() {
  if (timerId) { clearInterval(timerId); timerId = null; }
  document.getElementById('progress-bar').style.width = '100%';

  const timeSec = Math.max(1, Math.floor((Date.now() - startTs) / 1000));
  const entry = {
    name: playerName,
    score,
    total: questions.length,
    timeSec,
    at: Date.now()
  };

  // always save locally
  saveLocalBoard(entry);

  document.getElementById('game-play').classList.add('hidden');
  document.getElementById('game-end').classList.remove('hidden');
  document.getElementById('final-score').textContent = score;

  let kicker, verdict;
  if (score === 8)      { kicker = 'PERFECT'; verdict = '🔒 You spotted every single trap. Teach a friend tonight.'; }
  else if (score >= 6)  { kicker = 'SHARP EYE'; verdict = '🛡️ Strong instincts — a couple slipped through. Review Instagram settings tonight.'; }
  else if (score >= 4)  { kicker = 'WATCH OUT'; verdict = '⚠️ Your posts could expose you. Follow the 3-step action plan below — tonight.'; }
  else                  { kicker = 'HIGH RISK'; verdict = '🚨 Almost every post was a leak. Please review your privacy settings now.'; }
  document.getElementById('end-kicker').textContent = kicker;
  document.getElementById('end-verdict').textContent = verdict;

  // push to global (non-blocking) then render both boards
  pushGlobalBoard(entry).finally(() => {
    renderBoard(currentTab);
  });

  renderBoard(currentTab); // render local immediately
}

let currentTab = 'global';
async function switchBoard(tab, ev) {
  currentTab = tab;
  document.querySelectorAll('.lb-tab').forEach(b => b.classList.remove('active'));
  if (ev && ev.currentTarget) ev.currentTarget.classList.add('active');
  else document.querySelector(`.lb-tab[data-lb="${tab}"]`)?.classList.add('active');
  renderBoard(tab);
}

async function renderBoard(tab) {
  const lbEl = document.getElementById('leaderboard');
  const noteEl = document.getElementById('lb-note');
  lbEl.innerHTML = '<div class="lb-empty">Loading…</div>';

  let rows, note;
  if (tab === 'global') {
    const g = await fetchGlobalBoard();
    if (g === null) {
      // fallback: remote failed
      rows = getLocalBoard();
      note = "Global leaderboard is offline — showing this device's scores instead.";
    } else {
      rows = g;
      note = `🌐 Global leaderboard · ${rows.length} players worldwide.`;
    }
  } else {
    rows = getLocalBoard();
    note = `📱 Only the scores played on this device.`;
  }

  rows = [...rows]
    .sort((a, b) => (b.score - a.score) || (a.timeSec - b.timeSec))
    .slice(0, 20);

  if (!rows.length) {
    lbEl.innerHTML = '<div class="lb-empty">No scores yet — be the first!</div>';
  } else {
    lbEl.innerHTML = rows.map((r, i) => {
      const isMe = (r.name === playerName && r.score === score);
      return `
        <div class="lb-row ${isMe ? 'me' : ''}">
          <span class="lb-rank">#${i + 1}</span>
          <div>
            <div class="lb-name">${escapeHtml(r.name)}</div>
            <div class="lb-time">${r.timeSec}s · ${formatWhen(r.at)}</div>
          </div>
          <span class="lb-score">${r.score}</span>
          <span class="lb-time">/${r.total || 8}</span>
        </div>
      `;
    }).join('');
  }
  noteEl.textContent = note;
}

function formatWhen(ts) {
  if (!ts) return '';
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return m + 'm ago';
  const h = Math.floor(m / 60);
  if (h < 24) return h + 'h ago';
  const d = Math.floor(h / 24);
  return d + 'd ago';
}

function resetGame() {
  document.getElementById('game-end').classList.add('hidden');
  document.getElementById('game-play').classList.add('hidden');
  document.getElementById('game-start').classList.remove('hidden');
  document.getElementById('player-name').value = playerName;
}

async function shareScore() {
  const text = `I just scored ${score}/8 on the Privacy Game — how many leaks can you spot? ${location.origin}${location.pathname}`;
  if (navigator.share) {
    try { await navigator.share({ title: 'Stop Oversharing', text, url: location.href }); } catch {}
  } else {
    try {
      await navigator.clipboard.writeText(text);
      alert('Result copied — paste it anywhere 📋');
    } catch {
      prompt('Copy this:', text);
    }
  }
}

document.addEventListener('DOMContentLoaded', bootGameUI);


/* ============================================================
   DEEPSEEK AI CHAT
   ⚠ Client-side key = exposed.  Rotate after the demo.
   ============================================================ */
const DEEPSEEK_API_KEY = "sk-a16821d80dcd4ceebc995d150e37d5d9";
const DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";

const SYSTEM_PROMPT = `You are "Privacy AI", a friendly assistant for high-school students (age 18) on social media privacy and oversharing.

Your job:
- Warn users about risks of oversharing (identity theft, cyberbullying, stalkers, data leaks).
- Give SHORT, direct, practical advice (max 4-5 sentences per reply).
- Friendly Gen-Z tone. Use 1-2 emojis occasionally.
- When relevant, cite briefly: Zhu et al. (2025) for identity-theft risk; Nicol et al. (2022) for combined digital traces; Jia & Xu (2016) for privacy settings.
- Encourage small, realistic steps ("You don't have to quit social media, just adjust settings").
- Always end with one concrete action they can take tonight.

Never: lecture, use corporate jargon, reply longer than ~120 words.`;

const chatHistory = [{ role: 'system', content: SYSTEM_PROMPT }];

/* Simple client-side rate-limit so 15 students hitting DeepSeek at once don't bomb the API. */
let inFlight = false;
let lastSent = 0;
const MIN_GAP_MS = 800;

function addMessage(role, html) {
  const box = document.getElementById('chat-box');
  const isUser = role === 'user';
  const div = document.createElement('div');
  div.className = 'msg ' + (isUser ? 'msg-user' : 'msg-ai');
  div.innerHTML = `
    <div class="msg-avatar">${isUser ? '🙂' : '🛡️'}</div>
    <div class="msg-bubble">${html}</div>
  `;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function addTyping() {
  const box = document.getElementById('chat-box');
  const div = document.createElement('div');
  div.id = 'typing';
  div.className = 'msg msg-ai msg-typing';
  div.innerHTML = `<div class="msg-avatar">🛡️</div><div class="msg-bubble">Privacy AI is thinking…</div>`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}
function rmTyping() { document.getElementById('typing')?.remove(); }

async function sendMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();
  if (!text || inFlight) return;

  const now = Date.now();
  if (now - lastSent < MIN_GAP_MS) return;
  lastSent = now;
  inFlight = true;

  addMessage('user', escapeHtml(text));
  chatHistory.push({ role: 'user', content: text });
  input.value = '';
  addTyping();

  try {
    const res = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + DEEPSEEK_API_KEY
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: chatHistory.slice(-12), // keep recent context only
        temperature: 0.7,
        max_tokens: 400
      })
    });
    rmTyping();
    if (!res.ok) {
      const txt = await res.text();
      addMessage('ai', `⚠️ API error (${res.status}). <small>${escapeHtml(txt).slice(0,180)}</small>`);
      return;
    }
    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || '⚠️ No reply.';
    chatHistory.push({ role: 'assistant', content: reply });
    addMessage('ai', formatReply(reply));
  } catch (e) {
    rmTyping();
    addMessage('ai', `⚠️ Network error: ${escapeHtml(e.message)}.`);
  } finally {
    inFlight = false;
  }
}

function quickAsk(q) {
  const input = document.getElementById('chat-input');
  input.value = q;
  sendMessage();
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function formatReply(s) {
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\n/g, '<br>');
}
