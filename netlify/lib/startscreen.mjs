// Startbildschirm-Overlay (/startscreen): „Gleich geht’s los“ vor dem Stream, mit Countdown, Schreib-Fortschritt und wechselnden Schreib-Sprüchen.
//   startscreen/config   { title, subtitle, endText, minutes (Vorlauf), rotateSeconds, showProgress, anecdotes (Text, eine je Zeile), bgName, bgVersion, bgKind }
//   startscreen/state    { active, startedAt (ms), until (ms) }   kurzlebig, nicht in der Sicherung
//   startbg/image        { type, data }  der Hintergrund (Base64): ein Bild oder eine HTML-Datei (type text/html, animiert)
// Die Seite holt alles alle paar Sekunden samt Serverzeit und rechnet selbst weiter. Starten, verlängern, beenden: im Admin.
import { db } from './store.mjs';

export const CONFIG_KEY = 'startscreen/config';
export const STATE_KEY = 'startscreen/state';
export const BG_KEY = 'startbg/image';

// Eine Zeile: „Überschrift | Text“ oder nur „Text“.
export const DEFAULT_ANECDOTES = [
  'Kaffee-Regel Nummer eins | Ohne Kaffee kein Kapitel. Ohne Kapitel kein Kaffee. Ein perfekter Kreislauf.',
  'Das leere Blatt | Es ist nicht leer, es ist voller Möglichkeiten. Und trotzdem sehr, sehr weiß.',
  'Plot-Wissen | Wenn die Figur nicht tut, was du willst, hat sie entweder recht oder Hunger.',
  'Schreibblockade | Kein Grund zur Sorge. Die Geschichte macht nur kurz Pause, um sich zu sortieren.',
  'Der erste Satz | Er wird am Ende dreimal umgeschrieben. Meistens zurück zur ersten Version.',
  'Notizbuch-Wahrheit | Die beste Idee kommt immer unter der Dusche. Und ist trocken wieder weg.',
  'Radiergummi im Einsatz | Er ist der treueste Mitarbeiter jeder Autorin. Und er wird nie müde.',
  'Wörter zählen | Zweitausend Wörter heute. Davon tausendeinhundert Kaffee und der Rest Hoffnung.',
  'Lektorats-Tipp | „Streichen“ ist ein schönes Wort. Besonders, wenn es die Sätze der anderen trifft.',
  'Wohlfühl-Faktor | Eine Kerze, eine Decke, eine Tasse. Mehr braucht ein Kapitel selten.',
  'Zeitplan der Autorin | „Nur noch eine Szene.“ Es ist drei Uhr nachts und die Szene hat sich verdoppelt.',
  'Figuren-Wissen | Nebenfiguren sind die Gewürze der Geschichte. Aber bitte nicht alle auf einmal.',
  'Schreib-Sprint | Fünfundzwanzig Minuten Fokus. Danach darfst du so tun, als wäre es Pause gewesen.',
  'Tippfehler | Die Katze auf der Tastatur schreibt manchmal besser als der Mensch davor.',
  'Rechtschreibprogramm | Es unterringelt rot. Meistens zu Recht, manchmal aus reiner Boshaftigkeit.',
  'Kapitelende | Ein guter Cliffhanger ist ein kleines Geschenk. Mit einer Prise Gemeinheit.',
  'Die Muse | Sie kommt unangemeldet, bleibt zu kurz und lässt das Geschirr stehen.',
  'Lesezeichen-Philosophie | Ein halb gelesenes Buch ist ein Versprechen. Ein halb geschriebenes auch.',
  'Verlags-Weisheit | „Das passt nicht ins Genre“ heißt: Es ist zu gut oder zu eigen. Beides ist ein Kompliment.',
  'Schreibtisch-Ordnung | Hübsches Chaos ist eine Methode. Man findet alles, außer dem Stift.',
  'Plot-Twist | Der Mörder war der Gärtner. Oder doch der Butler. Oder die Autorin, die um zwei Uhr nachts schreibt.',
  'Notiz an mich | Nicht vergessen: Figuren haben auch Geburtstag. Und eine Lieblingssuppe.',
  'Wörterzähler | Er lügt nie, er ist nur manchmal sehr direkt.',
  'Gemütlich schreiben | Der Regen draußen schreibt mit. Zumindest den Rhythmus.',
  'Überarbeitung | Aus „sehr schön“ wird „schön“. Aus „schön“ wird ein Strich. So geht Wachstum.',
  'Schreib-Ritual | Erst Tee, dann Stift, dann Welt retten. Die Reihenfolge ist wichtig.',
  'Heldinnen-Regel | Wer ein Abenteuer will, braucht erst mal einen Rucksack voller Probleme.',
  'Buchstaben-Wetter | Heute überwiegend heiter, vereinzelt Komma-Schauer.',
  'Bücherstapel | Er wächst schneller, als man liest. Das nennt man dann Vorrat.',
  'Gute Gesellschaft | Zusammen schreiben ist leiser als allein, aber viel weniger einsam.',
].join('\n');

