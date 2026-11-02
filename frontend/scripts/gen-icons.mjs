/**
 * Generate the PatchFlow favicon set + web-manifest icons from a single
 * source logo (public/logo.png).
 *
 * Run with:  node scripts/gen-icons.mjs
 *
 * Produces:
 *   src/app/favicon.ico        (multi-size 16/32/48, PNG-in-ICO)
 *   src/app/icon.png            (32x32, transparent)
 *   src/app/apple-icon.png      (180x180, flattened onto brand orange)
 *   public/icons/icon-192.png   (192x192, transparent — "any")
 *   public/icons/icon-512.png   (512x512, transparent — "any")
 *   public/icons/icon-512-maskable.png  (512x512, on brand orange — "maskable")
 *
 * Requires `sharp` (available transitively via Next.js).
 */
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const SRC = "public/logo.png";
const APP = "src/app";
const ICONS = "public/icons";

const BRAND = { r: 255, g: 90, b: 31 }; // #FF5A1F
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

async function resizePng(size, { flatten }) {
  let pipeline = sharp(SRC).resize(size, size, {
    fit: "contain",
    background: flatten ? { ...BRAND, alpha: 1 } : TRANSPARENT,
  });
  if (flatten) pipeline = pipeline.flatten({ background: BRAND });
  return pipeline.png().toBuffer();
}

/** Build a multi-image .ico from PNG buffers (PNG-in-ICO format). */
function makeIco(entries) {
  const count = entries.length;
  const dirSize = 6 + 16 * count;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type = icon
  header.writeUInt16LE(count, 4);
  const dirs = [];
  let offset = dirSize;
  for (const e of entries) {
    const d = Buffer.alloc(16);
    d.writeUInt8(e.size >= 256 ? 0 : e.size, 0); // width
    d.writeUInt8(e.size >= 256 ? 0 : e.size, 1); // height
    d.writeUInt8(0, 2); // colorCount
    d.writeUInt8(0, 3); // reserved
    d.writeUInt16LE(1, 4); // planes
    d.writeUInt16LE(32, 6); // bitCount
    d.writeUInt32LE(e.data.length, 8); // bytesInRes
    d.writeUInt32LE(offset, 12); // imageOffset
    dirs.push(d);
    offset += e.data.length;
  }
  return Buffer.concat([header, ...dirs, ...entries.map((e) => e.data)]);
}

async function main() {
  await mkdir(ICONS, { recursive: true });

  // favicon.ico (16/32/48)
  const icoSizes = [16, 32, 48];
  const icoEntries = [];
  for (const s of icoSizes) {
    icoEntries.push({ size: s, data: await resizePng(s, { flatten: false }) });
  }
  await writeFile(path.join(APP, "favicon.ico"), makeIco(icoEntries));

  // 32x32 PNG icon (transparent)
  await writeFile(path.join(APP, "icon.png"), await resizePng(32, { flatten: false }));

  // 180x180 apple-touch-icon (opaque on brand orange)
  await writeFile(path.join(APP, "apple-icon.png"), await resizePng(180, { flatten: true }));

  // manifest icons
  await writeFile(path.join(ICONS, "icon-192.png"), await resizePng(192, { flatten: false }));
  await writeFile(path.join(ICONS, "icon-512.png"), await resizePng(512, { flatten: false }));
  await writeFile(path.join(ICONS, "icon-512-maskable.png"), await resizePng(512, { flatten: true }));

  console.log("✓ Generated favicon.ico, icon.png, apple-icon.png, and manifest icons");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
