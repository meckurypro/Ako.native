import { useMemo, useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, TextInput, View } from "react-native";
import { Icon } from "@/components/core/Icon";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@/components/core";
import { formatNgn, formatUsd, useExchangeRates, useFeatureFlag, useInitiateDeposit } from "@/features/wallet/api";
import { useTheme } from "@/providers/ThemeProvider";

const PRESET_AMOUNTS = [5, 10, 25, 50, 100];
const MINIMUM_DEPOSIT_USD = 1;

export default function FundWalletScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const rates = useExchangeRates();
  const initiateDeposit = useInitiateDeposit();
  const depositsEnabled = useFeatureFlag("deposits_enabled");
  const [selectedPreset, setSelectedPreset] = useState<number | null>(10);
  const [customAmount, setCustomAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const amountUsd = customAmount ? Number(customAmount) : selectedPreset ?? 0;
  const previewNgn = useMemo(() => rates.data?.deposit && amountUsd ? amountUsd * rates.data.deposit : null, [rates.data?.deposit, amountUsd]);

  const setCustom = (value: string) => {
    if (value === "" || /^\d*\.?\d{0,2}$/.test(value)) {
      setCustomAmount(value);
      setSelectedPreset(null);
      setError(null);
    }
  };

  const submit = async () => {
    setError(null);
    if (!amountUsd || amountUsd < MINIMUM_DEPOSIT_USD) return setError(`Minimum deposit is ${formatUsd(MINIMUM_DEPOSIT_USD)}.`);
    try {
      const result = await initiateDeposit.mutateAsync(amountUsd);
      await Linking.openURL(result.authorization_url);
    } catch (err) {
      Alert.alert("Couldn't start payment", err instanceof Error ? err.message : "Try again.");
    }
  };

  return <SafeAreaView style={[s.safe, { backgroundColor: colors.background }]}><View style={s.content}><View style={s.header}><Pressable onPress={() => router.back()} style={s.back}><Icon name="arrow-left" size={22} color={colors.textSecondary} /></Pressable></View><Text style={s.title}>Fund your wallet</Text>{!depositsEnabled ? <Text color="muted" style={s.description}>Deposits are temporarily unavailable. Check back later.</Text> : <><Text color="muted" style={s.description}>Add money to your Akọ wallet via card, bank transfer, or USSD — powered by Paystack. Available any time, every day.</Text><View style={s.presets}>{PRESET_AMOUNTS.map((usd) => <Pressable key={usd} onPress={() => { setSelectedPreset(usd); setCustomAmount(""); setError(null); }} style={[s.preset, { backgroundColor: selectedPreset === usd ? colors.accentSoft : colors.surface, borderColor: selectedPreset === usd ? colors.accent : colors.border }]}><Text style={s.presetText}>{formatUsd(usd)}</Text></Pressable>)}<Pressable onPress={() => { setSelectedPreset(null); setError(null); }} style={[s.preset, { backgroundColor: selectedPreset === null ? colors.accentSoft : colors.surface, borderColor: selectedPreset === null ? colors.accent : colors.border }]}><Text style={s.customText}>Custom</Text></Pressable></View>{selectedPreset === null ? <View style={s.field}><Text color="muted" style={s.label}>Amount (USD)</Text><View style={[s.inputWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}><Text color="muted" style={s.currency}>$</Text><TextInput value={customAmount} onChangeText={setCustom} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.textMuted} style={[s.input, { color: colors.text }]} /></View></View> : null}{amountUsd > 0 ? <View style={[s.summary, { backgroundColor: colors.surface, borderColor: colors.border }]}><View style={s.summaryRow}><Text color="muted" style={s.summaryLabel}>Add to wallet</Text><Text style={s.summaryValue}>{formatUsd(amountUsd)}</Text></View><View style={[s.totalRow, { borderTopColor: colors.border }]}><Text color="muted" style={s.summaryLabel}>Paystack charge</Text><Text style={s.totalValue}>{previewNgn !== null ? formatNgn(previewNgn) : "…"}</Text></View>{rates.data?.deposit ? <Text color="muted" style={s.rate}>Rate: $1 = {formatNgn(rates.data.deposit)}</Text> : null}</View> : null}{error ? <Text color="danger" style={s.error}>{error}</Text> : null}<Pressable disabled={initiateDeposit.isPending} onPress={() => void submit()} style={[s.button, { backgroundColor: colors.accent }, initiateDeposit.isPending && { opacity: .6 }]}><Icon name="lock" size={18} color="#07130D" /><Text style={s.buttonText}>{initiateDeposit.isPending ? "Starting…" : "Continue to Paystack"}</Text></Pressable></>}</View></SafeAreaView>;
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingHorizontal: 18, paddingTop: 6, paddingBottom: 32 },
  header: { height: 38, justifyContent: "center" },
  back: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: "serif", fontSize: 28, lineHeight: 34, marginBottom: 8 },
  description: { fontSize: 14, lineHeight: 20, marginBottom: 24 },
  presets: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 16 },
  preset: { width: "30.5%", minHeight: 76, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  presetText: { fontFamily: "serif", fontSize: 20 },
  customText: { fontFamily: "serif", fontSize: 14 },
  field: { marginBottom: 20 },
  label: { fontSize: 14, marginBottom: 7 },
  inputWrap: { height: 48, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, paddingHorizontal: 14, flexDirection: "row", alignItems: "center" },
  currency: { marginRight: 4 },
  input: { flex: 1, fontSize: 16 },
  summary: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 16, marginBottom: 20 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  summaryLabel: { fontSize: 14 },
  summaryValue: { fontSize: 14, fontWeight: "600" },
  totalValue: { fontFamily: "serif", fontSize: 24 },
  rate: { marginTop: 8, fontSize: 12 },
  error: { marginBottom: 14, fontSize: 13 },
  button: { height: 48, borderRadius: 24, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  buttonText: { color: "#07130D", fontWeight: "700" },
});
