// GET /api/admin/state: Umgebungsvariablen, Twitch-Verbindungen, Reward, Webhooks und Überblick.
import { db } from '../store.mjs';
import { getSettings, needsReward } from '../settings.mjs';
import { activeSeats, communityMinutes } from '../people.mjs';
import { getTimer, sprintsToday } from '../timer.mjs';
import { getWords } from '../words.mjs';
import { json } from '../http.mjs';
import { listSubscriptions, ROLES, siteUrl, storedTokens } from '../twitch.mjs';

const missing = (tokens, role) => (tokens ? ROLES[role].scopes.filter((sc) => Array.isArray(tokens.scopes) && !tokens.scopes.includes(sc)) : []);

export async function status({ req, route, method }) {
  if (route[0] !== 'state' || method !== 'GET') return;
  const settings = await getSettings();
  const channel = await storedTokens('broadcaster');
  const bot = await storedTokens('bot');
  const state = (await db.get('config/state')) ?? {};
  const webhookUrl = `${siteUrl(req)}/api/twitch-webhook`;
  let subscription = null;
  let subscriptionError = null;
  if (channel && process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET) {
    try {
      const subs = await listSubscriptions(webhookUrl);
      const expected = 1 + (needsReward(settings) && state.rewardId ? 1 : 0);
      const notReady = subs.find((x) => x.status !== 'enabled');
      subscription = !subs.length ? 'keine' : notReady ? notReady.status : subs.length < expected ? 'unvollständig – bitte neu einrichten' : 'enabled';
    } catch (e) { subscriptionError = e.message; }
  }
  return json({
    env: {
      TWITCH_CLIENT_ID: Boolean(process.env.TWITCH_CLIENT_ID),
      TWITCH_CLIENT_SECRET: Boolean(process.env.TWITCH_CLIENT_SECRET),
      EVENTSUB_SECRET: Boolean(process.env.EVENTSUB_SECRET),
      INGEST_TOKEN: Boolean(process.env.INGEST_TOKEN),
    },
    connectedAs: channel?.login ?? null,
    botAs: bot?.login ?? null,
    missingScopes: missing(channel, 'broadcaster'),
    botMissingScopes: missing(bot, 'bot'),
    rewardId: state.rewardId ?? null,
    revoked: state.revoked ?? null,
    subscription, subscriptionError,
    urls: { site: siteUrl(req), redirect: `${siteUrl(req)}/api/auth/callback`, webhook: webhookUrl, overlay: `${siteUrl(req)}/overlay`, gaming: `${siteUrl(req)}/gaming`, words: `${siteUrl(req)}/api/words`, tode: `${siteUrl(req)}/api/tod` },
    timer: await getTimer(),
    pomodoro: { done: await sprintsToday(settings), goal: settings.pomodoroGoal },
    modus: settings.szeneModus,
    words: await getWords(settings),
    seated: (await activeSeats(settings)).length,
    communityHours: Math.floor((await communityMinutes()) / 60),
  });
}
