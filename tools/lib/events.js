// Computes "this week's sky" for the central U.S. with Astronomy Engine.
// Absolute moments (a moon phase, an opposition) are given in Central Time. Viewing advice
// ("around 8:15 p.m., face east") is local clock time, which works across the lower 48.
import * as A from "astronomy-engine";

export const TZ = "America/Chicago";
export const LOC = { lat: 39.0, lon: -95.0, elev: 300, label: "the central U.S. (39°N, 95°W)" };
const obs = new A.Observer(LOC.lat, LOC.lon, LOC.elev);
const DAY = 86400000;

// ---------- time helpers (Central Time) ----------
const parts = (d, o) => Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", ...o }).formatToParts(d).map(p => [p.type, p.value]));
function tzOffsetMin(d) {
  const p = parts(d, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  return (Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(d.getTime() / 1000) * 1000) / 60000;
}
// Wall-clock Central Time -> Date
export function ctDate(ymd, h = 0, m = 0) {
  const [y, mo, d] = ymd.split("-").map(Number);
  let t = Date.UTC(y, mo - 1, d, h, m) + 5 * 3600000;
  for (let i = 0; i < 3; i++) t = Date.UTC(y, mo - 1, d, h, m) - tzOffsetMin(new Date(t)) * 60000;
  return new Date(t);
}
export const ymdCT = d => { const p = parts(d, { year: "numeric", month: "2-digit", day: "2-digit" }); return `${p.year}-${p.month}-${p.day}`; };
export const addDays = (ymd, n) => { const d = new Date(ymd + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const clock = d => new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }).format(d).replace("AM", "a.m.").replace("PM", "p.m.");
const zone = d => parts(d, { timeZoneName: "short" }).timeZoneName; // CDT / CST
export const timeCT = d => `${clock(d)} ${zone(d)}`;
export const dayLabel = ymd => new Date(ymd + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" });
const longDay = ymd => new Date(ymd + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", weekday: "long", month: "long", day: "numeric" });
// Round a moment to the nearest quarter hour for "around 8:15 p.m." advice.
const roundQ = d => new Date(Math.round(d.getTime() / 900000) * 900000);
const localClock = d => clock(roundQ(d));
const hourCT = d => { const r = new Date(Math.round(d.getTime() / 3600000) * 3600000); return `${clock(r).replace(":00", "")} ${zone(r)}`; };

// ---------- sky helpers ----------
const toDate = t => (t instanceof Date ? t : t.date);
function altaz(body, date) {
  const eq = A.Equator(body, date, obs, true, true);
  const h = A.Horizon(date, obs, eq.ra, eq.dec, "normal");
  return { alt: h.altitude, az: h.azimuth, vec: eq.vec };
}
const sunAlt = d => altaz("Sun", d).alt;
function riseSet(body, dir, from, limitDays = 1.2) {
  const r = A.SearchRiseSet(body, obs, dir, from, limitDays);
  return r ? r.date : null;
}
const DIRS = ["north", "north-northeast", "northeast", "east-northeast", "east", "east-southeast", "southeast", "south-southeast", "south", "south-southwest", "southwest", "west-southwest", "west", "west-northwest", "northwest", "north-northwest"];
const ABBR = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
const dirIdx = az => Math.round((((az % 360) + 360) % 360) / 22.5) % 16;
export const dirWord = az => DIRS[dirIdx(az)];
export const dirAbbr = az => ABBR[dirIdx(az)];
function height(alt) {
  if (alt < 6) return "just above the horizon";
  if (alt < 12) return "about one fist above the horizon";
  if (alt > 70) return "almost straight overhead";
  const f = Math.round(alt / 10);
  return `about ${["", "one", "two", "three", "four", "five", "six", "seven"][f]} fists above the horizon`;
}
function apart(sep) {
  if (sep < 1) return "less than a finger-width apart (a finger at arm's length is about 1°)";
  if (sep < 2) return "about a finger-width apart (a finger at arm's length is about 1°)";
  if (sep < 3.5) return `about ${Math.round(sep)}° apart, a couple of finger-widths`;
  if (sep < 7) return `about ${sep.toFixed(0)}° apart, less than a fist`;
  return `about ${sep.toFixed(0)}° apart, roughly a fist`;
}
const mag = b => A.Illumination(b, new Date()).mag;

// Viewing moments for a CT date: evening = 1 h after that day's sunset, morning = 1 h before that day's sunrise.
function twilightTimes(ymd) {
  const set = riseSet("Sun", -1, ctDate(ymd, 12));
  const rise = riseSet("Sun", +1, ctDate(ymd, 0));
  return { sunset: set, sunrise: rise, evening: new Date(set.getTime() + 3600000), morning: new Date(rise.getTime() - 3600000) };
}

const PLANETS = ["Mercury", "Venus", "Mars", "Jupiter", "Saturn"];
const PLANET_NOTE = { Mercury: "a small yellowish-white point", Venus: "the brightest point in the sky", Mars: "a steady orange-red point", Jupiter: "a bright, steady cream-white point", Saturn: "a steady golden point" };
// Bright stars and a cluster the Moon can pass (J2000 RA hours, Dec degrees).
const STARS = [
  { name: "Regulus", ra: 10.1395, dec: 11.967 },
  { name: "Spica", ra: 13.4199, dec: -11.161 },
  { name: "Antares", ra: 16.4901, dec: -26.432 },
  { name: "Aldebaran", ra: 4.5987, dec: 16.509 },
  { name: "Pollux", ra: 7.7553, dec: 28.026 },
  { name: "the Pleiades", ra: 3.7914, dec: 24.105, cluster: true },
];
const STAR_SLOTS = [A.Body.Star1, A.Body.Star2, A.Body.Star3, A.Body.Star4, A.Body.Star5, A.Body.Star6];
STARS.forEach((s, i) => { A.DefineStar(STAR_SLOTS[i], s.ra, s.dec, 1000); s.body = STAR_SLOTS[i]; });

// Meteor showers: peak by J2000 solar longitude and ZHR from the IMO working list. rad = radiant (RA°, Dec°);
// width = rough hours for the rate to fall off from the peak (Quadrantids are sharp, Orionids broad).
const SHOWERS = [
  { name: "Quadrantid", sl: 283.15, zhr: 80, rad: [230, 49], width: 6 },
  { name: "Lyrid", sl: 32.32, zhr: 18, rad: [272, 33], width: 14 },
  { name: "Eta Aquariid", sl: 45.5, zhr: 50, rad: [338, -1], width: 48 },
  { name: "Southern Delta Aquariid", sl: 127, zhr: 25, rad: [340, -16], width: 72 },
  { name: "Perseid", sl: 140.0, zhr: 100, rad: [48, 58], width: 30 },
  { name: "Draconid", sl: 195.4, zhr: 10, rad: [262, 54], width: 6, evening: true },
  { name: "Orionid", sl: 208, zhr: 20, rad: [95, 16], width: 48 },
  { name: "Leonid", sl: 235.27, zhr: 15, rad: [152, 22], width: 24 },
  { name: "Geminid", sl: 262.2, zhr: 150, rad: [112, 33], width: 24 },
  { name: "Ursid", sl: 270.7, zhr: 10, rad: [217, 76], width: 12 },
];
// Solar longitude on the J2000 mean ecliptic (what IMO peak values use). A.Ecliptic() is ecliptic-of-date, ~9 h off.
const ROT_EQJ_ECL = A.Rotation_EQJ_ECL();
function solarLonJ2000(d) { const v = A.RotateVector(ROT_EQJ_ECL, A.GeoVector("Sun", d, true)); return ((Math.atan2(v.y, v.x) * 180) / Math.PI + 360) % 360; }
// Expected meteors/hour for a watcher under fairly dark skies at moment t: ZHR x radiant height x distance from peak x moonlight.
function meteorRate(s, peak, t) {
  if (sunAlt(t) > -15) return 0;
  const h = A.Horizon(t, obs, s.rad[0] / 15, s.rad[1], null).altitude;
  if (h <= 0) return 0;
  const m = altaz("Moon", t), lit = A.Illumination("Moon", t).phase_fraction;
  const moon = m.alt > 0 ? 1 - 0.75 * lit : 1;
  return s.zhr * Math.sin((h * Math.PI) / 180) * Math.exp(-Math.abs(t - peak) / 3600000 / s.width) * moon * 0.5;
}
function searchSolarLon(target, from) {
  // step a day at a time until we cross the target, then bisect
  let t0 = from, l0 = solarLonJ2000(t0);
  for (let i = 0; i < 380; i++) {
    const t1 = new Date(t0.getTime() + DAY), l1 = solarLonJ2000(t1);
    const d0 = ((target - l0 + 540) % 360) - 180, d1 = ((target - l1 + 540) % 360) - 180;
    if (d0 >= 0 && d1 < 0) {
      let a = t0, b = t1;
      for (let k = 0; k < 30; k++) { const m = new Date((a.getTime() + b.getTime()) / 2); ((((target - solarLonJ2000(m) + 540) % 360) - 180) >= 0 ? (a = m) : (b = m)); }
      return a;
    }
    t0 = t1; l0 = l1;
  }
  return null;
}

// Full Moon names (traditional, as used by almanacs). Harvest = full moon nearest the September equinox.
const MOON_NAMES = ["Wolf", "Snow", "Worm", "Pink", "Flower", "Strawberry", "Buck", "Sturgeon", "Corn", "Hunter's", "Beaver", "Cold"];
function fullMoonName(t) {
  const y = +ymdCT(t).slice(0, 4);
  const eq = A.Seasons(y).sep_equinox.date;
  let q = A.SearchMoonQuarter(new Date(eq.getTime() - 20 * DAY));
  const fulls = [];
  for (let i = 0; i < 8; i++) { if (q.quarter === 2) fulls.push(q.time.date); q = A.NextMoonQuarter(q); }
  const harvest = fulls.reduce((a, b) => (Math.abs(b - eq) < Math.abs(a - eq) ? b : a));
  const hunters = fulls.find(f => f > harvest);
  if (Math.abs(t - harvest) < 2 * DAY) return "Harvest Moon";
  if (hunters && Math.abs(t - hunters) < 2 * DAY) return "Hunter's Moon";
  const m = +ymdCT(t).slice(5, 7) - 1;
  if (m === 8) return "Corn Moon"; // a September full moon that isn't the Harvest Moon
    return MOON_NAMES[m] + " Moon";
}

// Visible planets at a moment: above 8°, Sun well down.
function visiblePlanets(d, min = 8) {
  if (sunAlt(d) > -6) return [];
  return PLANETS.map(b => ({ b, ...altaz(b, d), mag: A.Illumination(b, d).mag })).filter(p => p.alt >= min);
}

function look(body, d, label) {
  const p = typeof body === "string" ? altaz(body, d) : body;
  return { when: d.toISOString(), time: localClock(d), alt: +p.alt.toFixed(1), az: +p.az.toFixed(1), dir: dirWord(p.az), abbr: dirAbbr(p.az), label };
}

export function computeWeek(startYmd, days = 7) {
  const start = ctDate(startYmd, 0), end = ctDate(addDays(startYmd, days), 0);
  const inWin = d => d >= start && d < end;
  const dates = Array.from({ length: days }, (_, i) => addDays(startYmd, i));
  const tw = Object.fromEntries(dates.map(y => [y, twilightTimes(y)]));
  const mid = tw[dates[Math.floor(days / 2)]];
  const ev = [];
  const push = e => ev.push({ ...e, dayLabel: dayLabel(e.date) });

  // A) Moon phases
  for (let q = A.SearchMoonQuarter(new Date(start.getTime() - DAY)); q.time.date < end; q = A.NextMoonQuarter(q)) {
    const t = q.time.date;
    if (!inWin(t)) continue;
    const date = ymdCT(t), T = tw[date] || twilightTimes(date);
    if (q.quarter === 0) push({ id: "moon-new", kind: "moon", tag: "Moon", score: 45, date, time: timeCT(t), title: "New Moon",
      body: `The Moon is between Earth and the Sun, lost in the Sun's glare. The nights on either side are the darkest of the month: a good week to look for faint stars and, from a dark site, the Milky Way.` });
    if (q.quarter === 1) {
      const set = riseSet("Moon", -1, t);
      push({ id: "moon-first", kind: "moon", tag: "Moon", score: 35, date, time: timeCT(t), title: "First Quarter Moon", look: look("Moon", T.evening, "Moon"),
        body: `Half lit and ${height(altaz("Moon", T.evening).alt)} in the ${dirWord(altaz("Moon", T.evening).az)} at dusk; it sets around ${set ? localClock(set) : "midnight"}. Binoculars show craters sharply along the line between light and dark.` });
    }
    if (q.quarter === 2) {
      const rise = riseSet("Moon", +1, new Date(T.sunset.getTime() - 4 * 3600000));
      const name = fullMoonName(t);
      push({ id: "moon-full", kind: "moon", tag: "Moon", score: 60, date, time: timeCT(t), title: `Full Moon: the ${name}`,
        body: `It rises in the ${dirWord(altaz("Moon", rise || T.sunset).az)} ${rise ? `around ${localClock(rise)}` : "near sunset"} and stays up all night. The rising Moon looks huge near the horizon; that's an illusion (it's the same size overhead).`, look: rise ? look("Moon", new Date(rise.getTime() + 1800000), "Moon") : undefined });
    }
    if (q.quarter === 3) {
      const rise = riseSet("Moon", +1, new Date(t.getTime() - 12 * 3600000));
      push({ id: "moon-last", kind: "moon", tag: "Moon", score: 35, date, time: timeCT(t), title: "Last Quarter Moon",
        body: `Half lit, rising around ${rise ? localClock(rise) : "midnight"} and high in the south at dawn. Evenings are Moon-free for the week ahead, which is good for stargazing.` });
    }
  }

  // B) Oppositions (bright outer planets)
  for (const b of ["Mars", "Jupiter", "Saturn"]) {
    const h = A.SearchRelativeLongitude(b, 0, new Date(start.getTime() - 3 * DAY));
    if (!h) continue;
    const f = d => (((A.PairLongitude(b, "Sun", d) - 180 + 540) % 360) - 180);
    const t = A.Search(f, h.AddDays(-3), h.AddDays(3)) || h;
    if (!inWin(t.date)) continue;
    const date = ymdCT(t.date), T = tw[date] || twilightTimes(date);
    const at = new Date(T.evening.getTime() + 1.5 * 3600000), p = altaz(b, at);
    const dist = A.GeoVector(b, t.date, true).Length() * 92955807;
    push({ id: `opp-${b.toLowerCase()}`, kind: "planet", tag: "Planet", score: 90, date, time: `Early ${+parts(t.date, { hour: "2-digit" }).hour < 12 ? "morning" : "evening"}, around ${hourCT(t.date)}`, title: `${b} at opposition`, target: b, look: look(b, at, b),
      body: `Earth passes between the Sun and ${b}, so it's at its brightest of the year, rises at sunset and is up all night. Around ${localClock(at)}, face ${dirWord(p.az)} and look ${height(p.alt)} for ${PLANET_NOTE[b]}. Distance: about ${(dist / 1e6).toFixed(0)} million miles.` });
  }

  // C) Greatest elongations of Mercury and Venus (only if reasonably placed from the U.S.)
  for (const b of ["Mercury", "Venus"]) {
    const e = A.SearchMaxElongation(b, new Date(start.getTime() - DAY));
    if (!e || !inWin(e.time.date)) continue;
    const date = ymdCT(e.time.date), T = tw[date] || twilightTimes(date);
    const evening = e.visibility === "evening";
    const at = new Date((evening ? T.sunset : T.sunrise).getTime() + (evening ? 1 : -1) * 45 * 60000);
    const p = altaz(b, at);
    if (p.alt < 5) continue;
    push({ id: `elong-${b.toLowerCase()}`, kind: "planet", tag: "Planet", score: b === "Venus" ? 70 : 55, date, time: timeCT(e.time.date), title: `${b} at its farthest from the Sun (${e.visibility} sky)`, target: b, look: look(b, at, b),
      body: `${b} is as far from the Sun in our sky as it gets this time around (${e.elongation.toFixed(0)}°). About 45 minutes ${evening ? "after sunset" : "before sunrise"}, around ${localClock(at)}, look ${dirWord(p.az)}, ${height(p.alt)}, for ${PLANET_NOTE[b]}.${b === "Mercury" ? " A clear, flat horizon helps; binoculars can help you find it, but put them away before the Sun comes up." : ""}` });
  }

  // D) Moon near planets and bright stars (closest visible evening/morning pairing per target)
  const targets = [...PLANETS.map(b => ({ name: b, body: b, planet: true })), ...STARS.map(s => ({ name: s.name, body: s.body, cluster: s.cluster }))];
  for (const tg of targets) {
    let best = null;
    for (const y of dates) for (const slot of ["evening", "morning"]) {
      const d = slot === "evening" ? tw[y].evening : tw[y].morning;
      const m = altaz("Moon", d), p = altaz(tg.body, d);
      if (m.alt < 8 || p.alt < 8 || sunAlt(d) > -8) continue;
      if (tg.planet && A.Illumination(tg.body, d).mag > 1.8) continue;
      const sep = A.AngleBetween(m.vec, p.vec);
      // a "morning" slot belongs to the night that started the previous evening; label it by its calendar date
      if (sep <= 6 && (!best || sep < best.sep)) best = { sep, d, y, slot, m, p };
    }
    if (!best) continue;
    const w = best.slot === "evening" ? "evening" : "morning";
    const date = ymdCT(best.d);
    push({ id: `moon-${tg.name.toLowerCase().replace(/[^a-z]/g, "")}`, kind: "pair", tag: "Moon", score: 50 + (tg.planet ? 15 : 0) - best.sep * 3 + (tg.cluster ? 5 : 0), date,
      time: `${w === "evening" ? "Evening" : "Before dawn"}, around ${localClock(best.d)}`, title: `The Moon ${best.sep < 3 ? "right beside" : "near"} ${tg.name}`, target: tg.planet ? tg.name : undefined, pair: tg.name, look: look("Moon", best.d, "Moon"),
      body: `${w === "evening" ? "In the evening" : "Before dawn"}, around ${localClock(best.d)}, face ${dirWord(best.m.az)} and look ${height(best.m.alt)}: the Moon and ${tg.name} are ${apart(best.sep)}.${tg.planet ? ` ${tg.name} is ${PLANET_NOTE[tg.name]}.` : tg.cluster ? " Binoculars show the cluster's tight knot of stars best." : ""} The pair shifts a little each night as the Moon moves.` });
  }

  // E) Planet–planet pairings (bright planets within 3°)
  for (let i = 0; i < PLANETS.length; i++) for (let j = i + 1; j < PLANETS.length; j++) {
    const a = PLANETS[i], b = PLANETS[j];
    let best = null;
    for (const y of dates) for (const slot of ["evening", "morning"]) {
      const d = tw[y][slot], pa = altaz(a, d), pb = altaz(b, d);
      if (pa.alt < 6 || pb.alt < 6) continue;
      const sep = A.AngleBetween(pa.vec, pb.vec);
      if (sep <= 3 && (!best || sep < best.sep)) best = { sep, d, slot, pa };
    }
    if (!best) continue;
    push({ id: `pair-${a}-${b}`.toLowerCase(), kind: "pair", tag: "Planet", score: 80 - best.sep * 5, date: ymdCT(best.d), time: `${best.slot === "evening" ? "Evening" : "Before dawn"}, around ${localClock(best.d)}`,
      title: `${a} and ${b} side by side`, target: a, look: look(a, best.d, a),
      body: `Face ${dirWord(best.pa.az)}, ${height(best.pa.alt)}: ${a} and ${b} are ${apart(best.sep)}. They only look close; they're hundreds of millions of miles apart in space.` });
  }

  // F) Meteor shower peaks: pick the best night near the peak and the best hours that night
  for (const s of SHOWERS) {
    const t = searchSolarLon(s.sl, new Date(start.getTime() - 2 * DAY));
    if (!t || !inWin(t)) continue;
    const date = ymdCT(t);
    let best = null;
    for (const n of [addDays(date, -1), date]) {
      const set = riseSet("Sun", -1, ctDate(n, 12)), rise = riseSet("Sun", +1, set);
      const samples = [];
      for (let u = set.getTime(); u < rise.getTime(); u += 900000) { const d = new Date(u); samples.push({ d, r: meteorRate(s, t, d) }); }
      const top = samples.reduce((a, b) => (b.r > a.r ? b : a));
      if (!best || top.r > best.top.r) best = { n, samples, top, set, rise };
    }
    const good = best.samples.filter(x => x.r >= best.top.r * 0.6);
    const from = good[0].d, to = good[good.length - 1].d;
    const lit = A.Illumination("Moon", best.top.d).phase_fraction;
    const moonUpAtBest = altaz("Moon", best.top.d).alt > 0;
    const mset = riseSet("Moon", -1, best.set, 0.6), mrise = riseSet("Moon", +1, best.set, 0.6);
    let moonNote;
    if (lit < 0.2) moonNote = "Moonlight won't get in the way this year.";
    else if (moonUpAtBest) moonNote = `The Moon (${Math.round(lit * 100)}% lit) is up then, and its glare will hide the fainter meteors.`;
    else if (mset && mset < best.top.d && mset > best.set) moonNote = `The Moon sets around ${localClock(mset)}, leaving darker skies after that.`;
    else if (mrise && mrise > best.top.d && mrise < best.rise) moonNote = `The Moon rises around ${localClock(mrise)}, so watch before then.`;
    else moonNote = "The Moon is out of the way during those hours.";
    const rate = Math.round(best.top.r);
    const rateText = rate >= 12 ? `perhaps ${Math.round(rate / 5) * 5}` : rate >= 4 ? `perhaps ${rate}` : "only a few";
    const hours = to - from < 1800000 ? `around ${localClock(from)}` : `from about ${localClock(from)} to ${localClock(to)}`;
    const natural = s.evening ? date : +parts(t, { hour: "2-digit" }).hour < 12 ? addDays(date, -1) : date;
    const shift = best.n !== natural ? ` The peak itself falls ${best.n < natural ? "the following night" : "the night before"}, but ${moonUpAtBest || lit < 0.2 ? "the radiant sits higher" : "moonlight is heavier then, so"} this night is the better bet.` : "";
    const nightText = s.evening ? `the evening of ${dayLabel(best.n)}` : `the night of ${dayLabel(best.n)} into ${dayLabel(addDays(best.n, 1))}`;
    push({ id: `meteor-${s.name.toLowerCase().replace(/[^a-z]/g, "")}`, kind: "meteor", tag: "Meteors", score: s.zhr >= 80 ? 85 : 50 + Math.min(rate, 15), date: best.n, time: `Peak expected ${dayLabel(ymdCT(t))}, around ${hourCT(t)}`, title: `${s.name} meteor shower peaks`,
      body: `Watch ${nightText}, best ${hours}. From a dark spot away from city lights, expect ${rateText} meteors an hour at best, fewer from town. ${moonNote}${shift} Lie back, look up at the widest patch of dark sky, and give your eyes 20 minutes; no telescope or binoculars needed.` });
  }

  // G) Eclipses visible from the central U.S.
  const le = A.SearchLunarEclipse(start);
  if (le && inWin(le.peak.date) && altaz("Moon", le.peak.date).alt > 0) {
    const date = ymdCT(le.peak.date);
    push({ id: "eclipse-lunar", kind: "eclipse", tag: "Eclipse", score: 100, date, time: `Mid-eclipse ${timeCT(le.peak.date)}`, title: `${le.kind[0].toUpperCase() + le.kind.slice(1)} lunar eclipse`, look: look("Moon", le.peak.date, "Moon"),
      body: `The Moon passes through Earth's shadow; at mid-eclipse it's ${height(altaz("Moon", le.peak.date).alt)} in the ${dirWord(altaz("Moon", le.peak.date).az)}. Safe to watch with your eyes.${le.kind === "total" ? " During totality it can turn coppery red." : ""}` });
  }
  const se = A.SearchLocalSolarEclipse(start, obs);
  if (se && inWin(se.peak.time.date) && se.peak.altitude > 0) {
    push({ id: "eclipse-solar", kind: "eclipse", tag: "Eclipse", score: 100, date: ymdCT(se.peak.time.date), time: `Maximum ${timeCT(se.peak.time.date)}`, title: `${se.kind[0].toUpperCase() + se.kind.slice(1)} solar eclipse`,
      body: `The Moon covers ${Math.round(se.obscuration * 100)}% of the Sun at maximum from the central U.S. Never look at the Sun without certified eclipse glasses (ISO 12312-2) or a pinhole projector.` });
  }

  // H) Seasons and clock changes
  const y0 = +startYmd.slice(0, 4);
  for (const yy of [y0, y0 + 1]) {
    const S = A.Seasons(yy);
    for (const [k, name, note] of [["mar_equinox", "Spring begins (March equinox)", "Day and night are close to equal length."], ["jun_solstice", "Summer begins (June solstice)", "The longest day of the year in the Northern Hemisphere."], ["sep_equinox", "Autumn begins (September equinox)", "Day and night are close to equal length, and nights keep getting longer."], ["dec_solstice", "Winter begins (December solstice)", "The longest night of the year; days start getting longer tomorrow."]]) {
      const t = S[k].date;
      if (inWin(t)) push({ id: `season-${k}`, kind: "season", tag: "Season", score: 50, date: ymdCT(t), time: timeCT(t), title: name, body: `The Sun crosses a turning point in its yearly path at ${timeCT(t)}. ${note}` });
    }
  }
  for (const y of dates) {
    const a = tzOffsetMin(ctDate(y, 0)), b = tzOffsetMin(ctDate(y, 12));
    if (a !== b) push({ id: "clocks", kind: "season", tag: "Clocks", score: 40, date: y, time: "2:00 a.m. local", title: b < a ? "Clocks fall back one hour" : "Clocks spring forward one hour",
      body: b < a ? "Daylight saving time ends. Sunset comes an hour earlier by the clock, so the sky is dark by dinnertime: an easy week to get outside." : "Daylight saving time begins. Sunset comes an hour later by the clock, so plan on a later start for stargazing." });
  }

  // I) Planet roundup for anything bright that isn't already featured
  const featured = new Set(ev.filter(e => e.target && e.kind === "planet").map(e => e.target));
  for (const slot of ["evening", "morning"]) {
    const d = mid[slot], ymd = ymdCT(d);
    const ps = visiblePlanets(d).filter(p => !featured.has(p.b) && p.mag < 1.8).sort((a, b) => a.mag - b.mag);
    if (!ps.length) continue;
    const list = ps.map(p => `${p.b} ${height(p.alt).replace("about ", "").replace(" above the horizon", " up")} in the ${dirWord(p.az)}`);
    push({ id: `planets-${slot}`, kind: "roundup", tag: "Planets", score: slot === "evening" ? 32 : 28, date: ymd, time: `All week, around ${localClock(d)}`, title: slot === "evening" ? "Planets after dark" : "Planets before dawn", target: ps[0].b, look: look(ps[0].b, d, ps[0].b),
      body: `${slot === "evening" ? "About an hour after sunset" : "About an hour before sunrise"}: ${list.join("; ")}. Planets shine steadily; stars twinkle.` });
  }

  // Pick the top 5 (at least 3), then show them in date order
  const picked = ev.sort((a, b) => b.score - a.score).slice(0, 5).sort((a, b) => a.date.localeCompare(b.date) || b.score - a.score);
  const lead = [...picked].sort((a, b) => b.score - a.score).find(e => e.look && (e.target || e.look.label === "Moon"));
  const endYmd = addDays(startYmd, days - 1);
  return {
    generated: new Date().toISOString(),
    tz: TZ, zone: zone(start), location: LOC,
    start: startYmd, end: endYmd,
    range: `${dayLabel(startYmd)} – ${dayLabel(endYmd)}, ${endYmd.slice(0, 4)}`,
    sun: { sunset: localClock(mid.sunset), sunrise: localClock(mid.sunrise), day: dayLabel(ymdCT(mid.sunset)) },
    events: picked.map(({ score, ...e }) => ({ ...e, body: e.body.replace(/\.\.(\s|$)/g, ".$1") })),
    candidates: ev.length,
    lead: lead ? { id: lead.id, when: lead.look.when, body: lead.target || "Moon", pair: lead.pair, alt: lead.look.alt, az: lead.look.az, abbr: lead.look.abbr, dir: lead.look.dir, time: lead.look.time, day: longDay(ymdCT(new Date(lead.look.when))), title: lead.title } : null,
  };
}
