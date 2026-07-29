const sourceDir = new URL("../client/game-src/", import.meta.url);
const output = new URL("../client/game.js", import.meta.url);
const cssBundle = new URL("../client/bundle.css", import.meta.url);

/**
 * Twelve stylesheets meant twelve round trips before the page could be styled, which on a phone
 * costs twelve times the network latency rather than twelve times the bytes. They ship as one file.
 *
 * The order is declared here rather than scraped from index.html, because index.html now links
 * only the bundle and scraping it would make the build read its own output. This list is the
 * source of truth and the order is load-bearing: the visual system is layers of deliberate
 * overrides, so reordering it would silently change the cascade. Adding a stylesheet means adding
 * it here, and the build fails loudly if a listed file is missing rather than shipping a bundle
 * with a hole in it.
 */
const STYLESHEETS = [
  "styles.css",
  "mobile-v8.css",
  "cinematic-v9.css",
  "mobile-cinematic-v10.css",
  "mobile-pro-v12.css",
  "premium-v13.css",
  "v14-campaign.css",
  "v15-vision.css",
  "v16-impact.css",
  "v17-hud.css",
  "v18-home.css",
  "v19-craft.css",
  "v20-duel.css",
  "v37-result.css",
  "v38-settings.css",
  "v41-titan.css",
];

export async function buildStyles(): Promise<void> {
  const parts: string[] = [];
  for (const name of STYLESHEETS) {
    const url = new URL(`../client/${name}`, import.meta.url);
    let css: string;
    try {
      css = await Deno.readTextFile(url);
    } catch {
      throw new Error(`Stylesheet ${name} is listed in the build but does not exist`);
    }
    parts.push(`/* ---------- ${name} ---------- */`, css);
  }
  await Deno.writeTextFile(cssBundle, parts.join("\n"));
  console.log(`[build] client/bundle.css generated from ${STYLESHEETS.length} stylesheets`);
}

export async function buildClient(force = false): Promise<void> {
  const files: string[] = [];
  let newestSource = 0;
  for await (const entry of Deno.readDir(sourceDir)) {
    if (!entry.isFile || !entry.name.endsWith(".part")) continue;
    files.push(entry.name);
    const stat = await Deno.stat(new URL(entry.name, sourceDir));
    newestSource = Math.max(newestSource, stat.mtime?.getTime() ?? 0);
  }
  files.sort();
  if (!files.length) throw new Error("No client game source parts found");

  if (!force) {
    try {
      const outputStat = await Deno.stat(output);
      if ((outputStat.mtime?.getTime() ?? 0) >= newestSource) return;
    } catch { /* Build artifact does not exist yet. */ }
  }

  const chunks = await Promise.all(files.map((name) => Deno.readTextFile(new URL(name, sourceDir))));
  await Deno.writeTextFile(output, chunks.join(""));
  console.log(`[build] client/game.js generated from ${files.length} source parts`);
}

if (import.meta.main) {
  await buildClient(true);
  await buildStyles();
}
