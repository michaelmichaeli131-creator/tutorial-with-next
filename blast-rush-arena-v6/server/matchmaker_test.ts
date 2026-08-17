import { Matchmaker } from "./matchmaker.ts";

/**
 * A stand-in for the socket half of `Deno.upgradeWebSocket`, recording everything the matchmaker
 * writes so a test can assert on the wire rather than on internals. Only the four members
 * `Matchmaker.attach()` touches are implemented.
 */
class TestSocket {
  readyState = 1;
  sent: Array<Record<string, unknown>> = [];
  #listeners: Record<string, Array<(event: unknown) => void>> = {};

  addEventListener(type: string, fn: (event: unknown) => void): void {
    (this.#listeners[type] ??= []).push(fn);
  }
  send(text: string): void {
    this.sent.push(JSON.parse(text) as Record<string, unknown>);
  }
  close(): void {
    if (this.readyState === 3) return;
    this.readyState = 3;
    for (const fn of this.#listeners.close ?? []) fn({});
  }
  recv(message: Record<string, unknown>): void {
    for (const fn of this.#listeners.message ?? []) fn({ data: JSON.stringify(message) });
  }
  last(type: string): Record<string, unknown> | undefined {
    return [...this.sent].reverse().find((entry) => entry.type === type);
  }
  all(type: string): Array<Record<string, unknown>> {
    return this.sent.filter((entry) => entry.type === type);
  }
}

/** Countdown and match are milliseconds long here so a whole duel fits inside a test. */
function arena(matchDurationMs = 900): Matchmaker {
  return new Matchmaker({ matchDurationMs, countdownMs: 20 });
}

function pilot(matchmaker: Matchmaker, name: string, playerId?: string): TestSocket {
  const socket = new TestSocket();
  matchmaker.attach(socket as unknown as WebSocket);
  socket.recv({ type: "hello", name, playerId });
  return socket;
}

function idOf(socket: TestSocket): string {
  return String(socket.last("welcome")?.playerId);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition: unknown, message: string): void {
  if (!condition) throw new Error(message);
}

/** Opens a private room and puts both pilots in it, returning once the match is live. */
async function duel(matchmaker: Matchmaker, host: TestSocket, friend: TestSocket): Promise<void> {
  host.recv({ type: "create_room", visibility: "private" });
  friend.recv({ type: "join_room", code: String(host.last("room_created")?.code) });
  await wait(120);
}

Deno.test("a waiting room survives its host going away to share the link", () => {
  const matchmaker = arena();
  const host = pilot(matchmaker, "ALEX");
  host.recv({ type: "create_room", visibility: "private" });
  const code = String(host.last("room_created")?.code);

  // The host switches to a messaging app and the phone drops the socket.
  host.close();

  const friend = pilot(matchmaker, "SAM");
  friend.recv({ type: "join_room", code });
  assert(!friend.last("error"), `friend was turned away: ${JSON.stringify(friend.last("error"))}`);
  assert(friend.last("room_joined"), "friend never got into the room");
  assert(!friend.last("match_found"), "a countdown started against an empty seat");

  // The host's client reconnects on its own and the duel begins.
  const back = pilot(matchmaker, "ALEX", idOf(host));
  assert(back.last("match_found"), "the match did not start when the host returned");
  assert(friend.last("match_found"), "the waiting friend was not told the match started");
});

Deno.test("the host opening their own invite link does not destroy the room", () => {
  const matchmaker = arena();
  const host = pilot(matchmaker, "ALEX");
  host.recv({ type: "create_room", visibility: "private" });
  const code = String(host.last("room_created")?.code);

  host.recv({ type: "join_room", code });

  const friend = pilot(matchmaker, "SAM");
  friend.recv({ type: "join_room", code });
  assert(!friend.last("error"), "the room stopped accepting joins after the host reopened it");
  assert(friend.last("match_found"), "the match never started");
});

Deno.test("a full room still refuses a third pilot", () => {
  const matchmaker = arena();
  const host = pilot(matchmaker, "ALEX");
  host.recv({ type: "create_room", visibility: "private" });
  const code = String(host.last("room_created")?.code);
  pilot(matchmaker, "SAM").recv({ type: "join_room", code });

  const gatecrasher = pilot(matchmaker, "KIM");
  gatecrasher.recv({ type: "join_room", code });
  assert(gatecrasher.last("error"), "a third pilot got in");
});

Deno.test("a departing pilot is announced by name", () => {
  const matchmaker = arena();
  const host = pilot(matchmaker, "ALEX");
  host.recv({ type: "create_room", visibility: "public", tableName: "TABLE" });
  const friend = pilot(matchmaker, "SAM");
  friend.recv({ type: "join_room", code: String(host.last("room_created")?.code) });

  host.recv({ type: "leave" });
  const left = friend.last("opponent_left");
  assert(left, "the survivor was never told");
  assert(left?.name === "ALEX", `expected ALEX, got ${JSON.stringify(left)}`);
});

Deno.test("a dropped duellist is announced with a deadline to come back", () => {
  const matchmaker = arena();
  const host = pilot(matchmaker, "ALEX");
  host.recv({ type: "create_room", visibility: "private" });
  const friend = pilot(matchmaker, "SAM");
  friend.recv({ type: "join_room", code: String(host.last("room_created")?.code) });

  host.close();
  const notice = friend.all("player_connection").find((entry) => entry.connected === false);
  assert(notice, "no disconnect notice reached the other player");
  assert(notice?.name === "ALEX", "the notice did not say who dropped");
  assert(Number(notice?.reconnectDeadline) > Date.now(), "no deadline to count down to");
});

Deno.test("vitals mirror a duellist's lives to their rival", async () => {
  const matchmaker = arena();
  const host = pilot(matchmaker, "ALEX");
  const friend = pilot(matchmaker, "SAM");
  await duel(matchmaker, host, friend);

  host.recv({ type: "vitals", lives: 1, combo: 12 });
  await wait(500);

  const players = friend.last("match_state")?.players as Array<Record<string, unknown>>;
  const alex = players.find((entry) => entry.name === "ALEX");
  assert(alex?.lives === 1, `expected 1 life on the wire, got ${JSON.stringify(alex)}`);
  assert(alex?.combo === 12, "combo did not travel with vitals");
});

Deno.test("vitals are rate limited and clamped", async () => {
  const matchmaker = arena();
  const host = pilot(matchmaker, "ALEX");
  const friend = pilot(matchmaker, "SAM");
  await duel(matchmaker, host, friend);

  host.recv({ type: "vitals", lives: 9_999 });
  for (let i = 0; i < 50; i++) host.recv({ type: "vitals", lives: 0 });
  await wait(500);

  const players = friend.last("match_state")?.players as Array<Record<string, unknown>>;
  const alex = players.find((entry) => entry.name === "ALEX");
  assert(alex?.lives === 9, `expected the clamp to hold at 9, got ${JSON.stringify(alex)}`);
});

Deno.test("vitals from outside a live match are ignored", () => {
  const matchmaker = arena();
  const host = pilot(matchmaker, "ALEX");
  host.recv({ type: "create_room", visibility: "private" });
  host.recv({ type: "vitals", lives: 0 });
  const snapshot = host.last("room_created")?.players as Array<Record<string, unknown>>;
  assert(snapshot[0].lives === 3, "a lobby-time vitals message was accepted");
});

Deno.test("the head-to-head record carries across rooms", async () => {
  const matchmaker = arena(700);
  const host = pilot(matchmaker, "ALEX");
  const friend = pilot(matchmaker, "SAM");
  const alexId = idOf(host);
  const samId = idOf(friend);

  const playAndWin = async (winner: TestSocket, seq: number) => {
    await duel(matchmaker, host, friend);
    winner.recv({ type: "score", seq, delta: 5_000, event: "wave" });
    await wait(1_100);
  };

  await playAndWin(host, 1);
  let series = host.last("match_end")?.series as Record<string, unknown>;
  assert(series?.games === 1, `expected one game, got ${JSON.stringify(series)}`);

  // A brand new room for the second game: the record has to find the same pair anyway.
  await playAndWin(friend, 2);
  series = friend.last("match_end")?.series as Record<string, unknown>;
  const standings = series?.standings as Array<Record<string, unknown>>;
  assert(series?.games === 2, `expected two games, got ${JSON.stringify(series)}`);
  assert(standings.find((entry) => entry.id === alexId)?.wins === 1, "ALEX's win was lost");
  assert(standings.find((entry) => entry.id === samId)?.wins === 1, "SAM's win was lost");
  assert(standings.every((entry) => typeof entry.name === "string"), "the record has no names to show");
});

Deno.test("a forfeit is not recorded as a win", async () => {
  const matchmaker = arena(4_000);
  const host = pilot(matchmaker, "ALEX");
  const friend = pilot(matchmaker, "SAM");
  await duel(matchmaker, host, friend);

  friend.recv({ type: "leave" });
  const ended = host.last("match_end");
  assert(ended?.reason === "disconnect", `expected a forfeit, got ${JSON.stringify(ended?.reason)}`);
  const series = ended?.series as Record<string, unknown> | null;
  assert(!series || series.games === 0, `a forfeit was counted: ${JSON.stringify(series)}`);
});

Deno.test("a rematch handshake says who has agreed", async () => {
  const matchmaker = arena(700);
  const host = pilot(matchmaker, "ALEX");
  const friend = pilot(matchmaker, "SAM");
  await duel(matchmaker, host, friend);
  await wait(1_100);

  host.recv({ type: "rematch" });
  const state = friend.last("rematch_state");
  const players = state?.players as Array<Record<string, unknown>>;
  assert(players.find((entry) => entry.name === "ALEX")?.rematch === true, "ALEX's agreement did not travel");
  assert(players.find((entry) => entry.name === "SAM")?.rematch === false, "SAM was marked as agreeing");

  friend.recv({ type: "rematch" });
  await wait(120);
  assert(host.all("match_found").length === 2, "the second game never started");
});

Deno.test("a draw is recorded as a draw, not a win for whoever sorted first", async () => {
  const matchmaker = arena(700);
  const host = pilot(matchmaker, "ALEX");
  const friend = pilot(matchmaker, "SAM");
  await duel(matchmaker, host, friend);
  await wait(1_100);

  const ended = host.last("match_end");
  assert(ended?.winnerId === null, "a 0-0 duel produced a winner");
  const series = ended?.series as Record<string, unknown>;
  assert(series?.draws === 1, `expected a draw on the record, got ${JSON.stringify(series)}`);
  const standings = series?.standings as Array<Record<string, unknown>>;
  assert(standings.every((entry) => entry.wins === 0), "a draw handed someone a win");
});
