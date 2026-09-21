import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/core";
import { businessWeekday, formatNgn, formatUsd, nextFridayLabel, useAddPayoutAccount, useBankList, useExchangeRates, useFeatureFlag, usePayoutAccounts, usePayoutSettings, useResolvedAccountName, useTransferFeePreview, useWallet, useWithdrawalEligibility, useWithdraw, useWithdrawals, type Bank, type PayoutAccount, type Withdrawal } from "@/features/wallet/api";
import { useTheme } from "@/providers/ThemeProvider";

export default function WithdrawScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const wallet = useWallet();
  const accounts = usePayoutAccounts();
  const withdrawals = useWithdrawals();
  const banks = useBankList();
  const rates = useExchangeRates();
  const eligibility = useWithdrawalEligibility();
  const payoutSettings = usePayoutSettings();
  const addAccount = useAddPayoutAccount();
  const withdraw = useWithdraw();
  const withdrawalsEnabled = useFeatureFlag("withdrawals_enabled");
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const activeAccounts = accounts.data?.filter((a) => a.is_verified) ?? [];
  const selectedBankCode = bankCode || banks.data?.[0]?.code || "";
  const amountUsd = parseFloat(amount) || 0;
  const grossNgn = rates.data?.withdrawal && amountUsd ? amountUsd * rates.data.withdrawal : null;
  const fee = useTransferFeePreview(grossNgn);
  const netNgn = grossNgn !== null && fee.data !== undefined ? grossNgn - fee.data : null;
  const resolved = useResolvedAccountName(selectedBankCode, accountNumber);
  const isFriday = businessWeekday() === "Friday";
  const minimumWithdrawalUsd = payoutSettings.data?.minimumWithdrawalUsd ?? 10;

  const addBank = async () => {
    setAddError(null);
    const bank = banks.data?.find((item) => item.code === selectedBankCode);
    if (!bank) return setAddError("Choose a bank.");
    if (!resolved.resolvedName) return setAddError("Enter a valid account number first — we'll confirm the name.");
    try {
      await addAccount.mutateAsync({ account_number: accountNumber, bank_code: selectedBankCode, bank_name: bank.name });
      setShowAddAccount(false);
      setAccountNumber("");
      Alert.alert("Payout account added");
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Couldn't add this account.");
    }
  };

  const requestWithdrawal = async () => {
    setError(null);
    if (!selectedAccountId) return setError("Choose a bank account first.");
    if (!amountUsd || amountUsd < minimumWithdrawalUsd) return setError(`Minimum withdrawal is ${formatUsd(minimumWithdrawalUsd)}.`);
    if (wallet.data && amountUsd > Number(wallet.data.balance)) return setError("That's more than your available balance.");
    if (eligibility.data && amountUsd > eligibility.data.available_to_request) return setError(`You can request up to ${formatUsd(eligibility.data.available_to_request)} this week (max 50% of your balance).`);
    try {
      await withdraw.mutateAsync({ amount_usd: amountUsd, payout_account_id: selectedAccountId });
      setAmount("");
      Alert.alert("Withdrawal requested", "Requests submitted today are paid out in Saturday's payout run.", [{ text: "OK", onPress: () => router.replace("/wallet" as never) }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Withdrawal failed.");
    }
  };

  return <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]}><ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled"><View style={s.header}><Pressable onPress={() => router.back()} style={s.back}><Feather name="arrow-left" size={22} color={colors.textSecondary} /></Pressable></View><Text style={s.title}>Withdraw</Text><Text color="muted" style={s.balance}>Available balance: {formatUsd(wallet.data?.balance ?? 0)}</Text>{!withdrawalsEnabled ? <Notice danger text="Withdrawals are temporarily unavailable. Check back later." /> : <><Text color="muted" style={s.weekly}>Up to {formatUsd(eligibility.data?.available_to_request ?? 0)} available to request this week (50% weekly limit)</Text>{!isFriday ? <Notice icon="calendar-clock-outline" text={`Withdrawal requests open on Fridays. Next window opens ${nextFridayLabel()}. Deposits and gifting are available every day.`} /> : null}<Text color="muted" style={s.sectionTitle}>Payout account</Text>{activeAccounts.map((account) => <PayoutRow key={account.id} account={account} selected={selectedAccountId === account.id} onPress={() => setSelectedAccountId(account.id)} />)}<Pressable onPress={() => setShowAddAccount((value) => !value)} style={s.addToggle}><Feather name="plus" size={16} color={colors.accent} /><Text color="accent" style={s.addToggleText}>Add bank account</Text></Pressable>{showAddAccount ? <View style={[s.addCard, { backgroundColor: colors.surface }]}><Text color="muted" style={s.label}>Bank</Text><BankPicker banks={banks.data ?? []} value={selectedBankCode} onChange={setBankCode} /><Text color="muted" style={s.label}>Account number</Text><TextInput value={accountNumber} onChangeText={(value) => setAccountNumber(value.replace(/\D/g, "").slice(0, 10))} keyboardType="number-pad" placeholder="0123456789" placeholderTextColor={colors.textMuted} style={[s.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }]} />{resolved.resolving ? <Text color="muted" style={s.accountStatus}>Checking account…</Text> : null}{resolved.resolvedName ? <Text color="accent" style={s.accountStatus}>Account name: {resolved.resolvedName}</Text> : null}{resolved.resolveError ? <Text color="danger" style={s.accountStatus}>{resolved.resolveError}</Text> : null}{addError ? <Text color="danger" style={s.accountStatus}>{addError}</Text> : null}<Pressable disabled={!resolved.resolvedName || addAccount.isPending} onPress={() => void addBank()} style={[s.smallButton, { backgroundColor: colors.accent }, (!resolved.resolvedName || addAccount.isPending) && { opacity: .5 }]}><Text style={s.smallButtonText}>{addAccount.isPending ? "Adding…" : "Confirm and add"}</Text></Pressable></View> : null}<Text color="muted" style={s.sectionTitle}>Amount (USD)</Text><TextInput value={amount} onChangeText={setAmount} editable={isFriday} keyboardType="decimal-pad" placeholder={`${minimumWithdrawalUsd.toFixed(2)}`} placeholderTextColor={colors.textMuted} style={[s.input, { backgroundColor: colors.background, color: colors.text, borderColor: colors.border }, !isFriday && { opacity: .55 }]} />{grossNgn !== null ? <Text color="muted" style={s.preview}>{"You'll receive "}{netNgn !== null ? formatNgn(netNgn) : "…"}{fee.data ? ` (after a ${formatNgn(fee.data)} Paystack transfer fee)` : ""}{rates.data?.withdrawal ? ` — rate: $1 = ${formatNgn(rates.data.withdrawal)}` : ""}</Text> : null}{error ? <Text color="danger" style={s.error}>{error}</Text> : null}<Pressable disabled={!isFriday || activeAccounts.length === 0 || withdraw.isPending} onPress={() => void requestWithdrawal()} style={[s.button, { backgroundColor: colors.accent }, (!isFriday || activeAccounts.length === 0 || withdraw.isPending) && { opacity: .5 }]}><Text style={s.buttonText}>{isFriday ? withdraw.isPending ? "Requesting…" : "Request withdrawal" : "Withdrawals open on Fridays"}</Text></Pressable>{isFriday ? <Text color="muted" align="center" style={s.fridayNote}>{"Requests submitted today are paid out in Saturday's payout run."}</Text> : null}</>}{withdrawals.data?.length ? <View style={s.history}><Text style={s.historyTitle}>History</Text>{withdrawals.data.map((item) => <WithdrawalRow key={item.id} item={item} />)}</View> : null}</ScrollView></SafeAreaView>;
}

