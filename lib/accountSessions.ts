// File: lib/accountSessions.ts
//
// FLAG — structural change, not just a swap: web's localStorage is
// synchronous, so every function here was sync. AsyncStorage (RN's
// equivalent) is Promise-based, so EVERY function below is now async.
// This means every CALLER also needs updating to `await` these —
// useAuth.tsx, useAccountSwitcher.ts, the AccountSwitcher UI, SignUp,
// and AuthCallback all call these functions and assume sync behavior
// on web. None of those are converted yet. Don't wire this in and
// assume it "just works" the way the web version's callers do.
//
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "ako.saved_accounts.v1";

export interface SavedAccount {
  user_id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  access_token: string;
  refresh_token: string;
}

export async function listSavedAccounts(): Promise<SavedAccount[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function saveAccount(account: SavedAccount): Promise<void> {
  const accounts = (await listSavedAccounts()).filter((a) => a.user_id !== account.user_id);
  accounts.push(account);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
}

export async function removeSavedAccount(userId: string): Promise<void> {
  const accounts = (await listSavedAccounts()).filter((a) => a.user_id !== userId);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
}

export async function getSavedAccount(userId: string): Promise<SavedAccount | undefined> {
  return (await listSavedAccounts()).find((a) => a.user_id === userId);
}

export async function updateSavedAccountTokens(
  userId: string,
  tokens: { access_token: string; refresh_token: string }
): Promise<void> {
  const accounts = await listSavedAccounts();
  const idx = accounts.findIndex((a) => a.user_id === userId);
  if (idx === -1) return;
  accounts[idx] = { ...accounts[idx], ...tokens };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
}

const PENDING_ADD_KEY = "ako.pending_add_account.v1";

export async function setPendingAddAccount(account: SavedAccount): Promise<void> {
  await AsyncStorage.setItem(PENDING_ADD_KEY, JSON.stringify(account));
}

export async function takePendingAddAccount(): Promise<SavedAccount | null> {
  try {
    const raw = await AsyncStorage.getItem(PENDING_ADD_KEY);
    await AsyncStorage.removeItem(PENDING_ADD_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SavedAccount;
  } catch {
    return null;
  }
}
