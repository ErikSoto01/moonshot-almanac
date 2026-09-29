// Assemble index.html from src/index.html + site.config.json + data/week.json.
//   node tools/build.js   (npm run week runs this for you)
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { ROOT, STUDIO } from "./paths.js";

const read = p => fs.readFileSync(path.join(ROOT, p), "utf8");
const cfg = JSON.parse(read("site.config.json"));
const week = JSON.parse(read("data/week.json"));
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Until the Page URL is set, "Follow" searches Facebook for the Page name.
const FB = cfg.facebookUrl || "https://www.facebook.com/search/pages/?q=Moonshot%20Almanac";
if (!cfg.facebookUrl) console.warn("! facebookUrl is empty in site.config.json; Follow buttons use a Facebook search link for now.");
const SITE = cfg.siteUrl.endsWith("/") ? cfg.siteUrl : cfg.siteUrl + "/";
const VERSION = crypto.createHash("sha1").update(read("assets/css/site.css") + read("assets/js/site.js") + JSON.stringify(week)).digest("hex").slice(0, 8);

let logo;
try { logo = (await import(path.join(STUDIO, "tools/brand.js"))).LOGO_SVG; } catch { logo = read("favicon.svg"); }
logo = logo.replace("<svg ", '<svg aria-hidden="true" focusable="false" ');
const FB_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.5V4.4c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.4H8v3h2.6V21z"/></svg>';

// ---------- This week's sky ----------
const updated = new Date(week.generated).toLocaleDateString("en-US", { timeZone: "America/Chicago", month: "long", day: "numeric", year: "numeric" });
const L = week.lead;
const fists = L ? Math.round(L.alt / 10) : 0;
const chartAlt = L ? `Star chart for ${L.day} around ${L.time}, looking ${L.dir}. ${L.body} is circled about ${fists} fist${fists === 1 ? "" : "s"} above the ${L.dir} horizon, with numbered dots counting fists up from the ground, faint constellation lines, and compass directions along a treeline.` : "";
const chartFile = "assets/img/week-chart.webp";
const events = week.events.map(e => {
  const [dow, md] = e.dayLabel.split(", ");
  return `        <li>
          <p class="day"><time datetime="${e.date}">${esc(dow)} ${esc(md)}</time><span>${esc(e.tag)}</span></p>
          <div>
            <h3>${esc(e.title)}</h3>
            <p class="t">${esc(e.time)}</p>
            <p class="b">${esc(e.body)}</p>
          </div>
        </li>`;
}).join("\n");
const WEEK = `      <div class="week-head">
        <div>
          <p class="eyebrow">This week's sky</p>
          <h2 id="week-title">${esc(week.range)}</h2>
        </div>
        <p class="basis">Clock times for events are Central Time (${esc(week.zone)}). “Look” times are your local clock time and work across the lower 48. Positions computed for ${esc(week.location.label)}.</p>
      </div>
      <p class="stale" id="stale" hidden>This guide covered ${esc(week.range)}. A new one goes up every Friday on <a href="${esc(FB)}" rel="noopener">Facebook</a>, and here soon after.</p>
      <div class="week-grid" data-week-end="${week.end}">
${L && fs.existsSync(path.join(ROOT, chartFile)) ? `        <figure class="plate">
          <img src="${chartFile}?v=${VERSION}" width="1440" height="960" alt="${esc(chartAlt)}" loading="lazy" decoding="async">
          <figcaption><b>${esc(L.title)}.</b> ${esc(L.day)}, around ${esc(L.time)} local time: face ${esc(L.dir)}. The numbered dots count fists held at arm's length, about 10° each.</figcaption>
        </figure>` : ""}
        <ol class="almanac">
${events}
        </ol>
      </div>
      <p class="week-foot">Mid-week (${esc(week.sun.day)}) the Sun sets around ${esc(week.sun.sunset)} and rises around ${esc(week.sun.sunrise)} local time. Calculated with Astronomy Engine; meteor-shower peaks use the International Meteor Organization's values. Clouds happen, so check your local forecast. Updated ${esc(updated)}.</p>`;

// ---------- Gallery ----------
const items = cfg.gallery.filter(g => fs.existsSync(path.join(ROOT, `assets/img/gallery/${g.slug}-600.webp`)));
const GALLERY = `      <ul class="grid">
${items.map(g => `        <li><figure>
          <a href="assets/img/gallery/${g.slug}-1080.webp" data-lightbox data-caption="${esc(g.caption)}"><img src="assets/img/gallery/${g.slug}-600.webp" width="600" height="750" alt="${esc(g.alt)}" loading="lazy" decoding="async"></a>
          <figcaption><span class="tag">${esc(g.tag)}</span>${esc(g.caption)}</figcaption>
        </figure></li>`).join("\n")}
      </ul>`;

if (!cfg.contactEmail) throw new Error("Set contactEmail in site.config.json: it's the site's only contact.");
const MAIL = `<a href="mailto:${esc(cfg.contactEmail)}">${esc(cfg.contactEmail)}</a>`;
const CONTACT = `Questions, sky photos, corrections, or brand and partnership inquiries: email us at ${MAIL}.`;
const CONTACT_LINK = `Email us at ${MAIL}.`;

const ld = [
  { "@context": "https://schema.org", "@type": "WebSite", name: "Moonshot Almanac", url: SITE, description: "This week's night sky for U.S. skywatchers, plus true space-age stories." },
  { "@context": "https://schema.org", "@type": "Organization", name: "Moonshot Almanac", url: SITE, logo: SITE + "apple-touch-icon.png", ...(cfg.facebookUrl ? { sameAs: [cfg.facebookUrl] } : {}) },
];

const html = read("src/index.html")
  .replaceAll("{{SITE_URL}}", SITE)
  .replaceAll("{{FB_URL}}", esc(FB))
  .replaceAll("{{FB_ICON}}", FB_ICON)
  .replaceAll("{{LOGO}}", logo)
  .replaceAll("{{VERSION}}", VERSION)
  .replaceAll("{{YEAR}}", String(new Date().getFullYear()))
  .replaceAll("{{UPDATED}}", esc(updated))
  .replace("{{JSON_LD}}", JSON.stringify(ld).replace(/</g, "\\u003c"))
  .replace("{{WEEK}}", WEEK)
  .replace("{{GALLERY}}", GALLERY)
  .replace("{{CONTACT}}", CONTACT)
  .replace("{{CONTACT_LINK}}", CONTACT_LINK);
if (/\{\{[A-Z_]+\}\}/.test(html)) throw new Error("Unfilled placeholder: " + html.match(/\{\{[A-Z_]+\}\}/)[0]);
fs.writeFileSync(path.join(ROOT, "index.html"), html);
fs.writeFileSync(path.join(ROOT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${SITE}</loc><lastmod>${week.generated.slice(0, 10)}</lastmod><changefreq>weekly</changefreq></url></urlset>\n`);
fs.writeFileSync(path.join(ROOT, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${SITE}sitemap.xml\n`);
console.log(`built index.html (${week.range}, ${week.events.length} events, ${items.length} gallery images)`);
