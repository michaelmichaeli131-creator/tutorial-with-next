const root = new URL("../", import.meta.url);
const gameUrl = new URL("client/game.js", root);
const netUrl = new URL("client/net.js", root);
const htmlUrl = new URL("client/index.html", root);

const [game, net, html] = await Promise.all([
  Deno.readTextFile(gameUrl),
  Deno.readTextFile(netUrl),
  Deno.readTextFile(htmlUrl),
]);

for (const [name, source] of [["game.js", game], ["net.js", net]] as const) {
  try {
    new Function(source);
  } catch (error) {
    throw new Error(`${name} syntax validation failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const htmlIds = new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]));
const referencedIds = new Set([...game.matchAll(/\$\(["']([^"']+)["']\)/g)].map((match) => match[1]));
const missing = [...referencedIds].filter((id) => !htmlIds.has(id)).sort();
if (missing.length) throw new Error(`Missing HTML IDs referenced by game.js: ${missing.join(", ")}`);

for (const asset of ["client/styles.css", "client/v7-overrides.css", "client/mobile-v8.css", "client/cinematic-v9.css"]) {
  await Deno.stat(new URL(asset, root));
}

console.log(`[validate] client syntax OK • ${htmlIds.size} HTML IDs • ${referencedIds.size} referenced IDs • cinematic assets present`);
