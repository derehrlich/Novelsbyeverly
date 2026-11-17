// Punkte und Monatsrangliste: Twitch-Chat (mit Mindestabstand und Tageslimit gegen Spam), aktive Tage und Check-ins.
// Jede Person, die schreibt oder eincheckt, taucht auf (es gibt keine Verknüpfung mit einem anderen Dienst).
//
// Speicher:
//   cmonth/<YYYY-MM>/<twitchId>   { name, msgs, days, lastDay, dayMsgs, lastAt }
// Die Check-in-Tage kommen aus user/<id>.days.
import { db } from './store.mjs';
import { siteUrl } from './twitch.mjs';
import { fill, streamDay } from './util.mjs';
import { computeStreak, getStreamDays } from './streak.mjs';

export const monthOf = (settings, date = new Date()) => streamDay(settings, date).slice(0, 7);

export function monthLabel(month) {
  return new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${month}-01T12:00:00Z`));
}

export const pointsOf = (s, { msgs = 0, days = 0, checkins = 0 }) => msgs * s.pointsWeightMsg + days * s.pointsWeightDay + checkins * s.pointsWeightCheckin;

/** Twitch-Chat zählen: Mindestabstand und Tageslimit. Gibt zurück, ob gezählt wurde. */
export async function countChat(userId, name, settings, now = new Date()) {
  const key = `cmonth/${monthOf(settings, now)}/${userId}`;
  const day = streamDay(settings, now);
  const rec = (await db.get(key)) ?? { name, msgs: 0, days: 0, lastDay: null, dayMsgs: 0, lastAt: 0 };
  if (now.getTime() - rec.lastAt < settings.pointsMsgGap * 1000) return false;
  const sameDay = rec.lastDay === day;
  if (sameDay && rec.dayMsgs >= settings.pointsMsgCap) return false;
  await db.set(key, { name, msgs: rec.msgs + 1, days: rec.days + (sameDay ? 0 : 1), lastDay: day, dayMsgs: sameDay ? rec.dayMsgs + 1 : 1, lastAt: now.getTime() });
  return true;
}

async function loadAll(keys) {
  const out = [];
  for (let i = 0; i < keys.length; i += 25) out.push(...(await Promise.all(keys.slice(i, i + 25).map(async (k) => ({ id: k.split('/').pop(), ...(await db.get(k)) })))));
  return out.filter((x) => x.name !== undefined);
}

/** Alle Personen mit Besuchen (Admin und Ranglisten). Testpersonen („user/test-…“) bleiben außen vor. */
export async function allVisitors() {
  return loadAll((await db.list('user/')).filter((k) => !k.startsWith('user/test-')));
}

/** Rangliste des Monats: Chat + aktive Tage + Check-ins. */
export async function monthBoard(settings, month = monthOf(settings)) {
  const chat = new Map((await loadAll(await db.list(`cmonth/${month}/`))).map((c) => [c.id, c]));
  const people = new Map();
  for (const u of await allVisitors()) {
    const checkins = (u.days ?? []).filter((d) => d.startsWith(month)).length;
    if (checkins) people.set(u.id, { name: u.name, checkins });
  }
  for (const [id, c] of chat) people.set(id, { name: c.name, checkins: people.get(id)?.checkins ?? 0 });
  const rows = [];
  for (const [id, p] of people) {
    const c = chat.get(id);
    const points = pointsOf(settings, { msgs: c?.msgs, days: c?.days, checkins: p.checkins });
    if (points > 0) rows.push({ twitchId: id, name: p.name, points, msgs: c?.msgs ?? 0, checkins: p.checkins });
  }
  rows.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name, 'de'));
  return { month, label: monthLabel(month), rows };
}

export const rankingUrl = (req) => `${siteUrl(req)}/rangliste`;

/** Antwort auf !rangliste: Top-Plätze des Monats, bei Chattern außerhalb der Liste auch der eigene Platz. */
export async function rankReply(settings, chatterId) {
  const board = await monthBoard(settings);
  const url = rankingUrl();
  if (!board.rows.length) return fill(settings.pointsRankEmpty, { month: board.label, url });
  const n = settings.pointsRankSize;
  const list = board.rows.slice(0, n).map((r, i) => `${i + 1}. ${r.name} (${r.points})`).join(' · ');
  const i = board.rows.findIndex((r) => r.twitchId === chatterId);
  const me = i >= n ? ` · Du: Platz ${i + 1} (${board.rows[i].points})` : '';
  return fill(settings.pointsRankTemplate, { month: board.label, list, me, n, url });
}

/** Antwort auf !punkte: die eigenen Punkte und der Platz. */
export async function pointsReply(settings, userId, userName) {
  const board = await monthBoard(settings);
  const i = board.rows.findIndex((r) => r.twitchId === userId);
  if (i < 0) return fill(settings.pointsMeNone, { user: userName, month: board.label });
  return fill(settings.pointsMeTemplate, { user: userName, points: board.rows[i].points, month: board.label, rank: i + 1, total: board.rows.length, url: rankingUrl() });
}

/** Antwort auf !streak: Besuche, Streak, Rekord und Platz unter allen Besuchern. */
export async function streakReply(settings, userId, userName, today = streamDay(settings)) {
  const users = await allVisitors();
  const me = users.find((u) => u.id === userId);
  if (!me || !me.days?.length) return fill(settings.streakCmdNone, { user: userName });
  const list = users.filter((u) => u.days?.length).sort((a, b) => b.days.length - a.days.length || a.name.localeCompare(b.name, 'de'));
  const { current, record } = computeStreak(me, await getStreamDays(), today, settings.streakGrace);
  return fill(settings.streakCmdTemplate, { user: me.name, count: me.days.length, streak: current, record, rank: list.indexOf(me) + 1, total: list.length });
}

/** Daten für die öffentliche Rangliste (Seite /rangliste). */
export async function leaderboard(settings, today = streamDay(settings)) {
  const users = (await allVisitors()).filter((u) => u.days?.length);
  const streamDays = await getStreamDays();
  const top = (arr, value, min = 1) => arr.map((u) => ({ name: u.name, value: value(u) })).filter((x) => x.value >= min).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, 'de')).slice(0, 10);
  const streaks = users.map((u) => ({ name: u.name, ...computeStreak(u, streamDays, today, settings.streakGrace) }));
  const month = settings.pointsEnabled ? await monthBoard(settings) : null;
  return {
    month: month && { label: month.label, rows: month.rows.slice(0, 20).map((r) => ({ name: r.name, value: r.points })), rules: { msg: settings.pointsWeightMsg, day: settings.pointsWeightDay, checkin: settings.pointsWeightCheckin, msgCap: settings.pointsMsgCap, msgGap: settings.pointsMsgGap } },
    visits: top(users, (u) => u.days.length),
    streaks: top(streaks, (u) => u.current),
    records: top(streaks, (u) => u.record),
    minutes: top(users, (u) => u.minutes ?? 0),
    words: top(users, (u) => u.words ?? 0),
    visitors: users.length,
    updated: new Date().toISOString(),
  };
}
