import { GameStore } from "./store.ts";

/**
 * The daily board's rules are all about what it refuses to do — take a second entry from the same
 * player, keep a worse score, or grow without bound. Those are the properties that decide whether
 * the board is worth looking at after a hundred people have retried the same field, so they are
 * what is tested here.
 */

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

const DAY = "2026-07-29";

Deno.test("a daily score lands on the board", async () => {
  const store = new GameStore();
  const board = await store.addDailyScore(DAY, { name: "ORION", score: 42_000, wave: 6, at: 1 });
  assert(board.length === 1, `expected one entry, got ${board.length}`);
  assert(board[0].name === "ORION", "wrong name stored");
  assert(board[0].score === 42_000, "wrong score stored");
});

Deno.test("the board is sorted by score", async () => {
  const store = new GameStore();
  await store.addDailyScore(DAY, { name: "LOW", score: 10, wave: 1, at: 1 });
  await store.addDailyScore(DAY, { name: "HIGH", score: 90_000, wave: 9, at: 2 });
  await store.addDailyScore(DAY, { name: "MID", score: 5_000, wave: 4, at: 3 });
  const board = await store.getDailyBoard(DAY);
  assert(board.map((e) => e.name).join(",") === "HIGH,MID,LOW", `wrong order: ${board.map((e) => e.name)}`);
});

Deno.test("a player keeps one row, and it is their best", async () => {
  const store = new GameStore();
  await store.addDailyScore(DAY, { name: "ORION", score: 20_000, wave: 4, at: 1 });
  await store.addDailyScore(DAY, { name: "ORION", score: 55_000, wave: 7, at: 2 });
  const board = await store.getDailyBoard(DAY);
  assert(board.length === 1, `retrying should not add a row, got ${board.length}`);
  assert(board[0].score === 55_000, `expected the better score, got ${board[0].score}`);
});

Deno.test("a worse retry does not overwrite the best", async () => {
  const store = new GameStore();
  await store.addDailyScore(DAY, { name: "ORION", score: 55_000, wave: 7, at: 1 });
  await store.addDailyScore(DAY, { name: "ORION", score: 900, wave: 2, at: 2 });
  const board = await store.getDailyBoard(DAY);
  assert(board.length === 1, "still one row");
  assert(board[0].score === 55_000, `a worse run overwrote the best: ${board[0].score}`);
});

Deno.test("the board is capped", async () => {
  const store = new GameStore();
  for (let i = 0; i < 80; i++) {
    await store.addDailyScore(DAY, { name: `P${i}`, score: i * 100, wave: 1, at: i });
  }
  const board = await store.getDailyBoard(DAY);
  assert(board.length === 50, `expected the cap at 50, got ${board.length}`);
  /* The cap has to keep the top, not the first fifty that happened to arrive. */
  assert(board[0].score === 7_900, `cap dropped the leader: ${board[0].score}`);
});

Deno.test("days do not leak into each other", async () => {
  const store = new GameStore();
  await store.addDailyScore(DAY, { name: "ORION", score: 42_000, wave: 6, at: 1 });
  const other = await store.getDailyBoard("2026-07-30");
  assert(other.length === 0, `tomorrow already has ${other.length} entries`);
});
