// Einstellungsformulare aus einer Beschreibung: schema = [[Titel, [[Schlüssel, Beschriftung, Art, Hinweis?], …]], …].
// Arten: number, bool, text, area, select (Auswahl steht in optionen[Schlüssel] als [[Wert, Text], …]).
import { esc } from './common.js';

export function zeichne(box, schema, optionen, settings) {
  box.innerHTML = schema.map(([titel, felder]) => `<h3>${esc(titel)}</h3><div class="felder">${felder.map(([key, label, type, hint]) => {
    const v = settings[key];
    const input = type === 'select' ? `<select data-k="${key}">${optionen[key].map(([val, text]) => `<option value="${val}" ${val === v ? 'selected' : ''}>${esc(text)}</option>`).join('')}</select>`
      : type === 'bool' ? `<input type="checkbox" data-k="${key}" ${v ? 'checked' : ''}>`
        : type === 'number' ? `<input type="number" data-k="${key}" value="${esc(v)}">`
          : type === 'area' ? `<textarea data-k="${key}" maxlength="300">${esc(v)}</textarea>`
            : `<input data-k="${key}" value="${esc(v)}">`;
    return `<div class="feld ${type === 'area' ? 'breit' : ''}"><label>${esc(label)}</label>${input}${hint ? `<div class="hinweis">${type === 'area' ? 'Platzhalter: ' : ''}${esc(hint)}</div>` : ''}</div>`;
  }).join('')}</div>`).join('');
}

// Liest alle Felder der Box als Objekt für PUT /settings
export function sammle(box) {
  const body = {};
  for (const el of box.querySelectorAll('[data-k]')) body[el.dataset.k] = el.type === 'checkbox' ? el.checked : el.type === 'number' ? Number(el.value) : el.value;
  return body;
}
