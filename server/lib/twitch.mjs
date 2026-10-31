import { db } from './store.mjs';
import { twitchApp } from './twitch-app.mjs';

// Zwei Verbindungen: der Kanal (Rewards, Chat mitlesen) und ein eigener Bot-Account (schreibt im Chat).
export const ROLES = {
  broadcaster: { key: 'config/tokens', scopes: ['channel:read:redemptions', 'channel:manage:redemptions', 'user:write:chat', 'user:read:chat', 'user:bot', 'channel:bot'] },
  bot: { key: 'config/bot-tokens', scopes: ['user:write:chat', 'user:read:chat', 'user:bot'] },
};
export const EVENT_TYPE = 'channel.channel_points_custom_reward_redemption.add';
export const CHAT_TYPE = 'channel.chat.message';

// Adresse dieses Servers, wie der Browser sie sieht (im Heimnetz z. B. http://192.168.1.20:8888)
export const siteUrl = (req) =>
  (process.env.SITE_URL || (req ? new URL(req.url).origin : '')).replace(/\/$/, '');

export async function tokenRequest(params) {
  const app = twitchApp();
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: app.clientId, ...(app.clientSecret ? { client_secret: app.clientSecret } : {}), ...params }),
  });
  if (!res.ok) throw new Error(`Twitch-Token: ${res.status} ${await res.text()}`);
  return res.json();
}

export const toStored = (t, extra = {}) => ({
  access_token: t.access_token,
  refresh_token: t.refresh_token,
  expires_at: Date.now() + (t.expires_in - 60) * 1000,
  ...extra,
});

// Gespeicherte Verbindung ohne Netzwerkzugriff (null = noch nicht verbunden)
export const storedTokens = (role = 'broadcaster') => db.get(ROLES[role].key);

// Token einer Rolle (wird bei Bedarf erneuert)
export async function userToken(role = 'broadcaster') {
  const t = await storedTokens(role);
  if (!t) throw new Error(role === 'bot' ? 'Der Bot-Account ist noch nicht verbunden' : 'Twitch ist noch nicht verbunden');
  if (Date.now() >= t.expires_at) {
    const fresh = await tokenRequest({ grant_type: 'refresh_token', refresh_token: t.refresh_token });
    Object.assign(t, toStored(fresh));
    await db.set(ROLES[role].key, t);
  }
  return t;
}

export async function helix(method, endpoint, { query, body, as = 'broadcaster' } = {}) {
  const url = new URL('https://api.twitch.tv/helix/' + endpoint);
  for (const [k, v] of Object.entries(query ?? {})) url.searchParams.set(k, v);
  const token = (await userToken(as)).access_token;
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Client-Id': twitchApp().clientId, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const raw = await res.text();
  if (!res.ok) throw new Error(`${method} ${endpoint} -> ${res.status} ${raw}`);
  return raw ? JSON.parse(raw) : {};
}

// Schreibt im Chat. Ist ein Bot-Account verbunden, schreibt er; sonst der Kanal selbst.
// replyTo = ID der Nachricht, auf die geantwortet wird (Twitch zeigt dann den Verlauf).
export async function sendChat(message, { replyTo } = {}) {
  const broadcaster = await storedTokens('broadcaster');
  if (!broadcaster) throw new Error('Twitch ist noch nicht verbunden');
  const bot = await storedTokens('bot');
  const as = bot ? 'bot' : 'broadcaster';
  const sender = bot ?? broadcaster;
  await helix('POST', 'chat/messages', {
    as,
    body: { broadcaster_id: broadcaster.user_id, sender_id: sender.user_id, message: message.slice(0, 500), ...(replyTo ? { reply_parent_message_id: replyTo } : {}) },
  });
}

export async function setRedemptionStatus(redemptionId, rewardId, status) {
  const { user_id } = await userToken();
  try {
    await helix('PATCH', 'channel_points/custom_rewards/redemptions', {
      query: { id: redemptionId, broadcaster_id: user_id, reward_id: rewardId },
      body: { status },
    });
  } catch (e) {
    // Klappt nur bei Rewards, die diese App angelegt hat
    console.warn(`Einlösung nicht auf ${status} gesetzt:`, e.message);
  }
}

