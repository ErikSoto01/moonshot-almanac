// Web-optimized copies (needs ffmpeg and cwebp: brew install ffmpeg webp) of the studio's graphics: gallery thumbnails, Open Graph image, favicons.
//   npm run images
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT, STUDIO } from "./paths.js";

const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "site.config.json"), "utf8"));
const out = p => path.join(ROOT, p);
const ff = (...args) => execFileSync("ffmpeg", ["-loglevel", "error", "-y", ...args]);
fs.mkdirSync(out("assets/img/gallery"), { recursive: true });

for (const g of cfg.gallery) {
  const src = path.join(STUDIO, g.src);
  if (!fs.existsSync(src)) { console.warn("missing", src); continue; }
  // Reel covers are 9:16; keep the top 4:5 where the headline and art sit.
  const crop = g.crop ? ["-crop", "0", "0", "1080", "1350"] : [];
  for (const [w, h, q] of [[600, 750, 80], [1080, 1350, 82]])
    execFileSync("cwebp", ["-quiet", "-q", String(q), "-m", "6", ...crop, "-resize", String(w), String(h), src, "-o", out(`assets/img/gallery/${g.slug}-${w}.webp`)]);
  console.log("gallery", g.slug);
}
// Open Graph / link preview: 1200x630 from the Page cover
ff("-i", path.join(STUDIO, "out/brand/cover.jpg"), "-vf", "scale=1200:-2:flags=lanczos,crop=1200:630", "-q:v", "3", out("assets/img/og-cover.jpg"));
// Favicons from the logo
const { LOGO_SVG } = await import(path.join(STUDIO, "tools/brand.js"));
fs.writeFileSync(out("favicon.svg"), LOGO_SVG.replace("<svg ", '<svg width="100" height="100" '));
ff("-i", path.join(STUDIO, "out/brand/profile.png"), "-vf", "scale=180:180:flags=lanczos", out("apple-touch-icon.png"));
ff("-i", path.join(STUDIO, "out/brand/profile.png"), "-vf", "scale=32:32:flags=lanczos", out("favicon-32.png"));
console.log("og-cover, favicons done");
