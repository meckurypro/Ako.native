import { secureSessionStorage } from "./secure-storage";

// Per-device "accounts signed into on this device" cache — mirrors
// web's src/lib/accountSessions.ts. Native has no synchronous storage
// equivalent to localStorage, so every read/write here is async (SecureStore),
// unlike web's synchronous version — callers (useAccountSwitcher) account for this.

const STORAGE_KEY = "ako.saved_accounts.v1";

export type SavedAccount = {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  access_token: string;
  refresh_token: string;
};

export async function listSavedAccounts(): Promise<SavedAccount[]> {
  try {
    const raw = await secureSessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Upserts by user_id — re-adding an already-saved account just refreshes
// its cached tokens/profile snapshot rather than duplicating it.
export async function saveAccount(account: SavedAccount): Promise<void> {
  const accounts = (await listSavedAccounts()).filter((a) => a.user_id !== account.user_id);
  accounts.push(account);
  await secureSessionStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
}

export async function removeSavedAccount(userId: string): Promise<void> {
  const accounts = (await listSavedAccounts()).filter((a) => a.user_id !== userId);
  await secureSessionStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
}

// Keeps a saved account's cached tokens in sync with whatever Supabase does
// to that session in the background (it rotates the refresh token on every
// silent auto-refresh). No-ops if this user has nothing saved yet.
export async function updateSavedAccountTokens(userId: string, tokens: { access_token: string; refresh_token: string }): Promise<void> {
  const accounts = await listSavedAccounts();
  const idx = accounts.findIndex((a) => a.user_id === userId);
  if (idx === -1) return;
  accounts[idx] = { ...accounts[idx], ...tokens };
  await secureSessionStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
}

// Left behind by sign-up.tsx when a confirmation link is about to be sent
// for a sign-up started from "Add account" (AccountSwitcher) rather than a
// fresh, signed-out one — read back by useAuthCallback once that link is
// opened and the new account's SIGNED_IN fires.
const PENDING_ADD_KEY = "ako.pending_add_account.v1";

export async function setPendingAddAccount(account: SavedAccount): Promise<void> {
  await secureSessionStorage.setItem(PENDING_ADD_KEY, JSON.stringify(account));
}

// Reads and clears in one step — this is only ever meant to be consumed
// once, by the next SIGNED_IN the auth callback screen sees.
export async function takePendingAddAccount(): Promise<SavedAccount | null> {
  try {
    const raw = await secureSessionStorage.getItem(PENDING_ADD_KEY);
    await secureSessionStorage.removeItem(PENDING_ADD_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedAccount;
  } catch {
    return null;
  }
}
