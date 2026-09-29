// Weekly update: compute this week's sky, render the star chart, rebuild the page.
//   npm run week                      (7 days starting today, Central Time)
//   npm run week -- --from 2026-10-09 (start on a given date, e.g. the Friday of the guide)
//   npm run week -- --no-chart        (skip the chart render; keeps last week's image out of the page)
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { ROOT, STUDIO } from "./paths.js";
import { computeWeek, ymdCT } from "./lib/events.js";

const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const from = opt("--from") || ymdCT(new Date());
if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) throw new Error("--from must look like 2026-10-09");
const days = +(opt("--days") || 7);

const week = computeWeek(from, days);
fs.mkdirSync(path.join(ROOT, "data"), { recursive: true });
fs.writeFileSync(path.join(ROOT, "data/week.json"), JSON.stringify(week, null, 2) + "\n");
console.log(`\n${week.range}: ${week.events.length} of ${week.candidates} candidate events`);
for (const e of week.events) console.log(`  ${e.dayLabel.padEnd(12)} ${e.title}`);

const chart = path.join(ROOT, "assets/img/week-chart.webp");
if (args.includes("--no-chart") || !week.lead) {
  fs.rmSync(chart, { force: true });
  console.log(week.lead ? "chart skipped" : "no event with a sky target this week; no chart");
} else {
  const L = week.lead;
  const sub = { Saturn: "steady · golden", Jupiter: "bright · steady", Mars: "orange-red", Venus: "brightest point", Mercury: "low · small", Moon: "" }[L.body] || "";
  const p = { when: L.when, body: L.body, alt: L.alt, az: L.az, abbr: L.abbr, sub: L.pair && L.body !== "Moon" ? "beside the Moon" : sub };
  const jpg = path.join(STUDIO, "out/site/week-chart.jpg");
  console.log(`rendering chart: ${L.title} (${L.day}, ${L.time}, facing ${L.abbr})`);
  execFileSync("node", ["tools/render-still.js", `stills/site-chart.html?p=${encodeURIComponent(JSON.stringify(p))}`, jpg, "1440", "960"], { cwd: STUDIO, stdio: "inherit" });
  execFileSync("cwebp", ["-quiet", "-q", "82", "-m", "6", jpg, "-o", chart]);
  console.log("wrote", path.relative(ROOT, chart), (fs.statSync(chart).size / 1024).toFixed(0) + " KB");
}
execFileSync("node", ["tools/build.js"], { cwd: ROOT, stdio: "inherit" });
console.log("\nPreview: npm run serve  →  http://localhost:4321");
