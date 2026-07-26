export type ClientMessage =
  | { type: "hello"; playerId?: string; name?: string }
  | { type: "quick_match" }
  | { type: "create_room" }
  | { type: "join_room"; code: string }
  | { type: "score"; seq: number; delta: number; event: ScoreEvent; combo?: number; wave?: number }
  | { type: "pressure"; seq: number }
  | { type: "rematch" }
  | { type: "leave" }
  | { type: "ping"; at: number };

export type ScoreEvent =
  | "hit"
  | "perfect"
  | "chain"
  | "boss"
  | "wave"
  | "blast"
  | "objective"
  | "penalty";

export type HazardKind = "gravity" | "emp" | "fracture" | "swarm";

export interface PublicPlayer {
  id: string;
  name: string;
  score: number;
  combo: number;
  wave: number;
  connected: boolean;
  pressure: number;
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
  boss: 45_000,
  wave: 20_000,
  blast: 30_000,
  objective: 25_000,
  penalty: 0,
};

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

export function cleanCode(value: unknown): string {
  return String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
}

export function safeNumber(value: unknown, min: number, max: number): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, Math.floor(number)));
}
