const sourceDir = new URL("../client/game-src/", import.meta.url);
const output = new URL("../client/game.js", import.meta.url);

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

if (import.meta.main) await buildClient(true);
