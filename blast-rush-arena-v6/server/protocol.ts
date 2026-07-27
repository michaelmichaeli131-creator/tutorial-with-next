export type RoomVisibility = "private" | "public";

export type ClientMessage =
  | { type: "hello"; playerId?: string; name?: string; skin?: string }
  | { type: "quick_match" }
  | { type: "create_room"; visibility?: RoomVisibility; tableName?: string }
  | { type: "join_room"; code: string }
  | { type: "score"; seq: number; delta: number; event: ScoreEvent; combo?: number; wave?: number }
  | { type: "pressure"; seq: number }
  | { type: "send_attack"; seq: number; kind: AttackKind }
  | { type: "launch_core"; seq: number }
  | { type: "rematch" }
  | { type: "leave" }
  | { type: "ping"; at: number };

export type ScoreEvent =
  | "hit"
  | "perfect"
  | "chain"
  | "rival_core"
  | "boss"
  | "wave"
  | "blast"
  | "objective"
  | "penalty";

export type HazardKind = "gravity" | "emp" | "fracture" | "swarm";

/**
 * Threats a duellist can buy with in-match charge. Costs and cooldowns live on the server so a
 * modified client cannot spend what it has not earned — and charge is earned by scoring inside the
 * match, so nothing bought with real progression can be converted into an advantage here.
 */
export type AttackKind = "swarm" | "gravity" | "emp" | "core" | "titan";

export interface AttackSpec {
  kind: AttackKind;
  cost: number;
  cooldownMs: number;
  durationMs: number;
  label: string;
}

export const ATTACKS: Record<AttackKind, AttackSpec> = {
  swarm: { kind: "swarm", cost: 25, cooldownMs: 3_000, durationMs: 5_500, label: "SWARM" },
  gravity: { kind: "gravity", cost: 35, cooldownMs: 5_000, durationMs: 5_000, label: "GRAVITY WELL" },
  emp: { kind: "emp", cost: 45, cooldownMs: 6_000, durationMs: 4_000, label: "EMP VEIL" },
  core: { kind: "core", cost: 55, cooldownMs: 4_000, durationMs: 0, label: "RIVAL CORE" },
  titan: { kind: "titan", cost: 90, cooldownMs: 12_000, durationMs: 0, label: "WAR TITAN" },
};

export interface PublicPlayer {
  id: string;
  name: string;
  skin: string;
  score: number;
  combo: number;
  wave: number;
  connected: boolean;
  pressure: number;
  ammo: number;
  sentCores: number;
  defusedCores: number;
}

export interface PublicTable {
  code: string;
  title: string;
  hostName: string;
  hostSkin: string;
  createdAt: number;
}

export interface ChallengeRecord {
  code: string;
  creatorName: string;
  score: number;
  wave: number;
  perfects: number;
  maxCombo: number;
  stage: string;
  seed: number;
  createdAt: number;
  expiresAt: number;
  attempts: ChallengeAttempt[];
}

export interface ChallengeAttempt {
  name: string;
  score: number;
  wave: number;
  perfects: number;
  maxCombo: number;
  createdAt: number;
}

export const SCORE_LIMITS: Record<ScoreEvent, number> = {
  hit: 3_000,
  perfect: 5_000,
  chain: 10_000,
  rival_core: 8_000,
  boss: 60_000,
  wave: 25_000,
  blast: 35_000,
  objective: 30_000,
  penalty: 0,
};

const SKIN_RE = /^[a-z0-9_-]{1,24}$/;

export interface SpawnEntry {
  /** Milliseconds after match start. Replayed against wall-clock, never against accumulated dt. */
  t: number;
  type: string;
  /** Horizontal position as 0..1 of the arena width, so it is resolution independent. */
  x: number;
  speed: number;
  elite: boolean;
}

/**
 * The duel spawn schedule, built once on the server and replayed identically by both clients.
 *
 * Duels were previously simulated locally from a shared seed, which only produces the same field if
 * both clients consume the generator in the same order at the same rate. They do not: dt is clamped
 * per frame, so a client running at 20fps advances its world roughly a third slower than one at
 * 60fps while the match clock keeps real time. The slow player met fewer enemies and had fewer
 * chances to score, and the two arenas drifted apart besides.
 *
 * Difficulty here ramps on match progress rather than on each player's own wave, so both duellists
 * face exactly the same gauntlet and the score difference is down to play.
 */
export function buildSpawnSchedule(seed: number, durationMs: number): SpawnEntry[] {
  let state = seed | 0;
  const random = () => {
    state = (state + 0x6D2B79F5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pool = ["normal", "normal", "normal", "armored", "bomb", "shard", "splitter"];
  const entries: SpawnEntry[] = [];
  let at = 500;
  while (at < durationMs) {
    const progress = at / durationMs;
    entries.push({
      t: Math.round(at),
      type: pool[Math.floor(random() * pool.length)],
      x: random(),
      speed: 0.9 + random() * 0.45 + progress * 0.75,
      elite: random() < 0.03 + progress * 0.17,
    });
    const interval = (1000 - progress * 520) * (0.85 + random() * 0.3);
    at += Math.max(220, interval);
  }
  return entries;
}

export function parseClientMessage(raw: string): ClientMessage | null {
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (!value || typeof value.type !== "string") return null;
    return value as ClientMessage;
  } catch {
    return null;
  }
}

export function cleanName(value: unknown): string {
  const text = typeof value === "string" ? value.trim() : "";
  return text.replace(/[^\p{L}\p{N}_\- .]/gu, "").slice(0, 18) || "Pilot";
}

export function cleanSkin(value: unknown): string {
  const text = typeof value === "string" ? value.toLowerCase().trim() : "";
  return SKIN_RE.test(text) ? text : "nova";
}

export function cleanTableName(value: unknown): string {
  const text = typeof value === "string" ? value.trim() : "";
  return text.replace(/[^\p{L}\p{N}_\- .]/gu, "").slice(0, 26) || "OPEN ARENA";
}

export function cleanCode(value: unknown): string {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

export function safeNumber(value: unknown, min: number, max: number): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, Math.floor(number)));
}
