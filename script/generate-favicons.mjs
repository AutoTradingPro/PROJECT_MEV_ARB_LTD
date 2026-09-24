import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = process.argv[2];
if (!source) {
  console.error("Usage: node script/generate-favicons.mjs <source.png>");
  process.exit(1);
}

const publicDir = join(root, "public");
const imagesDir = join(publicDir, "images");
mkdirSync(imagesDir, { recursive: true });

const src = sharp(source).png();
const meta = await src.metadata();
console.log(`source ${meta.width}x${meta.height}`);

async function writePng(size, dest) {
  const buf = await sharp(source)
    .resize(size, size, { fit: "contain", background: { r: 26, g: 29, b: 35, alpha: 1 } })
    .png()
    .toBuffer();
  writeFileSync(dest, buf);
  return buf;
}

copyFileSync(source, join(imagesDir, "icon-mevarb.png"));

const png16 = await writePng(16, join(publicDir, "favicon-16x16.png"));
const png32 = await writePng(32, join(publicDir, "favicon-32x32.png"));
await writePng(48, join(publicDir, "favicon-48x48.png"));
await writePng(180, join(publicDir, "apple-touch-icon.png"));
await writePng(192, join(imagesDir, "icon-mevarb-192.png"));

function icoFromPngs(entries) {
  const count = entries.length;
  const headerSize = 6 + 16 * count;
  let offset = headerSize;
  const payloads = entries.map((png) => {
    const rec = { png, offset, size: png.length };
    offset += png.length;
    return rec;
  });
  const out = Buffer.alloc(offset);
  out.writeUInt16LE(0, 0);
  out.writeUInt16LE(1, 2);
  out.writeUInt16LE(count, 4);
  payloads.forEach((item, i) => {
    const entry = 6 + i * 16;
    const dim = item.png.readUInt32BE(16);
    out.writeUInt8(dim >= 256 ? 0 : dim, entry);
    out.writeUInt8(dim >= 256 ? 0 : dim, entry + 1);
    out.writeUInt8(0, entry + 2);
    out.writeUInt8(0, entry + 3);
    out.writeUInt16LE(1, entry + 4);
    out.writeUInt16LE(32, entry + 6);
    out.writeUInt32LE(item.size, entry + 8);
    out.writeUInt32LE(item.offset, entry + 12);
    item.png.copy(out, item.offset);
  });
  return out;
}

writeFileSync(join(publicDir, "favicon.ico"), icoFromPngs([png16, png32]));
console.log("wrote favicon.ico, favicon-16x16.png, favicon-32x32.png, apple-touch-icon.png");
