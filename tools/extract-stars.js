// One-time: build assets/data/sky.json (bright stars + constellation lines) from the studio's d3-celestial catalog.
//   node tools/extract-stars.js
import fs from "node:fs";
import path from "node:path";
import { STUDIO, ROOT } from "./paths.js";

const D = path.join(STUDIO, "node_modules/d3-celestial/data");
const read = f => JSON.parse(fs.readFileSync(path.join(D, f), "utf8"));
const stars = read("stars.6.json"), lines = read("constellations.lines.json"), names = read("starnames.json");
const r2 = x => Math.round(x * 100) / 100;
const ra = x => r2((x + 360) % 360); // d3-celestial wraps RA to ±180
const out = {
  note: "Stars to mag 4.8 and IAU constellation stick figures, from d3-celestial (BSD-3-Clause, Olaf Frohn). [raDeg, decDeg, mag, bv]",
  stars: stars.features.filter(f => f.properties.mag <= 4.8).map(f => [ra(f.geometry.coordinates[0]), r2(f.geometry.coordinates[1]), r2(f.properties.mag), r2(+f.properties.bv || 0.6)]),
  names: stars.features.filter(f => f.properties.mag <= 1.3 && names[f.id]?.name).map(f => [names[f.id].name, ra(f.geometry.coordinates[0]), r2(f.geometry.coordinates[1])]),
  lines: lines.features.map(f => f.geometry.coordinates.map(seg => seg.map(c => [ra(c[0]), r2(c[1])]))),
};
const file = path.join(ROOT, "assets/data/sky.json");
fs.writeFileSync(file, JSON.stringify(out));
console.log("wrote", file, (fs.statSync(file).size / 1024).toFixed(0) + " KB", out.stars.length, "stars", out.names.map(n => n[0]).join(", "));
