import * as SecureStore from "expo-secure-store";

const CHUNK_SIZE = 1800;
const MANIFEST_SUFFIX = ".manifest";

function chunkKey(key: string, index: number) {
  return `${key}.chunk.${index}`;
}

export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    const manifest = await SecureStore.getItemAsync(`${key}${MANIFEST_SUFFIX}`);
    if (!manifest) return SecureStore.getItemAsync(key);
    const count = Number(manifest);
    if (!Number.isInteger(count) || count < 1) return null;
    const chunks = await Promise.all(Array.from({ length: count }, (_, index) => SecureStore.getItemAsync(chunkKey(key, index))));
    if (chunks.some((chunk) => chunk === null)) return null;
    return chunks.join("");
  },
  async setItem(key: string, value: string): Promise<void> {
    await this.removeItem(key);
    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }
    const chunks = Array.from({ length: Math.ceil(value.length / CHUNK_SIZE) }, (_, index) =>
      value.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE),
    );
    await Promise.all(chunks.map((chunk, index) => SecureStore.setItemAsync(chunkKey(key, index), chunk)));
    await SecureStore.setItemAsync(`${key}${MANIFEST_SUFFIX}`, String(chunks.length));
  },
  async removeItem(key: string): Promise<void> {
    const manifest = await SecureStore.getItemAsync(`${key}${MANIFEST_SUFFIX}`);
    const count = Number(manifest ?? 0);
    await Promise.all([
      SecureStore.deleteItemAsync(key),
      SecureStore.deleteItemAsync(`${key}${MANIFEST_SUFFIX}`),
      ...Array.from({ length: Number.isInteger(count) ? count : 0 }, (_, index) => SecureStore.deleteItemAsync(chunkKey(key, index))),
    ]);
  },
};
