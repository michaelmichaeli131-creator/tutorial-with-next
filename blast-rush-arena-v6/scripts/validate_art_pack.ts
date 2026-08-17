/**
 * Validates an installed art pack.
 *
 * Runs as part of `deno task build`. When no pack is installed this exits 0 and says so — the game
 * renders procedurally and that is a supported state, not a failure. When a pack IS installed the
 * checks are strict, because a half-wired manifest fails silently at runtime (the renderer just
 * falls back per entry) and that is exactly the kind of bug nobody notices until release.
 */
const root = new URL("../", import.meta.url);
const packUrl = new URL("client/art/pack.json", root);

/** Every id the renderer will ask for. Missing ones are warnings: partial packs are supported. */
const EXPECTED = {
  creatures: ["normal", "armored", "bomb", "shard", "splitter", "rival"],
  pilots: ["vanguard", "lancer", "specter", "warden", "reaper", "omega"],
  abilities: ["overdrive", "blast", "pressure", "volley"],
};

let raw: string;
try {
  raw = await Deno.readTextFile(packUrl);
} catch {
  console.log("[art-pack] no client/art/pack.json — procedural art in use, nothing to validate");
  Deno.exit(0);
}

let manifest: Record<string, any>;
try {
  manifest = JSON.parse(raw);
} catch (error) {
  console.error(`[art-pack] pack.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  Deno.exit(1);
}

if (manifest.enabled === false) {
  console.log("[art-pack] pack.json present but disabled (enabled:false) — procedural art in use");
  Deno.exit(0);
}

const errors: string[] = [];
const warnings: string[] = [];
const base = String(manifest.basePath ?? "/art/").replace(/^\//, "");

async function checkAsset(label: string, spec: Record<string, any>) {
  if (!spec || typeof spec !== "object") return errors.push(`${label}: entry is not an object`);
  if (!spec.src) return errors.push(`${label}: missing "src"`);

  const frames = spec.frames ?? 1;
  const cols = spec.cols ?? frames;
  if (!Number.isInteger(frames) || frames < 1) errors.push(`${label}: "frames" must be a positive integer`);
  if (!Number.isInteger(cols) || cols < 1) errors.push(`${label}: "cols" must be a positive integer`);
  if (frames > 1 && cols > frames) warnings.push(`${label}: "cols" (${cols}) exceeds "frames" (${frames})`);
  if (spec.fps !== undefined && (typeof spec.fps !== "number" || spec.fps <= 0)) errors.push(`${label}: "fps" must be > 0`);
  if (spec.anchorY !== undefined && (spec.anchorY < 0 || spec.anchorY > 1)) errors.push(`${label}: "anchorY" must be within 0..1`);

  const fileUrl = new URL(`client/${base}${spec.src}`, root);
  try {
    const stat = await Deno.stat(fileUrl);
    if (!stat.isFile) errors.push(`${label}: "${spec.src}" is not a file`);
    else if (stat.size === 0) errors.push(`${label}: "${spec.src}" is empty`);
  } catch {
    errors.push(`${label}: file not found — ${base}${spec.src}`);
  }
}

let count = 0;
for (const group of ["creatures", "bosses", "pilots", "abilities"] as const) {
  for (const [id, spec] of Object.entries(manifest[group] ?? {})) {
    count++;
    await checkAsset(`${group}.${id}`, spec as Record<string, any>);
    if (group === "pilots" && (spec as Record<string, any>).portrait) {
      count++;
      await checkAsset(`${group}.${id}.portrait`, { src: (spec as Record<string, any>).portrait });
    }
  }
}
for (const [index, spec] of ((manifest.background?.layers ?? []) as Record<string, any>[]).entries()) {
  count++;
  await checkAsset(`background.layers[${index}]`, spec);
}

for (const [group, ids] of Object.entries(EXPECTED)) {
  for (const id of ids) {
    if (!manifest[group]?.[id]) warnings.push(`${group}.${id} not supplied — that one keeps procedural art`);
  }
}
if (!manifest.bosses?.default && !manifest.bosses?.["0"]) {
  warnings.push('bosses: no "default" or "0" entry — all titans keep procedural art');
}

for (const warning of warnings) console.warn(`[art-pack] warn: ${warning}`);
if (errors.length) {
  for (const error of errors) console.error(`[art-pack] error: ${error}`);
  console.error(`[art-pack] ${errors.length} error(s) — fix these or the assets silently fall back`);
  Deno.exit(1);
}

console.log(`[art-pack] "${manifest.name ?? "unnamed"}" OK • ${count} assets • ${warnings.length} warning(s)`);
