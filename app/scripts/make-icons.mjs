// PWA 用のアイコンを生成する。
//
// 画像処理ライブラリを入れずに済ませるため、PNG を自前で組み立てている。
// 描くのは矩形だけなので、これで足りる。
//
//   node scripts/make-icons.mjs
//
// 図柄は「白い紙の下端が炭化し、境界に熾火の線が走っている」ところ。
// 選択画面のサムネイルと同じ構図にしてある。

import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

const BG = [0x0a, 0x0a, 0x0b]; // 画面と同じ背景
const PAPER = [0xff, 0xff, 0xff];
const CHAR = [0x13, 0x10, 0x0d];
const EMBER = [0xc4, 0x55, 0x1e];

const crcTable = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

const crc32 = (buf) => {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};

const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

/** pixels: (x, y) => [r, g, b] */
const encodePng = (size, pixels) => {
  const raw = Buffer.alloc(size * (size * 3 + 1));
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0; // フィルタなし
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixels(x, y);
      raw[p++] = r;
      raw[p++] = g;
      raw[p++] = b;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolor
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
};

/**
 * @param size    出力サイズ
 * @param padding 紙のまわりの余白（比率）。ホーム画面のアイコンは角が丸められるので、
 *                iOS 向けは余白を多めに取る。
 */
const draw = (size, padding) => (x, y) => {
  const pad = size * padding;
  const left = pad;
  const right = size - pad;
  const top = size * (padding * 0.82);
  const bottom = size - size * (padding * 0.82);

  if (x < left || x >= right || y < top || y >= bottom) return BG;

  const charTop = top + (bottom - top) * 0.62;
  const emberThickness = Math.max(2, size * 0.022);

  if (y >= charTop && y < charTop + emberThickness) return EMBER;
  if (y >= charTop) return CHAR;

  // 紙の上半分には罫線を薄く入れる
  const lineSpacing = (bottom - top) * 0.12;
  const offset = (y - top) % lineSpacing;
  if (y > top + lineSpacing * 0.8 && offset < Math.max(1, size * 0.006)) {
    return [0xd6, 0xd6, 0xd6];
  }
  return PAPER;
};

mkdirSync(OUT_DIR, { recursive: true });

const targets = [
  { name: "icon-192.png", size: 192, padding: 0.16 },
  { name: "icon-512.png", size: 512, padding: 0.16 },
  // iOS のホーム画面アイコンは角が丸められ、さらに余白が詰まって見えるので広めに取る
  { name: "apple-touch-icon.png", size: 180, padding: 0.2 },
];

for (const { name, size, padding } of targets) {
  const png = encodePng(size, draw(size, padding));
  writeFileSync(join(OUT_DIR, name), png);
  console.log(`${name}  ${size}x${size}  ${(png.length / 1024).toFixed(1)}KB`);
}
