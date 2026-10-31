// Minimaler ZIP-Leser und -Schreiber ohne Fremdbibliothek (Deflate über zlib). Genug für Sicherungen und Updates.
import zlib from 'node:zlib';

const crc32 = (buf) => zlib.crc32(buf) >>> 0;

function dosTime(date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return [time & 0xffff, day & 0xffff];
}

// entries: [{ name: 'ordner/datei.txt', data: Buffer }]
export function writeZip(entries, date = new Date()) {
  const [t, d] = dosTime(date);
  const parts = [], central = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const nameBuf = Buffer.from(name, 'utf8');
    const packed = data.length > 64 ? zlib.deflateRawSync(data) : data;
    const method = packed === data ? 0 : 8;
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(method, 8);
    local.writeUInt16LE(t, 10); local.writeUInt16LE(d, 12); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(nameBuf.length, 26);
    parts.push(local, nameBuf, packed);
    const head = Buffer.alloc(46);
    head.writeUInt32LE(0x02014b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(20, 6); head.writeUInt16LE(0x0800, 8); head.writeUInt16LE(method, 10);
    head.writeUInt16LE(t, 12); head.writeUInt16LE(d, 14); head.writeUInt32LE(crc, 16);
    head.writeUInt32LE(packed.length, 20); head.writeUInt32LE(data.length, 24); head.writeUInt16LE(nameBuf.length, 28);
    head.writeUInt32LE(offset, 42);
    central.push(head, nameBuf);
    offset += 30 + nameBuf.length + packed.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, end]);
}

// Liest eine ZIP-Datei. Wirft bei Beschädigung, Verschlüsselung, ZIP64, unsicheren Pfaden oder zu großem Inhalt.
export function readZip(buf, { maxFiles = 5000, maxBytes = 200 * 1024 * 1024 } = {}) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 65535); i -= 1) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('Das ist keine gültige ZIP-Datei');
  const count = buf.readUInt16LE(eocd + 10);
  let pos = buf.readUInt32LE(eocd + 16);
  if (count === 0xffff || pos === 0xffffffff) throw new Error('ZIP64 wird nicht unterstützt');
  if (count > maxFiles) throw new Error(`Zu viele Dateien in der ZIP (mehr als ${maxFiles})`);
  const out = [];
  let total = 0;
  for (let n = 0; n < count; n += 1) {
    if (pos + 46 > buf.length || buf.readUInt32LE(pos) !== 0x02014b50) throw new Error('ZIP-Verzeichnis beschädigt');
    const flags = buf.readUInt16LE(pos + 8), method = buf.readUInt16LE(pos + 10), crc = buf.readUInt32LE(pos + 16);
    const csize = buf.readUInt32LE(pos + 20), usize = buf.readUInt32LE(pos + 24);
    const nlen = buf.readUInt16LE(pos + 28), xlen = buf.readUInt16LE(pos + 30), clen = buf.readUInt16LE(pos + 32), lho = buf.readUInt32LE(pos + 42);
    const name = buf.toString('utf8', pos + 46, pos + 46 + nlen).replaceAll('\\', '/');
    pos += 46 + nlen + xlen + clen;
    if (name.endsWith('/')) continue;
    if (flags & 1) throw new Error('Verschlüsselte ZIP-Dateien werden nicht unterstützt');
    if (csize === 0xffffffff || usize === 0xffffffff) throw new Error('ZIP64 wird nicht unterstützt');
    if (name.startsWith('/') || /^[a-z]:/i.test(name) || name.split('/').some((p) => p === '..' || p === '') || name.includes('\0')) throw new Error(`Unsicherer Dateipfad in der ZIP: ${name}`);
    total += usize;
    if (total > maxBytes) throw new Error('Der Inhalt der ZIP ist zu groß');
    if (lho + 30 > buf.length || buf.readUInt32LE(lho) !== 0x04034b50) throw new Error('ZIP-Eintrag beschädigt');
    const start = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28);
    const raw = buf.subarray(start, start + csize);
    if (raw.length !== csize) throw new Error('ZIP ist unvollständig');
    let data;
    if (method === 0) data = Buffer.from(raw);
    else if (method === 8) data = zlib.inflateRawSync(raw, { maxOutputLength: usize + 1 });
    else throw new Error(`Nicht unterstütztes Packverfahren (${method})`);
    if (data.length !== usize || crc32(data) !== crc) throw new Error(`Prüfsumme stimmt nicht: ${name}`);
    out.push({ name, data });
  }
  return out;
}