function Notice({ text, danger, icon }: { text: string; danger?: boolean; icon?: keyof typeof MaterialCommunityIcons.glyphMap }) {
  const { colors } = useTheme();
  return <View style={[s.notice, { backgroundColor: danger ? "rgba(201,91,91,.12)" : colors.accentSoft }]}>{icon ? <MaterialCommunityIcons name={icon} size={18} color={danger ? colors.danger : colors.accent} /> : null}<Text color={danger ? "danger" : "accent"} style={s.noticeText}>{text}</Text></View>;
}

function PayoutRow({ account, selected, onPress }: { account: PayoutAccount; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return <Pressable onPress={onPress} style={[s.payoutRow, { backgroundColor: selected ? colors.accentSoft : colors.surface, borderColor: selected ? colors.accent : colors.border }]}><Text style={s.payoutBank}>{account.bank_name}</Text><Text color="muted" style={s.payoutDetails}>{account.account_name} •••• {account.account_number_last4}</Text></Pressable>;
}

function BankPicker({ banks, value, onChange }: { banks: Bank[]; value: string; onChange: (value: string) => void }) {
  const { colors } = useTheme();
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.bankList}>{banks.map((bank) => <Pressable key={bank.code} onPress={() => onChange(bank.code)} style={[s.bankChip, { borderColor: value === bank.code ? colors.accent : colors.border, backgroundColor: value === bank.code ? colors.accentSoft : colors.background }]}><Text numberOfLines={1} style={s.bankChipText}>{bank.name}</Text></Pressable>)}</ScrollView>;
}

