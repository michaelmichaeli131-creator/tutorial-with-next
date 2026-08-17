import {
  cleanCode,
  cleanName,
  cleanSkin,
  cleanTableName,
  parseClientMessage,
  rivalryKey,
  SCORE_LIMITS,
  safeNumber,
  type ClientMessage,
  type AttackKind,
  ATTACKS,
  buildSpawnSchedule,
  type SpawnEntry,
  type HazardKind,
  type PublicPlayer,
  type PublicTable,
  type RoomVisibility,
  type ScoreEvent,
  type SeriesRecord,
} from "./protocol.ts";

interface PlayerState {
  id: string;
  name: string;
  skin: string;
  socket: WebSocket;
  roomCode: string | null;
  score: number;
  combo: number;
  wave: number;
  lives: number;
  pressure: number;
  ammo: number;
  ammoProgress: number;
  sentCores: number;
  defusedCores: number;
  lastSeq: number;
  rateWindowAt: number;
  rateEvents: number;
  lastVitalsAt: number;
  lastPressureAt: number;
  lastLaunchAt: number;
  attackCooldowns: Record<string, number>;
  connected: boolean;
  rematch: boolean;
  disconnectTimer: number | null;
}

/** Wins between one pair of pilots, kept past the room so a fresh invite continues the series. */
interface Rivalry {
  /** Ids in the same order as `rivalryKey`, with the latest name each pilot went by. */
  order: string[];
  names: Map<string, string>;
  wins: Map<string, number>;
  draws: number;
  games: number;
  touchedAt: number;
}

interface Room {
  code: string;
  title: string;
  visibility: RoomVisibility;
  players: PlayerState[];
  status: "waiting" | "countdown" | "playing" | "finished";
  seed: number;
  spawns: SpawnEntry[];
  startsAt: number;
  endsAt: number;
  timer: number | null;
  createdAt: number;
  finishedAt: number;
  /**
   * Pinned when the pairing is settled, because a forfeit reports the result after the player who
   * left has already been spliced out of `players` — at which point there is no way to work out
   * whose series this was.
   */
  rivalry: string;
}

const MATCH_DURATION_MS = 120_000;
const COUNTDOWN_MS = 4_000;
const MAX_SCORE_EVENTS_PER_SECOND = 45;
const MIN_VITALS_INTERVAL_MS = 200;
const PRESSURE_COOLDOWN_MS = 2_500;
const CORE_LAUNCH_COOLDOWN_MS = 650;
const RECONNECT_GRACE_MS = 12_000;
/**
 * How long a room that has not started yet survives its host going away.
 *
 * This is the single thing that used to break friend-vs-friend most often, and it broke silently.
 * Creating a private room and then sharing the link is not one continuous act on a phone: you leave
 * the browser for a messaging app, and mobile browsers freeze or drop the socket of a backgrounded
 * tab. The old `disconnect()` gave a grace period only to a countdown or a live match, so a waiting
 * room was destroyed the instant the host switched apps — the friend who tapped the freshly sent
 * link got "Room not found", and the host's client, which reconnects on its own after 1.2s, went on
 * showing a lobby with a code that addressed nothing.
 *
 * Three minutes covers finding the right chat, sending the link and waiting for it to be opened.
 */
const WAITING_ROOM_GRACE_MS = 3 * 60_000;
/** Rivalries idle for longer than this are dropped; a series only has to outlive a play session. */
const RIVALRY_TTL_MS = 6 * 60 * 60_000;
/**
 * How long a decided match is kept addressable so both players can still agree to a rematch.
 * Past this the room is dropped even if the sockets are still open — a client that sits on the
 * results screen used to pin its room, its spawn schedule and both player records in memory for
 * as long as the tab stayed open, and nothing ever collected them.
 */
const FINISHED_ROOM_TTL_MS = 5 * 60_000;
const AMMO_SCORE_STEP = 3_800;
const MAX_AMMO = 5;
const HAZARDS: HazardKind[] = ["gravity", "emp", "fracture", "swarm"];

