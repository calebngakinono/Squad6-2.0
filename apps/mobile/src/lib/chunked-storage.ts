// Supabase keeps its session (access + refresh token) in a storage adapter. We use the OS keychain
// (expo-secure-store), which is encrypted but limits the size of one value, so long sessions are
// split into chunks. Kept free of React Native imports so it can be unit-tested.

export interface KeyValueStore {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

export const CHUNK_SIZE = 1800;

// Secure-store keys may only contain letters, numbers, ".", "-" and "_".
const safeKey = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, "_");
const countKey = (key: string) => `${safeKey(key)}.chunks`;
const chunkKey = (key: string, i: number) => `${safeKey(key)}.${i}`;

export function createChunkedStorage(store: KeyValueStore) {
  async function removeItem(key: string): Promise<void> {
    const count = Number((await store.getItemAsync(countKey(key))) ?? 0);
    for (let i = 0; i < count; i++) await store.deleteItemAsync(chunkKey(key, i));
    await store.deleteItemAsync(countKey(key));
  }

  return {
    async getItem(key: string): Promise<string | null> {
      const countValue = await store.getItemAsync(countKey(key));
      if (countValue === null) return null;
      const parts: string[] = [];
      for (let i = 0; i < Number(countValue); i++) {
        const part = await store.getItemAsync(chunkKey(key, i));
        if (part === null) return null; // Incomplete write: treat as signed out.
        parts.push(part);
      }
      return parts.join("");
    },

    async setItem(key: string, value: string): Promise<void> {
      await removeItem(key);
      const count = Math.max(1, Math.ceil(value.length / CHUNK_SIZE));
      for (let i = 0; i < count; i++) {
        await store.setItemAsync(chunkKey(key, i), value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
      }
      // Written last, so a half-finished write is never read as a valid session.
      await store.setItemAsync(countKey(key), String(count));
    },

    removeItem,
  };
}
