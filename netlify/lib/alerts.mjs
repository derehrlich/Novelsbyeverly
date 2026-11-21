// Alerts im Overlay: Follow, Sub, Resub, Gift-Sub, Bits und eingehende Raids.
// Twitch meldet sie per EventSub an den Webhook (twitch-webhook.mjs). Hier wird daraus ein Overlay-Banner (pushEvent) und
// optional eine Chatnachricht gemacht. Neue Funktion: standardmäßig aus (alertsEnabled, raidEnabled).
// Speicher: raid/<twitchId> { name, count, viewers, first, last } zählt, wie oft ein Kanal schon bei uns geraidet hat (ab dem ersten empfangenen Raid).
import { db } from './store.mjs';
import { fill, pushEvent } from './util.mjs';
import { helix, sendChat } from './twitch.mjs';

const TIERS = { 1000: 'Stufe 1', 2000: 'Stufe 2', 3000: 'Stufe 3' };
export const tierName = (t) => TIERS[t] ?? 'Stufe 1'; // Prime meldet Twitch als Stufe 1
const sign = (settings, kind, vars) => ({ title: fill(settings[`${kind}Title`] ?? '', vars), message: fill(settings[`${kind}Message`] ?? '', vars) });

// Übersetzt ein EventSub-Ereignis in Overlay-Banner plus Chatvorlage. null = nichts anzeigen.
export function buildAlert(type, e, settings) {
  const user = e.is_anonymous || !e.user_name ? 'Anonym' : e.user_name;
  const tier = tierName(e.tier);
  const card = (kind, data, vars) => ({ type: 'alert', kind, user, ...data, ...sign(settings, kind, { user, ...vars }) });
  switch (type) {
    case 'channel.follow':
      return settings.alertFollow ? { card: card('follow', {}, {}), template: settings.followTemplate, vars: { user } } : null;
    case 'channel.subscribe':
      if (e.is_gift || !settings.alertSub) return null; // Geschenkte Subs zeigt der Gift-Alert, sonst käme jeder doppelt
      return { card: card('sub', { tier, months: 1 }, { tier, months: 1 }), template: settings.subTemplate, vars: { user, tier, months: 1 } };
    case 'channel.subscription.message': {
      if (!settings.alertSub || !settings.alertResub) return null;
      const months = Number(e.cumulative_months) || 1;
      return { card: card('resub', { tier, months, extra: String(e.message?.text ?? '').slice(0, 140) }, { tier, months }), template: settings.subTemplate, vars: { user, tier, months } };
    }
    case 'channel.subscription.gift': {
      if (!settings.alertGift) return null;
      const total = Number(e.total) || 1;
      return { card: card('gift', { tier, total }, { tier, total }), template: settings.giftTemplate, vars: { user, tier, total } };
    }
    case 'channel.cheer': {
      const bits = Number(e.bits) || 0;
      if (!settings.alertCheer || bits < settings.alertCheerMin) return null;
      return { card: card('cheer', { bits, extra: String(e.message ?? '').slice(0, 140) }, { bits }), template: settings.cheerTemplate, vars: { user, bits } };
    }
    default:
      return null;
  }
}

/** Follow, Sub, Resub, Gift oder Bits: Banner im Overlay und (wenn gewünscht) Danke im Chat. */
export async function handleAlert(type, event, settings, { chat = true } = {}) {
  if (!settings.alertsEnabled) return { ok: false, skipped: true };
  const alert = buildAlert(type, event, settings);
  if (!alert) return { ok: false, skipped: true };
  await pushEvent({ ...alert.card, ms: settings.alertSeconds * 1000 });
  if (chat && settings.chatEnabled && settings.alertChat && alert.template) await sendChat(fill(alert.template, alert.vars)).catch((e) => console.warn('Chat fehlgeschlagen:', e.message));
  return { ok: true, kind: alert.card.kind };
}

// Wie oft der Kanal schon bei uns geraidet hat. Twitch bietet keinen Verlauf, gezählt wird ab dem ersten empfangenen Raid.
export async function recordRaid(raiderId, name, viewers) {
  const rec = (await db.get(`raid/${raiderId}`)) ?? { name, count: 0, viewers: 0, first: null, last: null };
  const now = new Date().toISOString();
  Object.assign(rec, { name, count: rec.count + 1, viewers: rec.viewers + viewers, first: rec.first ?? now, last: now });
  await db.set(`raid/${raiderId}`, rec);
  return rec.count;
}

// Spiel und Profilbild des Raiders. Jeder Teil ist optional: Fällt einer aus, läuft der Rest weiter.
export async function raiderInfo(raiderId) {
  const out = { game: '', avatar: null };
  try { out.game = (await helix('GET', 'channels', { query: { broadcaster_id: raiderId }, as: 'app' })).data?.[0]?.game_name ?? ''; } catch (e) { console.warn('Raider-Spiel fehlgeschlagen:', e.message); }
  try { out.avatar = (await helix('GET', 'users', { query: { id: raiderId }, as: 'app' })).data?.[0]?.profile_image_url ?? null; } catch (e) { console.warn('Raider-Bild fehlgeschlagen:', e.message); }
  return out;
}

export const visitText = (n) => (n <= 1 ? 'zum ersten Mal bei uns' : `schon zum ${n}. Mal bei uns`);
export function raidCard(raider, login, viewers, raids, info, settings) {
  const vars = { raider, viewers, raids, visit: visitText(raids), game: info.game || 'unbekannt', url: `twitch.tv/${login}` };
  return { card: { type: 'raid', raider, viewers, game: info.game, avatar: info.avatar, raids, ...sign(settings, 'raid', vars), ms: settings.raidSeconds * 1000 }, vars };
}

/** Eingehender Raid: Banner mit Spiel und Profilbild, Danke im Chat. */
export async function handleRaid(event, settings, { chat = true, record = true } = {}) {
  const viewers = Number(event.viewers) || 0;
  const raids = record ? await recordRaid(event.from_broadcaster_user_id, event.from_broadcaster_user_name, viewers) : 1; // zählt auch bei ausgeschalteter Reaktion
  if (!settings.raidEnabled || viewers < settings.raidMinViewers) return { ok: false, skipped: true };
  const info = await raiderInfo(event.from_broadcaster_user_id);
  const login = event.from_broadcaster_user_login || String(event.from_broadcaster_user_name).toLowerCase();
  const { card, vars } = raidCard(event.from_broadcaster_user_name, login, viewers, raids, info, settings);
  await pushEvent(card);
  if (chat && settings.chatEnabled && settings.alertChat) await sendChat(fill(settings.raidTemplate, vars)).catch((e) => console.warn('Chat fehlgeschlagen:', e.message));
  return { ok: true, raids };
}