// Legt den Check-in-Reward an oder passt ihn an und merkt sich die ID. Ist er nicht nötig, wird er in Twitch ausgeschaltet.
export async function ensureCheckinReward(settings, wanted) {
  const { user_id } = await userToken();
  const state = (await db.get('config/state')) ?? {};
  const { data: list } = await helix('GET', 'channel_points/custom_rewards', { query: { broadcaster_id: user_id, only_manageable_rewards: 'true' } });
  let reward = list.find((r) => r.id === state.rewardId) ?? list.find((r) => r.title === settings.checkinRewardTitle);
  if (!wanted) {
    if (reward && reward.is_enabled) await helix('PATCH', 'channel_points/custom_rewards', { query: { broadcaster_id: user_id, id: reward.id }, body: { is_enabled: false } }).catch(() => {});
    return null;
  }
  const fields = { title: settings.checkinRewardTitle, cost: settings.checkinRewardCost, prompt: 'Check-in: deine Figur setzt sich zu den Mitschreibenden.', background_color: '#C98B4B' };
  if (!reward) {
    try {
      reward = (await helix('POST', 'channel_points/custom_rewards', { query: { broadcaster_id: user_id }, body: fields })).data[0];
    } catch (e) {
      if (e.message.includes('DUPLICATE_REWARD')) throw new Error(`Auf deinem Kanal gibt es schon einen Reward „${settings.checkinRewardTitle}“, der nicht von dieser App stammt. Benenne oder lösche ihn in Twitch, oder wähle in den Einstellungen einen anderen Namen.`);
      throw e;
    }
  } else if (reward.title !== fields.title || reward.cost !== fields.cost || reward.is_enabled === false) {
    reward = (await helix('PATCH', 'channel_points/custom_rewards', { query: { broadcaster_id: user_id, id: reward.id }, body: { title: fields.title, cost: fields.cost, is_enabled: true } })).data[0];
  }
  await db.set('config/state', { ...state, rewardId: reward.id });
  return reward;
}

// Legt die EventSub-Abos für eine WebSocket-Sitzung an: Reward-Einlösungen (falls nötig) und Chat.
// WebSocket-Abos brauchen Nutzer-Token: Rewards läuft über den Kanal, Chat über den Bot-Account (wenn verbunden, sonst Kanal).
// Twitch verlangt beim Chat-Abo die Berechtigungen des Lesenden und channel:bot vom Kanal. Fehlt etwas, kommt eine Meldung statt eines Abbruchs.
export async function subscribeWs(sessionId, { rewardId = null, chat = true } = {}) {
  const channel = await storedTokens('broadcaster');
  if (!channel) throw new Error('Twitch ist noch nicht verbunden');
  const bot = await storedTokens('bot');
  const create = (type, condition, as) => helix('POST', 'eventsub/subscriptions', { as, body: { type, version: '1', condition, transport: { method: 'websocket', session_id: sessionId } } });
  const warnings = [];
  if (rewardId) {
    try { await create(EVENT_TYPE, { broadcaster_user_id: channel.user_id, reward_id: rewardId }, 'broadcaster'); } catch (e) { warnings.push(`Reward: ${e.message}`); }
  }
  if (chat) {
    const reader = bot ?? channel;
    const missing = ROLES.broadcaster.scopes.filter((sc) => Array.isArray(channel.scopes) && !channel.scopes.includes(sc));
    const botMissing = bot ? ROLES.bot.scopes.filter((sc) => Array.isArray(bot.scopes) && !bot.scopes.includes(sc)) : [];
    if (missing.length || botMissing.length) {
      warnings.push(`Chat: Berechtigung ${[...missing, ...botMissing].join(', ')} fehlt – bitte neu verbinden`);
    } else {
      try { await create(CHAT_TYPE, { broadcaster_user_id: channel.user_id, user_id: reader.user_id }, bot ? 'bot' : 'broadcaster'); } catch (e) {
        const status = /-> (\d{3})/.exec(e.message)?.[1];
        warnings.push(`Chat: Twitch hat das Abo abgelehnt${status ? ` (${status})` : ''} – bitte Kanal und Bot neu verbinden`);
        console.warn('Chat-Abo fehlgeschlagen:', e.message);
      }
    }
  }
  return { warnings };
}
