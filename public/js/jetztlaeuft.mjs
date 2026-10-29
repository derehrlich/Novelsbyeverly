// Liest aus der Antwort eines Musik-Programms, was gerade läuft. Bewusst tolerant, weil jedes Programm andere Namen nutzt
// (Tuna: title, artists, cover_url, status; andere: song, artist, image, state ...). Ergebnis: { title, artist, cover } oder null.
export function nowPlaying(j) {
  const pick = (...keys) => { for (const key of keys) { const v = key.split('.').reduce((o, part) => o?.[part], j); if (v != null && v !== '' && !(Array.isArray(v) && !v.length)) return v; } return ''; };
  const title = String(pick('title', 'name', 'song', 'track', 'video.title', 'item.title'));
  let artist = pick('artists', 'artist', 'author', 'video.author', 'item.artist');
  if (Array.isArray(artist)) artist = artist.map((a) => a?.name ?? a).join(', ');
  let cover = pick('cover_url', 'cover', 'image', 'artwork', 'albumArt', 'thumbnail', 'video.thumbnails');
  if (Array.isArray(cover)) cover = cover.at(-1)?.url ?? cover.at(-1);
  const status = String(pick('status', 'state', 'player.trackState'));
  const playing = !status || /play/i.test(status) || status === '1';
  return title && playing ? { title, artist: String(artist || ''), cover: /^https?:\/\//i.test(String(cover)) ? String(cover) : '' } : null;
}
