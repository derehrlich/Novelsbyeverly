// GET /api/admin/state: Umgebungsvariablen, Twitch-Verbindungen, Reward, EventSub-Verbindung und Überblick.
import { db } from '../../core/store.mjs';
import { getSettings, needsReward } from '../../features/settings.mjs';
import { activeSeats, communityMinutes } from '../../features/people.mjs';
import { getTimer, sprintsToday } from '../../features/timer.mjs';
import { getWords } from '../../features/words.mjs';
import { json } from '../../core/http.mjs';
import { ROLES, siteUrl, storedTokens } from '../../twitch/api.mjs';
import { info as eventsub } from '../../twitch/eventsub.mjs';
import { twitchApp } from '../../twitch/zugang.mjs';

const missing = (tokens, role) => (tokens ? ROLES[role].scopes.filter((sc) => Array.isArray(tokens.scopes) && !tokens.scopes.includes(sc)) : []);

export async function status({ req, route, method }) {
  if (route[0] !== 'state' || method !== 'GET') return;
  const settings = await getSettings();
  const channel = await storedTokens('broadcaster');
  const bot = await storedTokens('bot');
  const state = (await db.get('config/state')) ?? {};
  return json({
    env: {
      TWITCH_CLIENT_ID: Boolean(twitchApp().clientId),
      TWITCH_CLIENT_SECRET: Boolean(twitchApp().clientSecret),
      INGEST_TOKEN: Boolean(process.env.INGEST_TOKEN),
    },
    connectedAs: channel?.login ?? null,
    botAs: bot?.login ?? null,
    missingScopes: missing(channel, 'broadcaster'),
    botMissingScopes: missing(bot, 'bot'),
    rewardId: state.rewardId ?? null,
    revoked: state.revoked ?? null,
    eventsub: { state: eventsub.state, error: eventsub.error, warnings: eventsub.warnings, lastMessageAt: eventsub.lastMessageAt },
    urls: { site: siteUrl(req), overlay: `${siteUrl(req)}/overlay`, words: `${siteUrl(req)}/api/words` },
    timer: await getTimer(),
    pomodoro: { done: await sprintsToday(settings), goal: settings.pomodoroGoal },
    modus: settings.szeneModus,
    words: await getWords(settings),
    seated: (await activeSeats(settings)).length,
    communityHours: Math.floor((await communityMinutes()) / 60),
  });
}
