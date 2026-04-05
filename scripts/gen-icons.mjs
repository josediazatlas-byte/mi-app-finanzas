import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { deflateSync } from 'zlib';

// ── CRC32 ──────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (const b of buf) crc = CRC_TABLE[(crc ^ b) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const t = Buffer.from(type);
  const len = Buffer.allocUnsafe(4); len.writeUInt32BE(data.length);
  const crcBuf = Buffer.allocUnsafe(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcBuf]);
}

// ── PNG builder ────────────────────────────────────────
function createIcon(size, maskable = false) {
  const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = ihdr[11] = ihdr[12] = 0; // 8-bit RGBA

  const cx = size / 2, cy = size / 2;
  // Rounded rect: maskable = full bleed (no transparent border)
  const hw = maskable ? size * 0.5 : size * 0.47;
  const cr = maskable ? 0 : size * 0.20; // corner radius

  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = Buffer.allocUnsafe(1 + size * 4);
    row[0] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      const dx = x - cx, dy = y - cy;
      const adx = Math.abs(dx), ady = Math.abs(dy);
      const off = 1 + x * 4;

      // Inside rounded rect?
      const inside = adx <= hw && ady <= hw && (
        adx <= hw - cr || ady <= hw - cr ||
        Math.sqrt((adx - (hw - cr)) ** 2 + (ady - (hw - cr)) ** 2) <= cr
      );

      if (!inside) {
        row[off] = row[off+1] = row[off+2] = row[off+3] = 0;
        continue;
      }

      // Gradient: dark purple bg → purple accent → cyan highlight
      // Diagonal t: 0=top-left, 1=bottom-right
      const t = (dx / size + 0.5) * 0.5 + (dy / size + 0.5) * 0.5;
      const dist = Math.sqrt(dx*dx + dy*dy) / (size * 0.5);

      // Palette: bg #0d0d0f, purple #863bff, cyan #47bfff
      const R1 = 13,  G1 = 13,  B1 = 15;   // dark bg
      const R2 = 134, G2 = 59,  B2 = 255;  // purple
      const R3 = 71,  G3 = 191, B3 = 255;  // cyan

      // Mix purple→cyan based on diagonal
      const blend = Math.max(0, Math.min(1, t));
      const aR = Math.round(R2 + (R3 - R2) * blend);
      const aG = Math.round(G2 + (G3 - G2) * blend);
      const aB = Math.round(B2 + (B3 - B2) * blend);

      // Vignette: center is more vibrant
      const strength = 0.45 + (1 - Math.min(1, dist)) * 0.55;
      row[off]   = Math.round(R1 + (aR - R1) * strength);
      row[off+1] = Math.round(G1 + (aG - G1) * strength);
      row[off+2] = Math.round(B1 + (aB - B1) * strength);
      row[off+3] = 255;
    }
    rows.push(row);
  }

  const idat = deflateSync(Buffer.concat(rows));
  return Buffer.concat([PNG_SIG, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

// ── Generate ───────────────────────────────────────────
const dir = 'public/icons';
if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
for (const s of SIZES) {
  writeFileSync(`${dir}/icon-${s}x${s}.png`, createIcon(s));
  process.stdout.write(`  ✓ icon-${s}x${s}.png\n`);
}

writeFileSync(`${dir}/maskable-512x512.png`, createIcon(512, true));
process.stdout.write('  ✓ maskable-512x512.png\n');

// Apple touch icon (180px)
writeFileSync('public/apple-touch-icon.png', createIcon(180));
process.stdout.write('  ✓ apple-touch-icon.png\n');

console.log('\nAll icons generated.');
