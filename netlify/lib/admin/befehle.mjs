// /api/admin/commands und /api/admin/quotes: eigene Chat-Befehle und Zitate.
//   GET commands | PUT commands { commands: [...] } | POST commands/test/<id> (zeigt Antwort und Buch, schreibt nichts in den Chat)
//   GET quotes | POST quotes { text } | DELETE quotes/<n>
import { json } from '../http.mjs';
import { getSettings } from '../settings.mjs';
import { COMMAND_WORDS } from '../chat.mjs';
import { getPresets } from '../pause.mjs';
import { pushEvent } from '../util.mjs';
import * as cmds from '../befehle.mjs';

export async function befehleRoute({ route, method, body }) {
  if (route[0] === 'commands') {
    const settings = await getSettings();
    const view = async () => json({ commands: await cmds.getCommands(), max: cmds.MAX_COMMANDS, prefix: settings.commandPrefix, enabled: settings.customCommandsEnabled });
    if (route.length === 1 && method === 'GET') return view();
    if (route.length === 1 && method === 'PUT') {
      const reserved = [...COMMAND_WORDS, ...(await getPresets()).map((p) => p.word)];
      const r = await cmds.saveCommands(body?.commands, reserved);
      return r.error ? json({ error: r.error }, 400) : view();
    }
    if (route[1] === 'test' && route[2] && method === 'POST') { // Vorschau: Antwort anzeigen und das Buch im Overlay zeigen, nichts in den Chat schreiben
      const cmd = (await cmds.getCommands()).find((c) => c.id === route[2]);
      if (!cmd) return json({ error: 'Diesen Befehl gibt es nicht mehr. Bitte erst speichern.' }, 404);
      const r = await cmds.render(cmd, { user: 'Lena', args: 'Beispiel', channel: 'Everly' }, { dry: true });
      if (r.bookTitle || r.bookText) await pushEvent({ type: 'alert', kind: 'command', user: r.user, title: r.bookTitle, message: r.bookText, ms: settings.alertSeconds * 1000 });
      return json({ text: r.text, bookTitle: r.bookTitle, bookText: r.bookText });
    }
  }
  if (route[0] === 'quotes') {
    if (route.length === 1 && method === 'GET') return json({ quotes: await cmds.listQuotes() });
    if (route.length === 1 && method === 'POST') {
      const text = String(body?.text ?? '').trim();
      if (!text) return json({ error: 'Bitte ein Zitat eingeben' }, 400);
      await cmds.addQuote(text, String(body?.by ?? 'Admin'));
      return json({ quotes: await cmds.listQuotes() });
    }
    if (route.length === 2 && method === 'DELETE') {
      if (!/^\d+$/.test(route[1]) || !(await cmds.deleteQuote(route[1]))) return json({ error: 'Dieses Zitat gibt es nicht' }, 404);
      return json({ quotes: await cmds.listQuotes() });
    }
  }
}
