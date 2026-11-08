// Generates public/noise.png — a 128×128 greyscale+alpha noise tile for the GrainOverlay
// (cheaper to paint than an SVG feTurbulence filter). Deterministic (seeded PRNG).
import fs from "node:fs";
import zlib from "node:zlib";

const W = 128, H = 128;
let seed = 1337;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const raw = Buffer.alloc((W * 2 + 1) * H);
for (let y = 0; y < H; y++) {
  raw[y * (W * 2 + 1)] = 0; // filter: none
  for (let x = 0; x < W; x++) {
    const o = y * (W * 2 + 1) + 1 + x * 2;
    raw[o] = Math.floor(rand() * 256); // grey
    raw[o + 1] = 255;                  // alpha (opacity applied in CSS)
  }
}
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 4; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
fs.writeFileSync(new URL("../public/noise.png", import.meta.url), png);
console.log("wrote public/noise.png", png.length, "bytes");
