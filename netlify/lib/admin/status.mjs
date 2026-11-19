// GET /api/admin/state: Umgebungsvariablen, Twitch-Verbindungen, Reward, Webhooks und Überblick.
import { db } from '../store.mjs';
import { getSettings, needsAlerts, needsChat, needsRaids, needsRescue, needsReward } from '../settings.mjs';
import { activeSeats, communityMinutes } from '../people.mjs';
import { getTimer, sprintsToday } from '../timer.mjs';
import { getWords } from '../words.mjs';
import { json } from '../http.mjs';
import { streamDay } from '../util.mjs';
import { ALERT_SCOPES, ALERT_TYPES, listSubscriptions, ROLES, siteUrl, storedTokens } from '../twitch.mjs';

const missing = (tokens, role, extra = []) => (tokens ? [...ROLES[role].scopes, ...extra].filter((sc) => Array.isArray(tokens.scopes) && !tokens.scopes.includes(sc)) : []);

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
      const expected = (needsChat(settings) ? 1 : 0) + (needsReward(settings) && state.rewardId ? 1 : 0) + (needsRescue(settings) && state.streakRewardId ? 1 : 0) + (needsAlerts(settings) ? ALERT_TYPES.length : 0) + (needsRaids(settings) ? 1 : 0);
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
    missingScopes: missing(channel, 'broadcaster', needsAlerts(settings) ? ALERT_SCOPES : []),
    botMissingScopes: missing(bot, 'bot'),
    rewardId: state.rewardId ?? null,
    revoked: state.revoked ?? null,
    subscription, subscriptionError,
    urls: { site: siteUrl(req), rangliste: `${siteUrl(req)}/rangliste`, redirect: `${siteUrl(req)}/api/auth/callback`, webhook: webhookUrl, overlay: `${siteUrl(req)}/overlay`, words: `${siteUrl(req)}/api/words` },
    timer: await getTimer(),
    pomodoro: { done: await sprintsToday(settings), goal: settings.pomodoroGoal },
    modus: settings.szeneModus,
    words: await getWords(settings),
    seated: (await activeSeats(settings)).length,
    features: { rescue: settings.streakRescueEnabled, checkin: settings.checkinEnabled, points: settings.pointsEnabled, alerts: settings.alertsEnabled, raids: settings.raidEnabled },
    checkinsToday: settings.checkinEnabled ? (await db.list(`checked/${streamDay(settings)}/`)).length : 0,
    communityHours: Math.floor((await communityMinutes()) / 60),
  });
}
