import type { ChallengeAttempt, ChallengeRecord } from "./protocol.ts";

const CHALLENGE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 40;

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
