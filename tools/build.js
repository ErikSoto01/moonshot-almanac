// Assemble index.html from src/index.html + site.config.json + data/week.json.
//   node tools/build.js   (npm run week runs this for you)
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { ROOT, STUDIO } from "./paths.js";

const read = p => fs.readFileSync(path.resolve(ROOT, p), "utf8");
const cfg = JSON.parse(read(process.env.SITE_CONFIG || "site.config.json")); // SITE_CONFIG=... lets you test other settings
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
      <p class="stale" id="stale" hidden>This guide covered ${esc(week.range)}. A new one goes up every Friday on <a href="${esc(FB)}" rel="noopener">Facebook</a> and <a href="#newsletter">by email</a>, and here soon after.</p>
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
const CONTACT_LINK = `Use the <a href="#contact">contact form</a> or email us at ${MAIL}.`;

// ---------- Forms ----------
// Each form works in one of two modes, chosen by what's in site.config.json:
//   newsletter.kitFormId set   -> posts to Kit (the newsletter service), which sends a confirmation email
//   contact.web3formsKey set   -> posts to Web3Forms, which delivers the message to contactEmail
//   otherwise                  -> "mailto" mode: the visitor's email app opens with the message filled in
const NL = cfg.newsletter || {}, CT = cfg.contact || {};
const hidden = (n, v) => `<input type="hidden" name="${esc(n)}" value="${esc(v)}">`;
const mailtoAttrs = subject => `action="mailto:${esc(cfg.contactEmail)}?subject=${encodeURIComponent(subject)}" method="post" enctype="text/plain" data-provider="mailto" data-to="${esc(cfg.contactEmail)}"`;
const NEWSLETTER_ATTRS = NL.kitFormId
  ? `action="https://app.kit.com/forms/${encodeURIComponent(NL.kitFormId)}/subscriptions" method="post" data-provider="kit" data-to="${esc(cfg.contactEmail)}" data-double-opt-in="${NL.doubleOptIn === false ? "false" : "true"}"`
  : mailtoAttrs("Newsletter signup");
const NEWSLETTER_HIDDEN = "";
const CONTACT_ATTRS = CT.web3formsKey
  ? `action="https://api.web3forms.com/submit" method="post" data-provider="web3forms" data-to="${esc(cfg.contactEmail)}"`
  : mailtoAttrs("Message from the website");
const CONTACT_HIDDEN = CT.web3formsKey
  ? [hidden("access_key", CT.web3formsKey), hidden("subject", "Moonshot Almanac website: new message"), hidden("from_name", "Moonshot Almanac website"), hidden("redirect", SITE + "?sent=contact#contact"),
     '<input type="checkbox" name="botcheck" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">'].join("\n        ")
  : "";
const FORMS_PRIVACY = [
  NL.kitFormId
    ? "If you join the newsletter, your email address (and first name, if you share it) is stored by Kit, the service that sends our emails. We use it only to send the newsletter, and every issue has a one-click unsubscribe link."
    : "If you join the newsletter, your email app sends us a short signup email; we use your address only to send the newsletter, and you can unsubscribe anytime by replying “unsubscribe.”",
  CT.web3formsKey
    ? "Messages from the contact form are delivered to our inbox by Web3Forms; we use your details only to reply."
    : "Messages from the contact form are sent from your own email app to ours; we use your details only to reply.",
].join(" ");

// A row of eight moon phases for the newsletter card (same drawing as the moon widget)
const moonPath = (deg, R = 46) => {
  const k = Math.cos((deg * Math.PI) / 180), rx = (Math.abs(k) * R).toFixed(2);
  return deg < 180 ? `M0 ${-R} A${R} ${R} 0 0 1 0 ${R} A${rx} ${R} 0 0 ${k < 0 ? 1 : 0} 0 ${-R}Z` : `M0 ${-R} A${R} ${R} 0 0 0 0 ${R} A${rx} ${R} 0 0 ${k < 0 ? 0 : 1} 0 ${-R}Z`;
};
const PHASES = [0, 45, 90, 135, 180, 225, 270, 315].map(d => `<svg viewBox="-50 -50 100 100"><circle r="46" class="ph-dark"/>${d ? `<path d="${moonPath(d)}" class="ph-lit"/>` : ""}</svg>`).join("");

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
  .replace("{{CONTACT_LINK}}", CONTACT_LINK)
  .replace("{{MAIL}}", MAIL)
  .replace("{{PHASES}}", PHASES)
  .replace("{{NEWSLETTER_ATTRS}}", NEWSLETTER_ATTRS)
  .replace("{{NEWSLETTER_HIDDEN}}", NEWSLETTER_HIDDEN)
  .replace("{{CONTACT_ATTRS}}", CONTACT_ATTRS)
  .replace("{{CONTACT_HIDDEN}}", CONTACT_HIDDEN)
  .replace("{{FORMS_PRIVACY}}", FORMS_PRIVACY);
if (/\{\{[A-Z_]+\}\}/.test(html)) throw new Error("Unfilled placeholder: " + html.match(/\{\{[A-Z_]+\}\}/)[0]);
fs.writeFileSync(path.join(ROOT, process.env.OUT || "index.html"), html);
if (process.env.OUT) { console.log("wrote", process.env.OUT); process.exit(0); }
fs.writeFileSync(path.join(ROOT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${SITE}</loc><lastmod>${week.generated.slice(0, 10)}</lastmod><changefreq>weekly</changefreq></url></urlset>\n`);
fs.writeFileSync(path.join(ROOT, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${SITE}sitemap.xml\n`);
console.log(`built index.html (${week.range}, ${week.events.length} events, ${items.length} gallery images; newsletter: ${NL.kitFormId ? "Kit" : "email app"}, contact: ${CT.web3formsKey ? "Web3Forms" : "email app"})`);
