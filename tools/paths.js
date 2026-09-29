import path from "node:path";
import { fileURLToPath } from "node:url";
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
// The Moonshot Almanac studio (renders star charts and holds the post graphics). Override with STUDIO=/path.
export const STUDIO = path.resolve(process.env.STUDIO || path.join(ROOT, "../fb-page-studio"));
