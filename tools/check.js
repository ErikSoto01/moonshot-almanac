// Sanity checks for the built site (runs in CI on every PR): npm run check
import fs from "node:fs";
import path from "node:path";
import { ROOT } from "./paths.js";

const fail = [];
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const week = JSON.parse(fs.readFileSync(path.join(ROOT, "data/week.json"), "utf8"));

if (/\{\{[A-Z_]+\}\}/.test(html)) fail.push("unfilled {{PLACEHOLDER}} in index.html");
if (week.events.length < 3 || week.events.length > 5) fail.push(`week has ${week.events.length} events (want 3-5)`);
for (const e of week.events) if (!e.title || !e.body || !e.date) fail.push(`incomplete event ${e.id}`);
if (!html.includes(`data-week-end="${week.end}"`)) fail.push("index.html is out of date with data/week.json (run npm run week or node tools/build.js)");

// every local file the page references exists
const refs = [...html.matchAll(/(?:src|href)="([^"#][^"]*)"/g)].map(m => m[1]).filter(u => !/^(https?:|mailto:|data:)/.test(u));
for (const r of new Set(refs)) { const f = path.join(ROOT, r.split("?")[0]); if (!fs.existsSync(f)) fail.push(`missing file: ${r}`); }
// every image has alt text; every in-page link has a target
for (const m of html.matchAll(/<img\b[^>]*>/g)) if (!/\balt="[^"]*"/.test(m[0])) fail.push(`img without alt: ${m[0].slice(0, 80)}`);
for (const m of html.matchAll(/href="#([^"]+)"/g)) if (!html.includes(`id="${m[1]}"`)) fail.push(`link to missing #${m[1]}`);
// no third-party requests (the privacy note promises this)
for (const m of html.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="(https?:[^"]+)"/g)) if (!m[0].includes('rel="canonical"')) fail.push(`third-party asset: ${m[1]}`);
// weight budget for what loads up front (lazy gallery images excluded)
const eager = ["index.html", "assets/css/site.css", "assets/js/site.js", "assets/vendor/astronomy.browser.min.js", "assets/data/sky.json", "assets/fonts/fraunces.woff2", "assets/fonts/inter.woff2"];
const kb = eager.reduce((s, f) => s + fs.statSync(path.join(ROOT, f)).size, 0) / 1024;
if (kb > 450) fail.push(`initial page weight ${kb.toFixed(0)} KB > 450 KB budget`);

if (fail.length) { console.error("✗ " + fail.join("\n✗ ")); process.exit(1); }
console.log(`✓ site checks passed (${week.range}; ${week.events.length} events; ${new Set(refs).size} local files; ~${kb.toFixed(0)} KB initial load)`);
