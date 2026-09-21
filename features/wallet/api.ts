import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/providers/AuthProvider";

export type Wallet = { id: string; user_id: string; balance: number; pending_balance?: number; created_at?: string; updated_at?: string };
export type WalletTransaction = { id: string; wallet_id: string; type: string; amount: number | string; created_at: string };
export type FeatureFlagMap = Record<string, boolean>;
export type ExchangeRates = { deposit: number; withdrawal: number };
export type PayoutAccount = { id: string; bank_name: string; account_number_last4: string; account_name: string; currency: string; is_verified: boolean; is_active: boolean };
export type Withdrawal = { id: string; amount_usd: number; amount_local: number; fee_local: number; net_amount_local: number; currency: string; status: "pending" | "processing" | "completed" | "failed" | "reversed"; failure_reason: string | null; created_at: string; completed_at: string | null };
export type Bank = { name: string; code: string };

const PAYOUT_SETTINGS_FALLBACK = { minimumWithdrawalUsd: 10, newAccountCooldownHours: 24 };

export function formatUsd(amount: number | string | null | undefined) {
  return `$${Number(amount ?? 0).toFixed(2)}`;
}

export function formatNgn(amount: number | string | null | undefined) {
  return `₦${Number(amount ?? 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function useWallet() {
  const { user } = useAuth();
  return useQuery({ queryKey: ["wallet", user?.id], enabled: !!user, queryFn: async (): Promise<Wallet> => {
    const { data, error } = await supabase.from("wallets").select("*").eq("user_id", user!.id).single();
    if (error) throw error;
    return data as Wallet;
  } });
}

export function useWalletTransactions() {
  const { user } = useAuth();
  return useQuery({ queryKey: ["wallet-transactions", user?.id], enabled: !!user, queryFn: async (): Promise<WalletTransaction[]> => {
    const { data: wallet } = await supabase.from("wallets").select("id").eq("user_id", user!.id).single();
    if (!wallet) return [];
    const { data, error } = await supabase.from("wallet_transactions").select("*").eq("wallet_id", wallet.id).order("created_at", { ascending: false }).limit(30);
    if (error) throw error;
    return (data ?? []) as WalletTransaction[];
  } });
}

export function useFeatureFlags() {
  return useQuery({ queryKey: ["feature-flags"], staleTime: 60000, queryFn: async (): Promise<FeatureFlagMap> => {
    const { data, error } = await supabase.from("feature_flags").select("key, enabled");
    if (error) throw error;
    const map: FeatureFlagMap = {};
    for (const row of data ?? []) map[row.key] = row.enabled;
    return map;
  } });
}

export function useFeatureFlag(key: string) {
  const { data } = useFeatureFlags();
  return data?.[key] ?? true;
}

export function useExchangeRates() {
  return useQuery({ queryKey: ["exchange-rates"], staleTime: 60000, queryFn: async (): Promise<ExchangeRates> => {
    const { data, error } = await supabase.from("exchange_rates").select("kind, rate");
    if (error) throw error;
    const rates: ExchangeRates = { deposit: 0, withdrawal: 0 };
    for (const row of data ?? []) {
      if (row.kind === "deposit") rates.deposit = Number(row.rate);
      if (row.kind === "withdrawal") rates.withdrawal = Number(row.rate);
    }
    return rates;
  } });
}

export function useInitiateDeposit() {
  return useMutation({ mutationFn: async (amount_usd: number): Promise<{ deposit_id: string; authorization_url: string; reference: string; amount_usd: number; amount_ngn: number; exchange_rate: number }> => {
    const { data, error } = await supabase.functions.invoke("initiate-deposit", { body: { amount_usd } });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  } });
}

export function usePayoutAccounts() {
  const { user } = useAuth();
  return useQuery({ queryKey: ["payout-accounts", user?.id], enabled: !!user, queryFn: async (): Promise<PayoutAccount[]> => {
    const { data, error } = await supabase.from("payout_accounts").select("id, bank_name, account_number_last4, account_name, currency, is_verified, is_active").eq("is_active", true).order("created_at", { ascending: false });
    if (error) throw error;
    return data as PayoutAccount[];
  } });
}

export function useBankList() {
  return useQuery({ queryKey: ["bank-list"], staleTime: 60 * 60_000, queryFn: async (): Promise<Bank[]> => {
    const { data, error } = await supabase.functions.invoke("list-banks");
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data.banks;
  } });
}

export function useResolvedAccountName(bankCode: string, accountNumber: string) {
  const query = useQuery({ queryKey: ["resolve-bank-account", bankCode, accountNumber], enabled: accountNumber.length === 10 && !!bankCode, retry: false, queryFn: async (): Promise<string> => {
    const { data, error } = await supabase.functions.invoke("resolve-bank-account", { body: { account_number: accountNumber, bank_code: bankCode } });
    if (error || data?.error) throw new Error("Couldn't verify this account.");
    return data.account_name;
  } });
  return { resolvedName: query.data ?? null, resolving: query.isFetching, resolveError: query.isError ? "Couldn't verify this account." : null };
}

export function useAddPayoutAccount() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: async (input: { account_number: string; bank_code: string; bank_name: string }) => {
    const { data, error } = await supabase.functions.invoke("add-payout-account", { body: input });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data.payout_account;
  }, onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["payout-accounts"] }) });
}

export function useWithdrawals() {
  const { user } = useAuth();
  return useQuery({ queryKey: ["withdrawals", user?.id], enabled: !!user, queryFn: async (): Promise<Withdrawal[]> => {
    const { data, error } = await supabase.from("withdrawals").select("id, amount_usd, amount_local, fee_local, net_amount_local, currency, status, failure_reason, created_at, completed_at").order("created_at", { ascending: false });
    if (error) throw error;
    return data as Withdrawal[];
  } });
}

export function useWithdraw() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: async (input: { amount_usd: number; payout_account_id: string }) => {
    const { data, error } = await supabase.functions.invoke("process-withdrawal", { body: input });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }, onSuccess: () => {
    void queryClient.invalidateQueries({ queryKey: ["wallet"] });
    void queryClient.invalidateQueries({ queryKey: ["withdrawals"] });
    void queryClient.invalidateQueries({ queryKey: ["wallet-transactions"] });
  } });
}

export function useWithdrawalEligibility() {
  const { user } = useAuth();
  return useQuery({ queryKey: ["withdrawal-eligibility", user?.id], enabled: !!user, queryFn: async (): Promise<{ wallet_balance: number; cap_usd: number; already_committed_usd: number; available_to_request: number; cycle_start: string }> => {
    const { data, error } = await supabase.rpc("get_withdrawal_eligibility", { p_user_id: user!.id }).single();
    if (error) throw error;
    return data as any;
  } });
}

export function useTransferFeePreview(grossNgn: number | null) {
  const rounded = grossNgn && grossNgn > 0 ? Math.round(grossNgn) : null;
  return useQuery({ queryKey: ["transfer-fee-preview", rounded], enabled: rounded !== null, staleTime: 60000, queryFn: async (): Promise<number> => {
    const { data, error } = await supabase.rpc("calculate_transfer_fee_ngn", { p_amount_ngn: rounded });
    if (error) throw error;
    return Number(data);
  } });
}

export function usePayoutSettings() {
  return useQuery({ queryKey: ["payout-settings"], staleTime: 5 * 60_000, placeholderData: PAYOUT_SETTINGS_FALLBACK, queryFn: async () => {
    const { data, error } = await supabase.from("payout_settings").select("minimum_withdrawal_usd, new_account_cooldown_hours").single();
    if (error) throw error;
    return { minimumWithdrawalUsd: Number(data.minimum_withdrawal_usd), newAccountCooldownHours: Number(data.new_account_cooldown_hours) };
  } });
}

export function businessWeekday() {
  return new Intl.DateTimeFormat("en-US", { timeZone: "Africa/Lagos", weekday: "long" }).format(new Date());
}

export function nextFridayLabel() {
  const lagosNow = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Lagos" }));
  const dow = lagosNow.getDay();
  const daysUntilFriday = (5 - dow + 7) % 7 || 7;
  const nextFriday = new Date(lagosNow);
  nextFriday.setDate(lagosNow.getDate() + daysUntilFriday);
  return nextFriday.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
}