/**
 * Only the two clocks are adjustable, and only so a test can play a duel out end to end.
 * A 120-second match with a 4-second countdown cannot be exercised by a test suite, and the parts
 * that most need covering — who is recorded as winning, what a forfeit does to the head-to-head
 * record — all live on the far side of that wait.
 */
export interface MatchmakerOptions {
  matchDurationMs?: number;
  countdownMs?: number;
}

export class Matchmaker {
  #players = new Map<string, PlayerState>();
  #rooms = new Map<string, Room>();
  #queue: PlayerState[] = [];
  #rivalries = new Map<string, Rivalry>();
  #matchDuration: number;
  #countdown: number;

  constructor(options: MatchmakerOptions = {}) {
    this.#matchDuration = Math.max(1_000, options.matchDurationMs ?? MATCH_DURATION_MS);
    this.#countdown = Math.max(0, options.countdownMs ?? COUNTDOWN_MS);
    setInterval(() => this.broadcastStates(), 400);
    setInterval(() => this.cleanup(), 30_000);
  }

  publicTables(): PublicTable[] {
    return [...this.#rooms.values()]
      .filter((room) => room.visibility === "public" && room.status === "waiting" && room.players.length === 1 && room.players[0]?.connected)
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 30)
      .map((room) => ({
        code: room.code,
        title: room.title,
        hostName: room.players[0].name,
        hostSkin: room.players[0].skin,
        createdAt: room.createdAt,
      }));
  }

  attach(socket: WebSocket): void {
    let player: PlayerState | null = null;

    socket.addEventListener("message", (event) => {
      if (typeof event.data !== "string") return;
      const message = parseClientMessage(event.data);
      if (!message) return this.send(socket, { type: "error", message: "Invalid message" });
      if (message.type === "hello") {
        if (player) {
          player.name = cleanName(message.name);
          player.skin = cleanSkin(message.skin);
          this.send(socket, { type: "welcome", playerId: player.id, name: player.name, skin: player.skin });
          const room = this.roomOf(player);
          if (room) this.broadcastRoomSnapshot(room);
        } else {
          player = this.register(socket, message.playerId, message.name, message.skin);
        }
        return;
      }
      if (!player) return this.send(socket, { type: "error", message: "Send hello first" });
      this.handle(player, message);
    });

    const leave = () => {
      if (player) this.disconnect(player);
    };
    socket.addEventListener("close", leave);
    socket.addEventListener("error", leave);
  }