export const DEFAULT_CONFIG = {
  title: 'Gleich geht’s los!',
  subtitle: 'Das Schreibzimmer öffnet in Kürze',
  endText: 'Das Schreibzimmer ist geöffnet! ✍️',
  minutes: 10, rotateSeconds: 9, showProgress: true,
  anecdotes: DEFAULT_ANECDOTES, bgName: null, bgVersion: null, bgKind: 'image',
};
const IDLE = { active: false, startedAt: 0, until: 0 };

export const getConfig = async () => ({ ...DEFAULT_CONFIG, ...((await db.get(CONFIG_KEY)) ?? {}) });
export const getState = async () => ({ ...IDLE, ...((await db.get(STATE_KEY)) ?? {}) });

const str = (v, max) => String(v ?? '').trim().slice(0, max);
const num = (v, min, max, fallback) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback; };

/** Aus dem Textfeld wird eine Liste (leere Zeilen weg, höchstens 100 Zeilen mit je 200 Zeichen). */
export const parseAnecdotes = (text) => String(text ?? '').split(/\r?\n/).map((l) => l.trim().slice(0, 200)).filter(Boolean).slice(0, 100)
  .map((l) => { const i = l.indexOf('|'); return i > 0 ? { head: l.slice(0, i).trim(), text: l.slice(i + 1).trim() } : { head: '', text: l }; });

export async function updateConfig(input) {
  const cfg = await getConfig();
  const i = input ?? {};
  if ('title' in i) cfg.title = str(i.title, 60) || DEFAULT_CONFIG.title;
  if ('subtitle' in i) cfg.subtitle = str(i.subtitle, 80);
  if ('endText' in i) cfg.endText = str(i.endText, 80) || DEFAULT_CONFIG.endText;
  if ('minutes' in i) cfg.minutes = num(i.minutes, 1, 240, cfg.minutes);
  if ('rotateSeconds' in i) cfg.rotateSeconds = num(i.rotateSeconds, 4, 60, cfg.rotateSeconds);
  if (typeof i.showProgress === 'boolean') cfg.showProgress = i.showProgress;
  if ('anecdotes' in i) cfg.anecdotes = parseAnecdotes(i.anecdotes).map((a) => (a.head ? `${a.head} | ${a.text}` : a.text)).join('\n');
  if ('bgName' in i) { cfg.bgName = i.bgName ? str(i.bgName, 80) : null; cfg.bgVersion = i.bgName ? (i.bgVersion ?? Date.now()) : null; cfg.bgKind = i.bgName && i.bgKind === 'html' ? 'html' : 'image'; }
  await db.set(CONFIG_KEY, cfg);
  return cfg;
}

/** Vorlauf starten (Minuten aus den Einstellungen, oder die angegebenen). */
export async function start(minutes, now = Date.now()) {
  const cfg = await getConfig();
  const state = { active: true, startedAt: now, until: now + num(minutes, 1, 240, cfg.minutes) * 60_000 };
  await db.set(STATE_KEY, state);
  return state;
}

/** Zeit dazugeben (oder, falls nichts läuft, neu starten). */
export async function extend(minutes, now = Date.now()) {
  const s = await getState();
  if (!s.active) return start(minutes, now);
  const next = { ...s, until: Math.max(s.until, now) + num(minutes, 1, 240, 5) * 60_000 };
  await db.set(STATE_KEY, next);
  return next;
}

export async function stop() { await db.set(STATE_KEY, { ...IDLE }); }

/** Was die OBS-Seite braucht. `now` ist die Serverzeit in Millisekunden. */
export async function publicView(now = Date.now()) {
  const [c, s] = await Promise.all([getConfig(), getState()]);
  return {
    show: s.active, title: c.title, subtitle: c.subtitle, endText: c.endText, showProgress: c.showProgress, rotateSeconds: c.rotateSeconds,
    startedAt: s.startedAt, until: s.until, anecdotes: parseAnecdotes(c.anecdotes), bg: c.bgVersion ? `/api/startscreen-bg?v=${c.bgVersion}` : null, bgKind: c.bgKind, now,
  };
}

export async function adminView() {
  const [c, s] = await Promise.all([getConfig(), getState()]);
  return { config: c, state: s, defaultAnecdotes: DEFAULT_ANECDOTES };
}

// ---- Hintergrund-Datei prüfen: Typ an den ersten Bytes erkennen, nicht dem Namen glauben
export const BG_MAX = 8_000_000;
export function sniffImage(buf) {
  if (buf.length > 12 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 6 && buf.subarray(0, 4).toString('latin1') === 'GIF8') return 'image/gif';
  if (buf.length > 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'image/webp';
  return null;
}
export const isHtml = (buf) => /^﻿?\s*(<!doctype\s+html|<html|<head|<body|<!--)/i.test(buf.subarray(0, 2000).toString('utf8')) && /<(html|body|canvas|script|style|div|svg)\b/i.test(buf.subarray(0, 100_000).toString('utf8'));
export const cleanName = (name, fallback) => String(name || fallback).replace(/[<>"]/g, '').slice(0, 80);
