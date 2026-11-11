import { describe, expect, it } from "vitest";
import { CHUNK_SIZE, createChunkedStorage, type KeyValueStore } from "./chunked-storage";

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItemAsync: async (k) => data.get(k) ?? null,
    setItemAsync: async (k, v) => void data.set(k, v),
    deleteItemAsync: async (k) => void data.delete(k),
  };
}

describe("createChunkedStorage", () => {
  it("round-trips values larger than one chunk", async () => {
    const store = memoryStore();
    const storage = createChunkedStorage(store);
    const value = "x".repeat(CHUNK_SIZE * 2 + 10);
    await storage.setItem("sb-local-auth-token", value);
    expect(await storage.getItem("sb-local-auth-token")).toBe(value);
    expect(store.data.get("sb-local-auth-token.chunks")).toBe("3");
  });

  it("returns null for a missing key", async () => {
    expect(await createChunkedStorage(memoryStore()).getItem("missing")).toBeNull();
  });

  it("removes old chunks when a shorter value is written", async () => {
    const store = memoryStore();
    const storage = createChunkedStorage(store);
    await storage.setItem("k", "y".repeat(CHUNK_SIZE * 3));
    await storage.setItem("k", "short");
    expect(await storage.getItem("k")).toBe("short");
    expect([...store.data.keys()].sort()).toEqual(["k.0", "k.chunks"]);
  });

  it("removeItem deletes every chunk", async () => {
    const store = memoryStore();
    const storage = createChunkedStorage(store);
    await storage.setItem("k", "z".repeat(CHUNK_SIZE + 1));
    await storage.removeItem("k");
    expect(store.data.size).toBe(0);
  });

  it("treats a half-written session as signed out", async () => {
    const store = memoryStore();
    store.data.set("k.chunks", "2");
    store.data.set("k.0", "partial");
    expect(await createChunkedStorage(store).getItem("k")).toBeNull();
  });

  it("sanitizes keys secure-store would reject", async () => {
    const store = memoryStore();
    await createChunkedStorage(store).setItem("sb:auth token", "v");
    expect(store.data.has("sb_auth_token.0")).toBe(true);
  });
});