  private register(socket: WebSocket, requestedId?: string, name?: string, skin?: string): PlayerState {
    const id = /^[a-zA-Z0-9_-]{8,64}$/.test(requestedId ?? "") ? requestedId! : crypto.randomUUID();
    const previous = this.#players.get(id);
    const player: PlayerState = previous
      ? {
        ...previous,
        name: cleanName(name || previous.name),
        skin: cleanSkin(skin || previous.skin),
        socket,
        connected: true,
        rateWindowAt: Date.now(),
        rateEvents: 0,
      }
      : {
        id,
        name: cleanName(name),
        skin: cleanSkin(skin),
        socket,
        roomCode: null,
        score: 0,
        combo: 0,
        wave: 1,
        lives: 3,
        pressure: 0,
        ammo: 1,
        ammoProgress: 0,
        sentCores: 0,
        defusedCores: 0,
        lastSeq: 0,
        rateWindowAt: Date.now(),
        rateEvents: 0,
        lastVitalsAt: 0,
        lastPressureAt: 0,
        attackCooldowns: {},
        lastLaunchAt: 0,
        connected: true,
        rematch: false,
        disconnectTimer: null,
      };

    if (previous?.disconnectTimer) clearTimeout(previous.disconnectTimer);
    player.disconnectTimer = null;

    if (previous) {
      const room = this.roomOf(previous);
      if (room) room.players = room.players.map((candidate) => candidate === previous ? player : candidate);
      this.#queue = this.#queue.map((candidate) => candidate === previous ? player : candidate);
      previous.connected = false;
    }
    this.#players.set(id, player);
    if (previous?.socket.readyState === WebSocket.OPEN) previous.socket.close(4001, "Reconnected elsewhere");

    this.send(socket, { type: "welcome", playerId: id, name: player.name, skin: player.skin, reconnected: Boolean(previous) });
    const room = this.roomOf(player);
    if (room) {
      this.broadcast(room, { type: "player_connection", playerId: player.id, name: player.name, connected: true });
      this.send(socket, this.roomPayload("room_joined", room, true));
      if (room.status === "waiting") {
        /* The friend may have arrived while this player was away sharing the link. Nothing else
           would ever start that match: joinRoom already ran and found the room half-connected. */
        this.startCountdown(room);
      } else if (room.status === "countdown") {
        this.send(socket, {
          type: "match_found",
          code: room.code,
          title: room.title,
          visibility: room.visibility,
          startsAt: room.startsAt,
          durationMs: this.#matchDuration,
          seed: room.seed,
          players: room.players.map(publicPlayer),
          reconnected: true,
        });
      } else if (room.status === "playing") {
        this.send(socket, { type: "match_start", startsAt: room.startsAt, endsAt: room.endsAt, seed: room.seed, spawns: room.spawns, reconnected: true });
        this.send(socket, { type: "match_state", serverAt: Date.now(), endsAt: room.endsAt, players: room.players.map(publicPlayer) });
      } else if (room.status === "finished") {
        const standings = [...room.players].sort((a, b) => b.score - a.score).map(publicPlayer);
        const winnerId = standings[0]?.score === standings[1]?.score ? null : standings[0]?.id ?? null;
        /* Replayed, not re-recorded: the result was already counted when the match ended. */
        this.send(socket, { type: "match_end", reason: "time", winnerId, standings, series: this.readSeries(room), reconnected: true });
      }
    }
    return player;
  }

  private handle(player: PlayerState, message: ClientMessage): void {
    switch (message.type) {
      case "quick_match": return this.quickMatch(player);
      case "create_room": return this.createRoom(player, message.visibility, message.tableName);
      case "join_room": return this.joinRoom(player, cleanCode(message.code));
      case "score": return this.score(player, message);
      case "vitals": return this.vitals(player, message);
      case "pressure": return this.pressure(player, message.seq);
      case "send_attack": return this.sendAttack(player, message.seq, message.kind);
      case "launch_core": return this.launchCore(player, message.seq);
      case "rematch": return this.rematch(player);
      case "leave": return this.leaveRoom(player);
      case "ping": return this.send(player.socket, { type: "pong", at: message.at, serverAt: Date.now() });
      default: return;
    }
  }

  private quickMatch(player: PlayerState): void {
    this.leaveRoom(player);
    this.#queue = this.#queue.filter((p) => p.id !== player.id && p.connected);
    const opponent = this.#queue.shift();
    if (!opponent) {
      this.#queue.push(player);
      this.send(player.socket, { type: "queue", status: "searching" });
      return;
    }
    const room = this.makeRoom([opponent, player], "private", "QUICK DUEL");
    this.startCountdown(room);
  }

  private createRoom(player: PlayerState, visibility: RoomVisibility = "private", tableName?: string): void {
    this.leaveRoom(player);
    const safeVisibility: RoomVisibility = visibility === "public" ? "public" : "private";
    const room = this.makeRoom([player], safeVisibility, cleanTableName(tableName || `${player.name}'S ARENA`));
    this.send(player.socket, this.roomPayload("room_created", room));
  }

  private joinRoom(player: PlayerState, code: string): void {
    const room = this.#rooms.get(code);
    if (!room || room.status !== "waiting") return this.send(player.socket, { type: "error", message: "Room not found or already started" });
    if (room.players.some((candidate) => candidate.id === player.id)) return this.send(player.socket, this.roomPayload("room_joined", room, true));
    if (room.players.length >= 2) return this.send(player.socket, { type: "error", message: "Room is full" });
    this.leaveRoom(player);
    room.players.push(player);
    player.roomCode = room.code;
    this.broadcastRoomSnapshot(room);
    this.startCountdown(room);
  }

