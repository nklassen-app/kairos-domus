// Rasterize ../icon.svg into the source PNGs @capacitor/assets expects.
// Foreground shapes are scaled to 60% so nothing falls outside the adaptive-
// icon safe zone (central 66/108) under circular masks.
import sharp from 'sharp';
import { readFileSync } from 'fs';

const svg = readFileSync(new URL('../icon.svg', import.meta.url));

// Full-bleed icon for legacy launchers.
await sharp(svg).resize(1024, 1024).png().toFile('assets/icon-only.png');

// Solid background layer.
await sharp({
  create: { width: 1024, height: 1024, channels: 4, background: '#f6f7f5' },
}).png().toFile('assets/icon-background.png');

// Foreground layer: shapes centered at 60% on transparency.
const fg = await sharp(svg).resize(614, 614).png().toBuffer();
await sharp({
  create: { width: 1024, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
}).composite([{ input: fg, gravity: 'centre' }]).png().toFile('assets/icon-foreground.png');

console.log('icon sources written to assets/');
