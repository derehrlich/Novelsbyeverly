// Minimaler ZIP-Leser und -Schreiber (Methoden „gespeichert“ und „deflate“, kein ZIP64) auf Basis von node:zlib.
// Nur Node-Bordmittel: Das Programm braucht keine Zusatzpakete, auch nicht für Updates und Sicherungen.
import zlib from 'node:zlib';

const MAX_GESAMT = 200 * 1024 * 1024; // entpackt höchstens 200 MB (Schutz vor ZIP-Bomben)

// Liest alle Einträge: [{ name, dir, data }]. Wirft bei kaputten oder zu großen Dateien.
export function readZip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i -= 1) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('Das ist keine gültige ZIP-Datei');
  const count = buf.readUInt16LE(eocd + 10);
  let pos = buf.readUInt32LE(eocd + 16);
  const out = []; let total = 0;
  for (let n = 0; n < count; n += 1) {
    if (buf.readUInt32LE(pos) !== 0x02014b50) throw new Error('ZIP-Verzeichnis ist beschädigt');
    const method = buf.readUInt16LE(pos + 10), csize = buf.readUInt32LE(pos + 20), usize = buf.readUInt32LE(pos + 24);
    const nlen = buf.readUInt16LE(pos + 28), elen = buf.readUInt16LE(pos + 30), clen = buf.readUInt16LE(pos + 32), local = buf.readUInt32LE(pos + 42);
    const name = buf.toString('utf8', pos + 46, pos + 46 + nlen).replaceAll('\\', '/');
    pos += 46 + nlen + elen + clen;
    if (csize === 0xffffffff || usize === 0xffffffff) throw new Error('ZIP64 wird nicht unterstützt');
    total += usize;
    if (total > MAX_GESAMT) throw new Error('Die ZIP-Datei ist entpackt zu groß');
    const dir = name.endsWith('/');
    out.push({ name, dir, data: () => {
      if (dir) return Buffer.alloc(0);
      if (buf.readUInt32LE(local) !== 0x04034b50) throw new Error('ZIP-Eintrag ist beschädigt');
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const raw = buf.subarray(start, start + csize);
      const data = method === 0 ? raw : method === 8 ? zlib.inflateRawSync(raw) : null;
      if (!data) throw new Error(`Unbekannte ZIP-Methode ${method}`);
      return data;
    } });
  }
  return out;
}

// Baut eine ZIP aus [{ name, data: Buffer }]
export function writeZip(entries) {
  const parts = [], central = []; let offset = 0;
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8'), packed = zlib.deflateRawSync(data), crc = zlib.crc32(data);
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(0x0800, 6); head.writeUInt16LE(8, 8);
    head.writeUInt32LE(crc >>> 0, 14); head.writeUInt32LE(packed.length, 18); head.writeUInt32LE(data.length, 22); head.writeUInt16LE(nameBuf.length, 26);
    parts.push(head, nameBuf, packed);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10);
    c.writeUInt32LE(crc >>> 0, 16); c.writeUInt32LE(packed.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(nameBuf.length, 28); c.writeUInt32LE(offset, 42);
    central.push(c, nameBuf);
    offset += head.length + nameBuf.length + packed.length;
  }
  const dir = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(dir.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, dir, end]);
}