  private makeRoom(players: PlayerState[], visibility: RoomVisibility, title: string): Room {
    const code = this.uniqueRoomCode();
    const room: Room = {
      code,
      title,
      visibility,
      players,
      status: "waiting",
      seed: crypto.getRandomValues(new Uint32Array(1))[0],
      spawns: [],
      startsAt: 0,
      endsAt: 0,
      timer: null,
      createdAt: Date.now(),
      finishedAt: 0,
      rivalry: "",
    };
    for (const player of players) {
      player.roomCode = code;
      this.resetPlayer(player);
    }
    this.#rooms.set(code, room);
    return room;
  }

  private resetPlayer(player: PlayerState): void {
    player.score = 0;
    player.combo = 0;
    player.wave = 1;
    player.lives = 3;
    player.pressure = 0;
    player.ammo = 1;
    player.ammoProgress = 0;
    player.sentCores = 0;
    player.attackCooldowns = {};
    player.defusedCores = 0;
    player.lastSeq = 0;
    player.lastVitalsAt = 0;
    player.lastPressureAt = 0;
    player.lastLaunchAt = 0;
    player.rematch = false;
  }

  /**
   * Both present, or nobody starts.
   *
   * The connected check is what makes WAITING_ROOM_GRACE_MS safe: a friend can arrive while the
   * host is still away in a messaging app, and rather than opening a countdown against an empty
   * seat the room simply holds until the host's client reconnects, at which point `register()`
   * calls back in here and the duel starts for real.
   */
  private startCountdown(room: Room): void {
    if (room.players.length !== 2 || room.status === "countdown" || room.status === "playing") return;
    if (!room.players.every((candidate) => candidate.connected)) return;
    room.status = "countdown";
    room.rivalry = this.openRivalry(room.players[0], room.players[1]);
    room.seed = crypto.getRandomValues(new Uint32Array(1))[0];
    room.spawns = buildSpawnSchedule(room.seed, this.#matchDuration);
    room.startsAt = Date.now() + this.#countdown;
    room.endsAt = room.startsAt + this.#matchDuration;
    for (const player of room.players) this.resetPlayer(player);
    this.broadcast(room, {
      type: "match_found",
      code: room.code,
      title: room.title,
      visibility: room.visibility,
      startsAt: room.startsAt,
      durationMs: this.#matchDuration,
      seed: room.seed,
      players: room.players.map(publicPlayer),
    });
    setTimeout(() => {
      if (room.status !== "countdown") return;
      room.status = "playing";
      this.broadcast(room, { type: "match_start", startsAt: room.startsAt, endsAt: room.endsAt, seed: room.seed, spawns: room.spawns });
      room.timer = setTimeout(() => this.finish(room, "time"), this.#matchDuration + 250) as unknown as number;
    }, this.#countdown);
  }

  private score(player: PlayerState, message: Extract<ClientMessage, { type: "score" }>): void {
    const room = this.roomOf(player);
    if (!room || room.status !== "playing") return;
    if (!Number.isInteger(message.seq) || message.seq <= player.lastSeq) return;
    player.lastSeq = message.seq;
    const now = Date.now();
    if (now - player.rateWindowAt >= 1_000) {
      player.rateWindowAt = now;
      player.rateEvents = 0;
    }
    if (++player.rateEvents > MAX_SCORE_EVENTS_PER_SECOND) return;

    const event = message.event as ScoreEvent;
    if (!(event in SCORE_LIMITS)) return;
    const max = SCORE_LIMITS[event];
    const delta = event === "penalty"
      ? -safeNumber(Math.abs(message.delta), 0, 15_000)
      : safeNumber(message.delta, 0, max);
    player.score = Math.max(0, player.score + delta);
    player.combo = safeNumber(message.combo, 0, 999);
    player.wave = safeNumber(message.wave, 1, 999);
    if (event === "rival_core") player.defusedCores++;

    if (delta > 0) {
      player.ammoProgress += Math.min(delta, 12_000);
      while (player.ammoProgress >= AMMO_SCORE_STEP && player.ammo < MAX_AMMO) {
        player.ammoProgress -= AMMO_SCORE_STEP;
        player.ammo++;
        this.send(player.socket, { type: "ammo_gained", ammo: player.ammo });
      }
    }

    const pressureGain = event === "perfect" ? 16 : event === "chain" ? 20 : event === "rival_core" ? 22 : event === "boss" ? 25 : Math.min(8, Math.ceil(Math.max(0, delta) / 900));
    player.pressure = Math.min(100, player.pressure + pressureGain);
  }

  /**
   * Mirror the parts of a duellist's situation that only their own client knows.
   *
   * Deliberately outside the `seq` ordering used by score, pressure and the sends: those are
   * commands whose replay would grant something, so a stale one must be dropped. This carries no
   * authority at all — a lying client can only misrepresent how much trouble it is in, which buys
   * it nothing — so it is rate limited rather than sequenced, and an unlucky reorder just means the
   * rival panel is 200ms stale instead of dropping the message that follows a burst of scoring.
   */
  private vitals(player: PlayerState, message: Extract<ClientMessage, { type: "vitals" }>): void {
    const room = this.roomOf(player);
    if (!room || room.status !== "playing") return;
    const now = Date.now();
    if (now - player.lastVitalsAt < MIN_VITALS_INTERVAL_MS) return;
    player.lastVitalsAt = now;
    player.lives = safeNumber(message.lives, 0, 9);
    if (message.combo !== undefined) player.combo = safeNumber(message.combo, 0, 999);
    if (message.wave !== undefined) player.wave = safeNumber(message.wave, 1, 999);
  }

  private pressure(player: PlayerState, seq: number): void {
    const room = this.roomOf(player);
    if (!room || room.status !== "playing") return;
    const now = Date.now();
    if (!Number.isInteger(seq) || seq <= player.lastSeq) return;
    player.lastSeq = seq;
    if (player.pressure < 100 || now - player.lastPressureAt < PRESSURE_COOLDOWN_MS) return;
    const opponent = room.players.find((candidate) => candidate.id !== player.id && candidate.connected);
    if (!opponent) return;
    player.pressure = 0;
    player.lastPressureAt = now;
    const kind = HAZARDS[Math.floor(Math.random() * HAZARDS.length)];
    this.send(opponent.socket, { type: "opponent_attack", kind, from: player.name, durationMs: kind === "swarm" ? 5_500 : 4_000 });
    this.send(player.socket, { type: "pressure_sent", kind });
    this.broadcast(room, { type: "arena_flash", playerId: player.id, kind });
  }

  /**
   * Buy a chosen threat with in-match charge.
   *
   * Cost and cooldown are enforced here rather than in the UI: the client only decides *what* to
   * ask for. Charge is earned by scoring during the match, so nothing a player bought with campaign
   * credits can be turned into pressure on an opponent — the anti-pay-to-win rule that applies to
   * pilot perks applies to sends too.
   */
  private sendAttack(player: PlayerState, seq: number, kind: AttackKind): void {
    const room = this.roomOf(player);
    if (!room || room.status !== "playing") return;
    if (!Number.isInteger(seq) || seq <= player.lastSeq) return;
    player.lastSeq = seq;

    /* hasOwnProperty, not a truthiness check: parseClientMessage only casts, so a crafted kind of
       "constructor" would otherwise resolve to an inherited member and pass as a valid spec. */
    if (typeof kind !== "string" || !Object.prototype.hasOwnProperty.call(ATTACKS, kind)) return;
    const spec = ATTACKS[kind];

    const now = Date.now();
    if (player.pressure < spec.cost) return;
    if (now < (player.attackCooldowns[kind] ?? 0)) return;

    const opponent = room.players.find((candidate) => candidate.id !== player.id && candidate.connected);
    if (!opponent) return;

    player.pressure -= spec.cost;
    player.attackCooldowns[kind] = now + spec.cooldownMs;

    if (kind === "core" || kind === "titan") {
      const titan = kind === "titan";
      const tier = titan
        ? 5
        : Math.max(1, Math.min(4, 1 + Math.floor(player.combo / 15) + Math.floor(player.wave / 10)));
      player.sentCores++;
      const core = {
        id: crypto.randomUUID(),
        tier,
        titan,
        from: player.name,
        skin: player.skin,
        hp: titan ? 6 : tier >= 3 ? 2 : 1,
        bonus: titan ? 9_000 : 1_500 + tier * 650,
        speed: titan ? .82 : 1 + tier * .12,
        sentAt: now,
      };
      this.send(opponent.socket, { type: "rival_core", core });
      this.broadcast(room, { type: "arena_launch", playerId: player.id, skin: player.skin, tier });
    } else {
      this.send(opponent.socket, {
        type: "opponent_attack",
        kind: kind as HazardKind,
        from: player.name,
        durationMs: spec.durationMs,
      });
      this.broadcast(room, { type: "arena_flash", playerId: player.id, kind });
    }

    this.send(player.socket, {
      type: "attack_sent",
      kind,
      pressure: player.pressure,
      readyAt: player.attackCooldowns[kind],
    });
  }

  private launchCore(player: PlayerState, seq: number): void {
    const room = this.roomOf(player);
    if (!room || room.status !== "playing") return;
    const now = Date.now();
    if (!Number.isInteger(seq) || seq <= player.lastSeq) return;
    player.lastSeq = seq;
    if (player.ammo < 1 || now - player.lastLaunchAt < CORE_LAUNCH_COOLDOWN_MS) return;
    const opponent = room.players.find((candidate) => candidate.id !== player.id && candidate.connected);
    if (!opponent) return;

    player.ammo--;
    player.sentCores++;
    player.lastLaunchAt = now;
    const tier = Math.max(1, Math.min(4, 1 + Math.floor(player.combo / 15) + Math.floor(player.wave / 10)));
    const core = {
      id: crypto.randomUUID(),
      tier,
      from: player.name,
      skin: player.skin,
      hp: tier >= 3 ? 2 : 1,
      bonus: 1_500 + tier * 650,
      speed: 1 + tier * .12,
      sentAt: now,
    };
    this.send(opponent.socket, { type: "rival_core", core });
    this.send(player.socket, { type: "core_launched", core, ammo: player.ammo });
    this.broadcast(room, { type: "arena_launch", playerId: player.id, skin: player.skin, tier });
  }

  private rematch(player: PlayerState): void {
    const room = this.roomOf(player);
    if (!room || room.status !== "finished") return;
    player.rematch = true;
    /* Names travel with the handshake so the waiting player can be told who they are waiting for.
       A bare list of ids left the client with nothing to say but "REMATCH REQUESTED", which is the
       same screen whether your friend already agreed, is still reading the result, or has gone. */
    this.broadcast(room, {
      type: "rematch_state",
      players: room.players.map((p) => ({ id: p.id, name: p.name, rematch: p.rematch, connected: p.connected })),
    });
    if (room.players.length === 2 && room.players.every((p) => p.connected && p.rematch)) this.startCountdown(room);
  }

  private finish(room: Room, reason: "time" | "disconnect"): void {
    if (room.status === "finished") return;
    room.status = "finished";
    room.finishedAt = Date.now();
    if (room.timer) clearTimeout(room.timer);
    room.timer = null;
    const standings = [...room.players].sort((a, b) => b.score - a.score).map(publicPlayer);
    const winnerId = standings[0]?.score === standings[1]?.score ? null : standings[0]?.id ?? null;
    /* A forfeit is not a result. Recording it would let someone farm a head-to-head record by
       killing the tab whenever they fall behind, and it would tell the survivor they beat a friend
       they never actually finished a match against. */
    const series = reason === "time" ? this.recordResult(room, winnerId) : this.readSeries(room);
    this.broadcast(room, { type: "match_end", reason, winnerId, standings, series });
  }

  /**
   * The running score between these two pilots, kept in the matchmaker rather than in the room.
   *
   * Rooms die: a room is dropped five minutes after a result, and a pair of friends who play again
   * from a fresh invite link get a new one. Keying on the pilot id pair means the series survives
   * both, so "we're 3-2" is still true after the room that started it is gone.
   */
  private openRivalry(a: PlayerState, b: PlayerState): string {
    const key = rivalryKey(a.id, b.id);
    const rivalry = this.#rivalries.get(key) ?? {
      order: a.id < b.id ? [a.id, b.id] : [b.id, a.id],
      names: new Map<string, string>(),
      wins: new Map<string, number>(),
      draws: 0,
      games: 0,
      touchedAt: 0,
    };
    /* Names are re-read every match: a pilot who renames themselves between games should show up
       under the new name on both sides of the record, not the one they had when it started. */
    rivalry.names.set(a.id, a.name);
    rivalry.names.set(b.id, b.name);
    rivalry.touchedAt = Date.now();
    this.#rivalries.set(key, rivalry);
    return key;
  }

  private recordResult(room: Room, winnerId: string | null): SeriesRecord | null {
    const rivalry = this.#rivalries.get(room.rivalry);
    if (!rivalry) return null;
    rivalry.games++;
    rivalry.touchedAt = Date.now();
    if (winnerId === null) rivalry.draws++;
    else rivalry.wins.set(winnerId, (rivalry.wins.get(winnerId) ?? 0) + 1);
    return seriesOf(rivalry);
  }

  private readSeries(room: Room): SeriesRecord | null {
    const rivalry = this.#rivalries.get(room.rivalry);
    return rivalry ? seriesOf(rivalry) : null;
  }

  private leaveRoom(player: PlayerState): void {
    if (player.disconnectTimer) clearTimeout(player.disconnectTimer);
    player.disconnectTimer = null;
    this.#queue = this.#queue.filter((candidate) => candidate.id !== player.id);
    const room = this.roomOf(player);
    if (!room) {
      player.roomCode = null;
      return;
    }
    room.players = room.players.filter((candidate) => candidate.id !== player.id);
    player.roomCode = null;
    if (room.status === "playing" || room.status === "countdown") this.finish(room, "disconnect");
    if (!room.players.length) this.#rooms.delete(room.code);
    /* Who left, and whether there is any point waiting: the survivor is sitting on either a lobby
       or a result screen, and both of those screens have a REMATCH-shaped promise on them that is
       no longer true. */
    else this.broadcast(room, { type: "opponent_left", playerId: player.id, name: player.name, status: room.status });
  }

  private disconnect(player: PlayerState): void {
    if (this.#players.get(player.id) !== player || !player.connected) return;
    player.connected = false;
    this.#queue = this.#queue.filter((candidate) => candidate !== player);
    const room = this.roomOf(player);

    /* A room that has not started yet gets a far longer grace than a live one, because the reason
       its owner vanished is usually that they went to send the invite. A live match cannot wait
       that long without wasting the other player's two minutes, so it keeps the short grace. */
    const grace = room
      ? room.status === "waiting" ? WAITING_ROOM_GRACE_MS : room.status === "countdown" || room.status === "playing" ? RECONNECT_GRACE_MS : 0
      : 0;

    if (room && grace > 0) {
      this.broadcast(room, {
        type: "player_connection",
        playerId: player.id,
        name: player.name,
        connected: false,
        reconnectDeadline: Date.now() + grace,
      });
      player.disconnectTimer = setTimeout(() => {
        if (this.#players.get(player.id) !== player || player.connected) return;
        player.disconnectTimer = null;
        this.leaveRoom(player);
        this.#players.delete(player.id);
      }, grace) as unknown as number;
      return;
    }

    this.leaveRoom(player);
    this.#players.delete(player.id);
  }

  private roomOf(player: PlayerState): Room | null {
    return player.roomCode ? this.#rooms.get(player.roomCode) ?? null : null;
  }

  private broadcastStates(): void {
    const now = Date.now();
    for (const room of this.#rooms.values()) {
      if (room.status !== "playing") continue;
      this.broadcast(room, {
        type: "match_state",
        serverAt: now,
        endsAt: room.endsAt,
        players: room.players.map(publicPlayer),
      });
      if (now >= room.endsAt) this.finish(room, "time");
    }
  }

  private cleanup(): void {
    const now = Date.now();
    this.#queue = this.#queue.filter((player) => player.connected && player.socket.readyState === WebSocket.OPEN);
    for (const room of this.#rooms.values()) {
      const abandoned = !room.players.length;
      const staleWaiting = room.status === "waiting" && now - room.createdAt > 20 * 60_000;
      const settled = room.status === "finished" && now - room.finishedAt > FINISHED_ROOM_TTL_MS;
      if (!abandoned && !staleWaiting && !settled) continue;
      /* Detach first: a player left holding a roomCode for a deleted room reads as "in a room" to
         roomOf(), so every later join or quick match would be filtered against a room that is gone. */
      for (const player of room.players) {
        if (player.roomCode === room.code) player.roomCode = null;
      }
      room.players = [];
      if (room.timer) clearTimeout(room.timer);
      room.timer = null;
      this.#rooms.delete(room.code);
    }
    /* Player records outlive their room; drop the ones whose socket is gone for good. */
    for (const [id, player] of this.#players) {
      if (player.connected || player.disconnectTimer || player.socket.readyState !== WebSocket.CLOSED) continue;
      this.#players.delete(id);
    }
    /* Rivalries outlive both, so they need their own expiry or the map only ever grows. */
    for (const [key, rivalry] of this.#rivalries) {
      if (now - rivalry.touchedAt <= RIVALRY_TTL_MS) continue;
      this.#rivalries.delete(key);
    }
  }

  private broadcastRoomSnapshot(room: Room): void {
    this.broadcast(room, this.roomPayload("room_joined", room));
  }

  private roomPayload(type: "room_created" | "room_joined", room: Room, reconnected = false) {
    return {
      type,
      code: room.code,
      title: room.title,
      visibility: room.visibility,
      players: room.players.map(publicPlayer),
      reconnected,
    };
  }

  /**
   * Serialise once per room rather than once per recipient.
   *
   * match_state goes out every 400 ms and carries both players' full public records, so the old
   * per-socket JSON.stringify was re-encoding an identical object for every live match, twice.
   */
  private broadcast(room: Room, payload: unknown): void {
    const encoded = JSON.stringify(payload);
    for (const player of room.players) {
      if (player.socket.readyState === WebSocket.OPEN) player.socket.send(encoded);
    }
  }

  private send(socket: WebSocket, payload: unknown): void {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
  }

  private uniqueRoomCode(): string {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    for (let attempt = 0; attempt < 20; attempt++) {
      const bytes = crypto.getRandomValues(new Uint8Array(5));
      const code = [...bytes].map((value) => alphabet[value % alphabet.length]).join("");
      if (!this.#rooms.has(code)) return code;
    }
    return crypto.randomUUID().slice(0, 5).toUpperCase();
  }
}

function seriesOf(rivalry: Rivalry): SeriesRecord {
  return {
    games: rivalry.games,
    draws: rivalry.draws,
    standings: rivalry.order.map((id) => ({
      id,
      name: rivalry.names.get(id) ?? "Pilot",
      wins: rivalry.wins.get(id) ?? 0,
    })),
  };
}

function publicPlayer(player: PlayerState): PublicPlayer {
  return {
    id: player.id,
    name: player.name,
    skin: player.skin,
    score: player.score,
    combo: player.combo,
    wave: player.wave,
    connected: player.connected,
    pressure: player.pressure,
    ammo: player.ammo,
    sentCores: player.sentCores,
    defusedCores: player.defusedCores,
    lives: player.lives,
  };
}
