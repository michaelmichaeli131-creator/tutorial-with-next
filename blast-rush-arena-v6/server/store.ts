import type { ChallengeAttempt, ChallengeRecord } from "./protocol.ts";

const CHALLENGE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 40;
/* Fifty is what the all-time board keeps and there is no reason for the daily to differ: past the
   first page nobody reads it, and every extra row is stored and shipped for every request. */
const MAX_DAILY = 50;

export interface DailyEntry {
  name: string;
  score: number;
  wave: number;
  at: number;
}

export class GameStore {
  #kv: Deno.Kv | null = null;
  #memory = new Map<string, unknown>();

  async init(): Promise<void> {
    try {
      this.#kv = await Deno.openKv();
      console.log("[store] Deno KV ready");
    } catch (error) {
      console.warn("[store] KV unavailable; using memory store", error);
    }
  }

  async createChallenge(input: Omit<ChallengeRecord, "code" | "createdAt" | "expiresAt" | "attempts">): Promise<ChallengeRecord> {
    let code = "";
    for (let i = 0; i < 20; i++) {
      const candidate = randomCode(6);
      if (!(await this.getChallenge(candidate))) {
        code = candidate;
        break;
      }
    }
    if (!code) throw new Error("Unable to allocate a unique challenge code");
    const now = Date.now();
    const record: ChallengeRecord = {
      ...input,
      code,
      createdAt: now,
      expiresAt: now + CHALLENGE_TTL_MS,
      attempts: [],
    };
    await this.set(["challenge", code], record);
    await this.addLeaderboard({
      name: record.creatorName,
      score: record.score,
      wave: record.wave,
      at: now,
    });
    return record;
  }

  async getChallenge(code: string): Promise<ChallengeRecord | null> {
    const value = await this.get<ChallengeRecord>(["challenge", code]);
    if (!value) return null;
    if (value.expiresAt < Date.now()) {
      await this.delete(["challenge", code]);
      return null;
    }
    return value;
  }

  async addAttempt(code: string, attempt: ChallengeAttempt): Promise<ChallengeRecord | null> {
    const record = await this.getChallenge(code);
    if (!record) return null;
    record.attempts.push(attempt);
    record.attempts.sort((a, b) => b.score - a.score || a.createdAt - b.createdAt);
    record.attempts = record.attempts.slice(0, MAX_ATTEMPTS);
    await this.set(["challenge", code], record);
    await this.addLeaderboard({ name: attempt.name, score: attempt.score, wave: attempt.wave, at: attempt.createdAt });
    return record;
  }

  /**
   * The daily board.
   *
   * Separate storage from the all-time leaderboard on purpose. The all-time board answers "who is
   * best"; this answers "how did I do on the field everyone else played today", which is the only
   * question the daily arena makes askable — and it is the reason to come back tomorrow, because
   * today's board stops mattering when the seed rolls over.
   *
   * Keyed by the UTC day string the client derives, so no clock negotiation is needed: both sides
   * compute the same key from the same date.
   */
  async getDailyBoard(day: string): Promise<DailyEntry[]> {
    return (await this.get<DailyEntry[]>(["daily", day])) ?? [];
  }

  /**
   * One entry per player per day, keeping their best. Without the replacement a player retrying the
   * same field twenty times would fill the board on their own, which would make it useless exactly
   * for the people who engage with it most.
   */
  async addDailyScore(day: string, entry: DailyEntry): Promise<DailyEntry[]> {
    const board = await this.getDailyBoard(day);
    const existing = board.findIndex((e) => e.name === entry.name);
    if (existing >= 0) {
      if (board[existing].score >= entry.score) return board;
      board[existing] = entry;
    } else {
      board.push(entry);
    }
    board.sort((a, b) => b.score - a.score || b.wave - a.wave || a.at - b.at);
    const trimmed = board.slice(0, MAX_DAILY);
    await this.set(["daily", day], trimmed);
    return trimmed;
  }

  async getLeaderboard(): Promise<Array<{ name: string; score: number; wave: number; at: number }>> {
    return (await this.get<Array<{ name: string; score: number; wave: number; at: number }>>(["leaderboard"])) ?? [];
  }

  private async addLeaderboard(entry: { name: string; score: number; wave: number; at: number }): Promise<void> {
    const board = await this.getLeaderboard();
    board.push(entry);
    board.sort((a, b) => b.score - a.score || b.wave - a.wave);
    await this.set(["leaderboard"], board.slice(0, 50));
  }

  private key(parts: Deno.KvKey): string {
    return JSON.stringify(parts);
  }

  private async get<T>(key: Deno.KvKey): Promise<T | null> {
    if (this.#kv) return (await this.#kv.get<T>(key)).value;
    return (this.#memory.get(this.key(key)) as T | undefined) ?? null;
  }

  private async set(key: Deno.KvKey, value: unknown): Promise<void> {
    if (this.#kv) {
      await this.#kv.set(key, value);
      return;
    }
    this.#memory.set(this.key(key), value);
  }

  private async delete(key: Deno.KvKey): Promise<void> {
    if (this.#kv) {
      await this.#kv.delete(key);
      return;
    }
    this.#memory.delete(this.key(key));
  }
}

function randomCode(length: number): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map((value) => alphabet[value % alphabet.length]).join("");
}
