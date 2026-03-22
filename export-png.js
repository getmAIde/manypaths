import sharp from "sharp";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const logoDir = join(__dirname, "logo");

const exports = [
  { input: "bluesky-avatar.svg", output: "bluesky-avatar.png", width: 1000, height: 1000 },
  { input: "bluesky-banner.svg", output: "bluesky-banner.png", width: 3000, height: 1000 },
];

for (const { input, output, width, height } of exports) {
  const svg = readFileSync(join(logoDir, input));
  await sharp(svg)
    .resize(width, height)
    .png()
    .toFile(join(logoDir, output));
  console.log(`✓ ${output} (${width}×${height})`);
}