function WithdrawalRow({ item }: { item: Withdrawal }) {
  const { colors } = useTheme();
  const good = item.status === "completed" || item.status === "processing";
  return <View style={[s.withdrawalRow, { borderBottomColor: colors.border }]}><View style={s.withdrawalCopy}><Text style={s.withdrawalText}>{formatUsd(item.amount_usd)} → {item.currency} {Number(item.net_amount_local).toFixed(2)}</Text><Text color="muted" style={s.withdrawalDate}>{new Date(item.created_at).toLocaleDateString()}</Text></View><View style={[s.statusPill, { backgroundColor: good ? colors.accentSoft : colors.background }]}><Text color={good ? "accent" : item.status === "failed" || item.status === "reversed" ? "danger" : "muted"} style={s.statusText}>{item.status}</Text></View></View>;
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 36 },
  header: { height: 38, justifyContent: "center" },
  back: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: "serif", fontSize: 28, lineHeight: 34 },
  balance: { marginTop: 2, fontSize: 14, lineHeight: 19 },
  weekly: { marginTop: 4, marginBottom: 20, fontSize: 12, lineHeight: 17 },
  notice: { borderRadius: 14, padding: 12, marginTop: 18, marginBottom: 20, flexDirection: "row", gap: 8 },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 18 },
  sectionTitle: { marginTop: 16, marginBottom: 8, fontSize: 14, fontWeight: "600" },
  payoutRow: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, marginBottom: 8 },
  payoutBank: { fontSize: 14, fontWeight: "600" },
  payoutDetails: { marginTop: 3, fontSize: 12 },
  addToggle: { flexDirection: "row", gap: 6, alignItems: "center", paddingVertical: 10 },
  addToggleText: { fontSize: 14, fontWeight: "600" },
  addCard: { borderRadius: 14, padding: 14, marginVertical: 8 },
  label: { fontSize: 13, marginBottom: 7, marginTop: 4 },
  bankList: { gap: 8, paddingBottom: 10 },
  bankChip: { maxWidth: 180, borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  bankChipText: { fontSize: 12 },
  input: { height: 48, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingHorizontal: 14, fontSize: 16 },
  accountStatus: { marginTop: 8, fontSize: 13 },
  smallButton: { height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", marginTop: 14 },
  smallButtonText: { color: "#07130D", fontWeight: "700" },
  preview: { marginTop: 8, marginBottom: 16, fontSize: 12, lineHeight: 17 },
  error: { marginBottom: 14, fontSize: 13 },
  button: { height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", marginTop: 4 },
  buttonText: { color: "#07130D", fontWeight: "700" },
  fridayNote: { marginTop: 10, fontSize: 12 },
  history: { marginTop: 30 },
  historyTitle: { fontFamily: "serif", fontSize: 20, marginBottom: 10 },
  withdrawalRow: { minHeight: 62, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 10 },
  withdrawalCopy: { flex: 1 },
  withdrawalText: { fontSize: 13, lineHeight: 18 },
  withdrawalDate: { marginTop: 2, fontSize: 12 },
  statusPill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  statusText: { fontSize: 11, textTransform: "capitalize", fontWeight: "600" },
});
