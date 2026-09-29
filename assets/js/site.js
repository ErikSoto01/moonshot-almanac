// Moonshot Almanac: live sky dial, moon phase, stale-guide notice, gallery lightbox.
// Everything is computed in the browser with Astronomy Engine. Nothing is sent anywhere.
(() => {
  "use strict";
  const A = window.Astronomy;
  const D2R = Math.PI / 180;
  const CENTRAL = { lat: 39, lon: -95, tz: "America/Chicago", label: "central U.S." };
  let place = { ...CENTRAL };
  let mode = null; // "now" | "tonight" | "dawn"
  let sky = null;  // star catalog

  // ---------- time helpers ----------
  const fmt = (d, o) => new Intl.DateTimeFormat("en-US", { timeZone: place.tz, ...o }).format(d);
  const clock = d => fmt(d, { hour: "numeric", minute: "2-digit" }).replace("AM", "a.m.").replace("PM", "p.m.");
  const zoneName = d => (new Intl.DateTimeFormat("en-US", { timeZone: place.tz, timeZoneName: "short" }).formatToParts(d).find(p => p.type === "timeZoneName") || {}).value || "";
  function wall(d) { // wall-clock parts in place.tz
    const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: place.tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(d).map(x => [x.type, x.value]));
    return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute };
  }
  function atWall(y, m, d, h) { // Date for a wall-clock time in place.tz
    let t = Date.UTC(y, m - 1, d, h);
    for (let i = 0; i < 3; i++) { const w = wall(new Date(t)); t += (Date.UTC(y, m - 1, d, h) - Date.UTC(w.y, w.m - 1, w.d, w.h, w.min)); }
    return new Date(t);
  }
  function whenFor(m, now = new Date()) {
    if (m === "now") return now;
    const w = wall(now);
    if (m === "tonight") return atWall(w.y, w.m, w.d, 21); // 9 p.m. on today's date
    let t = atWall(w.y, w.m, w.d, 5); // before dawn: the next 5 a.m.
    if (t <= now) t = atWall(w.y, w.m, w.d + 1, 5);
    return t;
  }

  // ---------- sky math ----------
  function altaz(raDeg, decDeg, lst, lat) {
    const H = (lst - raDeg) * D2R, d = decDeg * D2R, p = lat * D2R;
    const alt = Math.asin(Math.sin(p) * Math.sin(d) + Math.cos(p) * Math.cos(d) * Math.cos(H));
    const az = Math.atan2(-Math.cos(d) * Math.sin(H), Math.sin(d) * Math.cos(p) - Math.cos(d) * Math.cos(H) * Math.sin(p));
    return { alt: alt / D2R, az: ((az / D2R) + 360) % 360 };
  }
  const DIRS = ["north", "north-northeast", "northeast", "east-northeast", "east", "east-southeast", "southeast", "south-southeast", "south", "south-southwest", "southwest", "west-southwest", "west", "west-northwest", "northwest", "north-northwest"];
  const dirWord = az => DIRS[Math.round(az / 22.5) % 16];
  const PLANETS = ["Mercury", "Venus", "Mars", "Jupiter", "Saturn"];
  const PCOL = { Mercury: "#D8CFBF", Venus: "#FFF6DA", Mars: "#FF8A5B", Jupiter: "#F6E1BE", Saturn: "#F0DDA4" };
  function bodyPos(name, date, obs) {
    const eq = A.Equator(name, date, obs, true, true);
    const h = A.Horizon(date, obs, eq.ra, eq.dec, "normal");
    return { alt: h.altitude, az: h.azimuth };
  }
  function bv(b) { // B-V colour index -> soft star colour
    const t = Math.min(1, Math.max(0, (b + 0.3) / 2));
    return `rgb(${Math.round(185 + 70 * Math.min(1, t * 1.8))},${Math.round(205 - 9 * t - Math.max(0, t - .55) * 90)},${Math.round(255 - 105 * Math.min(1, t * 1.25))})`;
  }

  // ---------- the dial ----------
  const canvas = document.getElementById("dial");
  const status = document.getElementById("dial-status");
  function draw() {
    if (!canvas || !A || !sky) return;
    const date = whenFor(mode);
    const css = canvas.getBoundingClientRect().width || 480;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(css * dpr); canvas.height = Math.round(css * dpr);
    const g = canvas.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const S = css, cx = S / 2, cy = S / 2, R = S / 2 - Math.max(26, S * .07);
    const light = matchMedia("(prefers-color-scheme: light)").matches;
    const gold = "#F2C46D", ringInk = light ? "#0B1230" : "#F2C46D", labelInk = light ? "#8C5A00" : "#F2C46D";
    const obs = new A.Observer(place.lat, place.lon, 0);
    const lst = ((A.SiderealTime(date) * 15 + place.lon) % 360 + 360) % 360;
    // planisphere orientation: N up, E left (the view looking up, facing south)
    const P = (alt, az) => { const r = (90 - alt) / 90 * R, a = az * D2R; return [cx - r * Math.sin(a), cy - r * Math.cos(a)]; };
    const sun = bodyPos("Sun", date, obs);

    g.clearRect(0, 0, S, S);
    // outer almanac ring: degree ticks and compass letters
    g.save();
    g.strokeStyle = ringInk; g.globalAlpha = .55; g.lineWidth = 1;
    g.beginPath(); g.arc(cx, cy, R + 12, 0, 7); g.stroke();
    for (let az = 0; az < 360; az += 5) {
      const len = az % 45 === 0 ? 9 : az % 15 === 0 ? 6 : 3;
      const a = az * D2R, x = Math.sin(a), y = Math.cos(a);
      g.beginPath(); g.moveTo(cx - (R + 3) * x, cy - (R + 3) * y); g.lineTo(cx - (R + 3 + len) * x, cy - (R + 3 + len) * y); g.stroke();
    }
    g.restore();
    g.fillStyle = labelInk;
    g.font = `600 ${Math.max(11, S * .028)}px "IBM Plex Mono", monospace`;
    g.textAlign = "center"; g.textBaseline = "middle";
    [["N", 0], ["E", 90], ["S", 180], ["W", 270]].forEach(([t, az]) => { const a = az * D2R, rr = R + Math.max(20, S * .05); g.fillText(t, cx - rr * Math.sin(a), cy - rr * Math.cos(a)); });

    // sky disc; brighter when the Sun is near or above the horizon
    const tw = Math.min(1, Math.max(0, (sun.alt + 18) / 18));
    const grd = g.createRadialGradient(cx, cy, 0, cx, cy, R);
    grd.addColorStop(0, mix("#050A1E", "#3C5E9C", tw));
    grd.addColorStop(.8, mix("#0B1432", "#5579B5", tw));
    grd.addColorStop(1, mix("#1C2C58", "#7E9DCF", tw));
    g.save();
    g.beginPath(); g.arc(cx, cy, R, 0, 7); g.fillStyle = grd; g.fill(); g.clip();
    // altitude circles at 30° and 60°
    g.strokeStyle = "rgba(156,195,255,.14)"; g.setLineDash([3, 5]);
    [30, 60].forEach(a => { g.beginPath(); g.arc(cx, cy, (90 - a) / 90 * R, 0, 7); g.stroke(); });
    g.setLineDash([]);
    const starFade = 1 - tw * .85;
    // constellation stick figures
    g.strokeStyle = `rgba(156,195,255,${.3 * starFade})`; g.lineWidth = 1;
    for (const c of sky.lines) for (const seg of c) {
      g.beginPath(); let pen = false;
      for (const [ra, dec] of seg) {
        const h = altaz(ra, dec, lst, place.lat);
        if (h.alt < -2) { pen = false; continue; }
        const [x, y] = P(h.alt, h.az);
        pen ? g.lineTo(x, y) : g.moveTo(x, y); pen = true;
      }
      g.stroke();
    }
    // stars
    const k = S / 480;
    for (const [ra, dec, mag, b] of sky.stars) {
      const h = altaz(ra, dec, lst, place.lat);
      if (h.alt < 0) continue;
      const [x, y] = P(h.alt, h.az);
      g.globalAlpha = Math.min(1, .35 + (5 - mag) * .2) * starFade;
      g.fillStyle = bv(b);
      g.beginPath(); g.arc(x, y, Math.max(.6, (5.2 - mag) * .62) * k, 0, 7); g.fill();
    }
    g.globalAlpha = 1;
    // a few bright-star names
    g.font = `500 ${Math.max(10, 11 * k)}px Inter, sans-serif`; g.textAlign = "left";
    g.fillStyle = `rgba(201,214,245,${.7 * starFade})`;
    for (const [n, ra, dec] of sky.names) {
      const h = altaz(ra, dec, lst, place.lat); if (h.alt < 8) continue;
      const [x, y] = P(h.alt, h.az), w = g.measureText(n).width;
      const left = Math.hypot(x + 5 * k + w - cx, y - cy) > R - 4; // flip labels that would run off the disc
      g.textAlign = left ? "right" : "left"; g.fillText(n, left ? x - 5 * k : x + 5 * k, y - 6 * k);
    }
    g.textAlign = "left";
    // label that flips to the left near the disc edge
    const label = (t, x, y, dx, dy) => { const w = g.measureText(t).width, flip = Math.hypot(x + dx + w - cx, y + dy - cy) > R - 4; g.textAlign = flip ? "right" : "left"; g.fillText(t, flip ? x - dx : x + dx, y + dy); g.textAlign = "left"; };
    // planets
    const visible = [];
    for (const name of PLANETS) {
      const p = bodyPos(name, date, obs);
      if (p.alt < 0) continue;
      const [x, y] = P(p.alt, p.az);
      glow(g, x, y, 12 * k, "rgba(255,236,200,.35)");
      g.fillStyle = PCOL[name]; g.beginPath(); g.arc(x, y, 3.6 * k, 0, 7); g.fill();
      g.font = `700 ${Math.max(11, 13 * k)}px Inter, sans-serif`; g.fillStyle = gold;
      label(name, x, y, 7 * k, 11 * k);
      visible.push({ name, ...p });
    }
    // the Moon, lit on the side facing the Sun
    const m = bodyPos("Moon", date, obs);
    const phase = A.MoonPhase(date), frac = A.Illumination("Moon", date).phase_fraction;
    if (m.alt > -1) {
      const [x, y] = P(m.alt, m.az), [sx, sy] = P(sun.alt, sun.az);
      moonDisk(g, x, y, 8.5 * k, phase, Math.atan2(sy - y, sx - x));
      g.font = `700 ${Math.max(11, 13 * k)}px Inter, sans-serif`; g.fillStyle = "#EFEDE4";
      label("Moon", x, y, 12 * k, 13 * k);
      visible.push({ name: "Moon", ...m });
    }
    if (sun.alt > -0.8) {
      const [x, y] = P(sun.alt, sun.az);
      glow(g, x, y, 28 * k, "rgba(255,210,122,.55)");
      g.fillStyle = "#FFD27A"; g.beginPath(); g.arc(x, y, 7 * k, 0, 7); g.fill();
    }
    g.restore();
    // horizon ring
    g.strokeStyle = gold; g.lineWidth = 1.5; g.globalAlpha = .9;
    g.beginPath(); g.arc(cx, cy, R, 0, 7); g.stroke();
    g.globalAlpha = 1;

    // words: status line and a text description of the chart
    const when = mode === "now" ? `Now, ${clock(date)}` : mode === "tonight" ? `Tonight, ${clock(date)}` : `Before dawn, ${fmt(date, { weekday: "short" })} ${clock(date)}`;
    status.textContent = `${when} ${zoneName(date)} · ${place.label}${sun.alt > -6 ? " · Sun up or twilight" : ""}`;
    const list = visible.sort((a, b) => b.alt - a.alt).map(v => `${v.name} in the ${dirWord(v.az)}, ${Math.round(v.alt)}° up`);
    canvas.setAttribute("aria-label", `Sky chart for ${when} ${zoneName(date)}, ${place.label}${place.label.endsWith(".") ? "" : "."} ${list.length ? "Above the horizon: " + list.join("; ") + "." : "No bright planets or Moon above the horizon."}${sun.alt > -6 ? " The Sun is up or it is twilight, so stars are hard to see." : ""}`);
  }
  function mix(a, b, t) { const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); const x = p(a), y = p(b); return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * t)).join(",")})`; }
  function glow(g, x, y, r, c) { const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, c); rg.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = rg; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
  function moonDisk(g, x, y, r, phaseDeg, sunAngle) {
    g.save(); glow(g, x, y, r * 3.5, "rgba(235,235,225,.25)");
    g.translate(x, y); g.rotate(sunAngle);
    g.fillStyle = "#2B2F3D"; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill();
    const c = Math.cos(phaseDeg * D2R);
    g.fillStyle = "#EFEDE4"; g.beginPath();
    g.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, false);
    g.ellipse(0, 0, Math.abs(r * c), r, 0, Math.PI / 2, -Math.PI / 2, c > 0);
    g.fill(); g.restore();
  }

  // ---------- moon widget ----------
  function moonPath(phaseDeg, R = 46) {
    const k = Math.cos(phaseDeg * D2R), rx = Math.abs(k) * R, waxing = phaseDeg < 180;
    if (waxing) return `M0 ${-R} A${R} ${R} 0 0 1 0 ${R} A${rx} ${R} 0 0 ${k < 0 ? 1 : 0} 0 ${-R}Z`;
    return `M0 ${-R} A${R} ${R} 0 0 0 0 ${R} A${rx} ${R} 0 0 ${k < 0 ? 0 : 1} 0 ${-R}Z`;
  }
  function phaseName(p) {
    if (p < 6 || p > 354) return "New Moon";
    if (p < 84) return "Waxing crescent";
    if (p <= 96) return "First quarter";
    if (p < 174) return "Waxing gibbous";
    if (p <= 186) return "Full Moon";
    if (p < 264) return "Waning gibbous";
    if (p <= 276) return "Last quarter";
    return "Waning crescent";
  }
  function moonWidget() {
    const now = new Date(), p = A.MoonPhase(now), f = A.Illumination("Moon", now).phase_fraction;
    document.getElementById("moon-lit").setAttribute("d", moonPath(p));
    document.getElementById("moon-phase").textContent = `${phaseName(p)} · ${Math.round(f * 100)}% lit`;
    const day = d => `${fmt(d, { weekday: "short", month: "short", day: "numeric" })}, ${clock(d)} ${zoneName(d)}`;
    const full = A.SearchMoonPhase(180, now, 40), nu = A.SearchMoonPhase(0, now, 40);
    const next = [["Full Moon", full], ["New Moon", nu]].sort((a, b) => a[1].date - b[1].date);
    const box = document.getElementById("moon-next");
    box.replaceChildren(...next.map(([n, t]) => { const s = document.createElement("span"); s.textContent = `${n}: ${day(t.date)}`; return s; }));
  }

  // ---------- controls ----------
  function setMode(m) {
    mode = m;
    document.querySelectorAll(".dial-controls button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mode === m)));
    draw();
  }
  document.querySelectorAll(".dial-controls button").forEach(b => b.addEventListener("click", () => setMode(b.dataset.mode)));
  const locate = document.getElementById("locate");
  if (locate) {
    if (!("geolocation" in navigator)) locate.hidden = true;
    locate.addEventListener("click", () => {
      locate.textContent = "Finding you…";
      navigator.geolocation.getCurrentPosition(pos => {
        place = { lat: Math.round(pos.coords.latitude * 10) / 10, lon: Math.round(pos.coords.longitude * 10) / 10, tz: Intl.DateTimeFormat().resolvedOptions().timeZone, label: "your location" };
        locate.textContent = "Back to the central U.S.";
        locate.onclick = () => { place = { ...CENTRAL }; locate.textContent = "Use my location"; locate.onclick = null; draw(); moonWidget(); };
        draw(); moonWidget();
      }, () => { locate.textContent = "Location unavailable"; }, { maximumAge: 600000, timeout: 10000 });
    }, { once: true });
  }

  // ---------- stale guide notice ----------
  function staleCheck() {
    const el = document.querySelector("[data-week-end]");
    if (!el) return;
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: CENTRAL.tz }).format(new Date()); // YYYY-MM-DD
    const note = document.getElementById("stale");
    if (note && today > el.dataset.weekEnd) note.hidden = false;
  }

  // ---------- lightbox ----------
  const lb = document.getElementById("lightbox");
  if (lb && typeof lb.showModal === "function") {
    document.querySelectorAll("[data-lightbox]").forEach(a => a.addEventListener("click", e => {
      e.preventDefault();
      const img = a.querySelector("img");
      lb.querySelector("img").src = a.href;
      lb.querySelector("img").alt = img.alt;
      lb.querySelector(".lb-cap").textContent = a.dataset.caption || "";
      lb.showModal();
    }));
    lb.addEventListener("click", e => { if (e.target === lb) lb.close(); });
  }

  // ---------- newsletter + contact forms ----------
  // data-provider on each form: "kit" (newsletter service), "web3forms" (contact relay) or "mailto" (visitor's email app).
  const MESSAGES = {
    email: "Please enter an email address like name@example.com.",
    name: "Please tell us your name.",
    message: "Please write a message.",
  };
  function fieldError(input) {
    if (input.validity.valid) return "";
    if (input.type === "email") return MESSAGES.email;
    if (input.name === "name") return MESSAGES.name;
    if (input.tagName === "TEXTAREA") return MESSAGES.message;
    return "Please fill this in.";
  }
  function showErrors(form) {
    let first = null;
    form.querySelectorAll("input[required], textarea[required]").forEach(input => {
      input.value = input.value.trim() === "" ? "" : input.value;
      const msg = fieldError(input), err = document.getElementById(input.id + "-err");
      input.setAttribute("aria-invalid", msg ? "true" : "false");
      if (err) err.textContent = msg;
      if (msg && !first) first = input;
    });
    if (first) first.focus();
    return !first;
  }
  function setStatus(form, kind, html) {
    const st = form.querySelector(".status");
    st.className = "status" + (kind ? " " + kind : "");
    st.innerHTML = html;
  }
  const escHTML = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  async function post(url, data) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 15000);
    try {
      const r = await fetch(url, { method: "POST", body: data, headers: { Accept: "application/json" }, signal: ctl.signal });
      let j = {};
      try { j = await r.json(); } catch { /* not JSON */ }
      return { ok: r.ok, j };
    } finally { clearTimeout(timer); }
  }
  function mailtoURL(form, lines) {
    const to = form.dataset.to, topic = form.elements.topic ? `: ${form.elements.topic.value}` : "";
    const subject = (new URL(form.action).searchParams.get("subject") || "Moonshot Almanac") + topic;
    return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
  }
  function wireForm(form, handlers) {
    if (!form) return;
    form.noValidate = true; // we show friendlier messages ourselves
    form.querySelectorAll("input[required], textarea[required]").forEach(i => i.addEventListener("input", () => {
      if (i.getAttribute("aria-invalid") === "true" && i.validity.valid) { i.setAttribute("aria-invalid", "false"); const e = document.getElementById(i.id + "-err"); if (e) e.textContent = ""; }
    }));
    form.addEventListener("submit", async e => {
      e.preventDefault();
      if (!showErrors(form)) return;
      const trap = form.querySelector('input[name="website"]');
      const btn = form.querySelector('button[type="submit"]');
      if (trap && trap.value) { form.reset(); setStatus(form, "ok", handlers.okText(form)); return; } // bot: pretend it worked
      const provider = form.dataset.provider;
      if (provider === "mailto") {
        window.location.href = mailtoURL(form, handlers.mailtoLines(form));
        setStatus(form, "ok", handlers.mailtoText(form));
        return;
      }
      const data = new FormData(form);
      data.delete("website");
      btn.disabled = true;
      const label = btn.textContent;
      btn.textContent = "Sending…";
      setStatus(form, "", "");
      try {
        const { ok, j } = await post(form.action, data);
        const good = provider === "kit" ? j.status === "success" : ok && j.success === true;
        if (!good) throw new Error((j.errors && j.errors.messages && j.errors.messages[0]) || (j.body && j.body.message) || j.message || "Request failed");
        setStatus(form, "ok", handlers.okText(form));
        form.reset();
      } catch (err) {
        console.warn("Form error:", err && err.message);
        const to = form.dataset.to;
        setStatus(form, "bad", `Sorry, that didn't go through. Please try again in a moment, or email us at <a href="mailto:${to}">${to}</a>.`);
      } finally {
        btn.disabled = false;
        btn.textContent = label;
      }
    });
  }
  const nl = document.getElementById("letter-form");
  wireForm(nl, {
    okText: f => f.dataset.provider === "kit" && f.dataset.doubleOptIn !== "false"
      ? "<strong>Almost done!</strong> Check your inbox for a confirmation email from Moonshot Almanac and tap the button inside. (If it's not there in a few minutes, look in Promotions or Spam.)"
      : "<strong>You're on the list!</strong> Look for this week's sky in your inbox on Friday.",
    mailtoLines: f => ["Please add me to the Moonshot Almanac newsletter.", "", `Email: ${f.elements.email_address.value.trim()}`, `First name: ${f.elements["fields[first_name]"].value.trim() || "-"}`],
    mailtoText: f => `Your email app should open with a signup message ready to go. <strong>Just press Send.</strong> If nothing opened, email <a href="mailto:${f.dataset.to}?subject=Newsletter%20signup">${f.dataset.to}</a> with the subject “Newsletter.”`,
  });
  const ct = document.getElementById("contact-form");
  wireForm(ct, {
    okText: f => `<strong>Thanks${f.elements.name.value.trim() ? ", " + escHTML(f.elements.name.value.trim().split(" ")[0]) : ""}!</strong> Your message is on its way to us, and we'll reply by email.`,
    mailtoLines: f => [f.elements.message.value.trim(), "", "—", `Name: ${f.elements.name.value.trim()}`, `Email: ${f.elements.email.value.trim()}`, `Topic: ${f.elements.topic.value}`],
    mailtoText: f => `Your email app should open with your message ready to go. <strong>Just press Send.</strong> If nothing opened, email us at <a href="mailto:${f.dataset.to}">${f.dataset.to}</a>.`,
  });
  if (ct) {
    // topic-specific hints and a subject line that says what the message is about
    const hints = {
      "A question about the sky": "Tell us what you saw, roughly when, and where you were (city or state is plenty).",
      "A correction": "Which post was it, and what should it say? A link to your source helps.",
      "Sharing a sky photo": "Paste a link to your photo (Google Photos, iCloud, Flickr…) and tell us when and where you took it.",
      "Brand partnership": "Tell us about your brand, what you have in mind, and your timing.",
      "Something else": "Tell us as much as you like.",
    };
    const topic = ct.elements.topic, hint = document.getElementById("ct-message-hint"), subj = ct.querySelector('input[name="subject"]');
    const sync = () => { hint.textContent = hints[topic.value] || hints["Something else"]; if (subj) subj.value = `Moonshot Almanac website: ${topic.value}`; };
    topic.addEventListener("change", sync); sync();
    ct.addEventListener("reset", () => setTimeout(sync, 0));
    // after a no-JavaScript Web3Forms submit, the service sends visitors back with ?sent=contact
    if (new URLSearchParams(location.search).get("sent") === "contact") setStatus(ct, "ok", "<strong>Thanks!</strong> Your message is on its way to us, and we'll reply by email.");
  }
  // ---------- start ----------
  staleCheck();
  function start() {
    if (!window.Astronomy) return;
    moonWidget();
    fetch("assets/data/sky.json").then(r => r.json()).then(d => {
      sky = d;
      const s = bodyPos("Sun", new Date(), new A.Observer(CENTRAL.lat, CENTRAL.lon, 0));
      setMode(s.alt > -6 ? "tonight" : "now");
      let last = 0;
      new ResizeObserver(() => { const w = canvas.getBoundingClientRect().width; if (Math.abs(w - last) > 2) { last = w; draw(); } }).observe(canvas);
      setInterval(() => { if (mode === "now" && !document.hidden) draw(); }, 60000);
      matchMedia("(prefers-color-scheme: light)").addEventListener("change", draw);
    }).catch(() => { status.textContent = "Sky chart unavailable right now."; });
  }
  start();
})();
