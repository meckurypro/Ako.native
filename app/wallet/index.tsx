import { ActivityIndicator, Platform, FlatList, Pressable, StyleSheet, View } from "react-native";
import { Icon, type IconName } from "@/components/core/Icon";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Rect } from "react-native-svg";
import { Text } from "@/components/core";
import { OfflineState } from "@/components/feedback";
import { getScreenState } from "@/lib/screenState";
import { formatUsd, useFeatureFlag, useWallet, useWalletTransactions, type WalletTransaction } from "@/features/wallet/api";
import { useTheme } from "@/providers/ThemeProvider";
import { ProbationalLock } from "@/components/account/ProbationalLock";

const TXN_META: Record<string, { label: string; icon: IconName; positive?: boolean }> = {
  fund: { label: "Wallet funded", icon: "arrow-down-circle", positive: true },
  gift_sent: { label: "Gift sent", icon: "gift" },
  gift_received: { label: "Gift received", icon: "gift", positive: true },
  platform_fee: { label: "Platform fee", icon: "receipt" },
  withdrawal: { label: "Withdrawal", icon: "arrow-up-circle" },
  reversal: { label: "Reversal", icon: "rotate-ccw", positive: true },
  dev_credit: { label: "Dev credit", icon: "sparkles", positive: true },
  affiliate_commission: { label: "Affiliate commission", icon: "trending-up", positive: true },
  affiliate_commission_reversal: { label: "Affiliate commission reversed", icon: "rotate-ccw" },
  promotion_charge: { label: "Promotion charge", icon: "megaphone" },
  promotion_refund: { label: "Promotion refund", icon: "rotate-ccw", positive: true },
  give_back: { label: "Give Back reward", icon: "heart", positive: true },
  give_back_reversal: { label: "Give Back reward reversed", icon: "rotate-ccw" },
};

function txnDate(dateString: string) {
  const d = new Date(dateString);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: sameYear ? undefined : "numeric" });
}

export default function WalletScreen() {
  const { colors } = useTheme();
  const wallet = useWallet();
  const transactions = useWalletTransactions();
  const walletEnabled = useFeatureFlag("wallet_enabled");
  const depositsEnabled = useFeatureFlag("deposits_enabled");
  const withdrawalsEnabled = useFeatureFlag("withdrawals_enabled");
  const affiliateEnabled = useFeatureFlag("affiliate_programs_enabled");

  if (!walletEnabled) return <View style={[s.root, { backgroundColor: colors.background }]}><Header /><Text color="muted" align="center" style={s.disabled}>The wallet is temporarily unavailable. Check back later.</Text><BottomNavigation /></View>;

  return <ProbationalLock featureKey="probational_wallet_enabled"><View style={[s.root, { backgroundColor: colors.background }]}><Header />{getScreenState(wallet) === "offline" ? <OfflineState message="Your balance isn’t saved on this device. It will load when you’re back online." onRetry={() => void wallet.refetch()} /> : wallet.isLoading ? <ActivityIndicator color={colors.accent} style={s.loader} /> : <FlatList data={transactions.data ?? []} keyExtractor={(item) => item.id} contentContainerStyle={s.list} ListHeaderComponent={<><BalanceCard balance={wallet.data?.balance ?? 0} depositsEnabled={depositsEnabled} withdrawalsEnabled={withdrawalsEnabled} affiliateEnabled={affiliateEnabled} /><Text style={s.recentTitle}>Recent activity</Text></>} ListEmptyComponent={<View style={s.empty}><Text color="muted" align="center" style={s.emptyMain}>No transactions yet.</Text><Text color="muted" align="center" style={s.emptySub}>Everything you fund, spend, and earn will show up here.</Text></View>} renderItem={({ item }) => <TransactionRow transaction={item} />} refreshing={transactions.isRefetching || wallet.isRefetching} onRefresh={() => { void wallet.refetch(); void transactions.refetch(); }} /> }<BottomNavigation /></View></ProbationalLock>;
}

function Header() {
  const router = useRouter();
  const { colors } = useTheme();
  return <View style={[s.header, { borderBottomColor: colors.border }]}><Pressable onPress={() => router.back()} style={s.back}><Icon name="arrow-left" size={22} color={colors.textSecondary} /></Pressable><Text style={s.title}>Wallet</Text></View>;
}

function BalanceCard({ balance, depositsEnabled, withdrawalsEnabled, affiliateEnabled }: { balance: number; depositsEnabled: boolean; withdrawalsEnabled: boolean; affiliateEnabled: boolean }) {
  const router = useRouter();
  const { colors } = useTheme();
  return <View style={[s.balanceCard, { backgroundColor: colors.accent }]}><Icon name="wallet" size={140} color="rgba(6,18,11,0.12)" style={s.watermark} /><View style={s.balanceTop}><Text style={s.balanceLabel}>AVAILABLE BALANCE</Text><Icon name="wallet" size={18} color="rgba(6,18,11,0.7)" /></View><Text style={s.balance}>{formatUsd(balance)}</Text><View style={s.actionRow}>{depositsEnabled ? <WalletAction label="Fund" icon="arrow-down-circle" onPress={() => router.push("/wallet/fund")} /> : null}{withdrawalsEnabled ? <WalletAction label="Withdraw" icon="arrow-up-circle" onPress={() => router.push("/wallet/withdraw")} /> : null}{affiliateEnabled ? <WalletAction label="Affiliate" icon="trending-up" onPress={() => router.push({ pathname: "/activity/[kind]", params: { kind: "affiliates" } })} /> : null}</View>{!depositsEnabled && !withdrawalsEnabled ? <Text style={s.unavailable}>Funding and withdrawals are temporarily unavailable.</Text> : null}</View>;
}

function WalletAction({ label, icon, onPress }: { label: string; icon: IconName; onPress: () => void }) {
  return <Pressable onPress={onPress} style={s.walletAction}><View style={s.actionIcon}><Icon name={icon} size={20} color="#07130D" /></View><Text style={s.actionText}>{label}</Text></Pressable>;
}

function TransactionRow({ transaction }: { transaction: WalletTransaction }) {
  const { colors } = useTheme();
  const amount = Number(transaction.amount);
  const meta = TXN_META[transaction.type] ?? { label: transaction.type, icon: "receipt" as const };
  const positive = amount >= 0;
  return <View style={[s.txnRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}><View style={[s.txnIcon, { backgroundColor: positive || meta.positive ? colors.accentSoft : colors.background }]}><Icon name={meta.icon} size={17} color={positive || meta.positive ? colors.accent : colors.textMuted} /></View><View style={s.txnCopy}><Text numberOfLines={1} style={s.txnTitle}>{meta.label}</Text><Text color="muted" style={s.txnDate}>{txnDate(transaction.created_at)}</Text></View><Text style={[s.txnAmount, { color: positive ? colors.accent : colors.text }]}>{positive ? "+" : "-"}{formatUsd(Math.abs(amount))}</Text></View>;
}

function FeedIcon({ color }: { color: string }) {
  return <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><Path d="M3 11.5 12 4l9 7.5" /><Path d="M5.5 10v9a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-9" /></Svg>;
}

function LibraryIcon({ color }: { color: string }) {
  return <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round"><Rect width={8} height={18} x={3} y={3} rx={1} /><Path d="M7 3v18" /><Path d="M20.4 18.9c.2.5-.1 1.1-.6 1.3l-1.9.7c-.5.2-1.1-.1-1.3-.6L11.1 5.1c-.2-.5.1-1.1.6-1.3l1.9-.7c.5-.2 1.1.1 1.3.6Z" /></Svg>;
}

function BottomNavigation() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomInset = Platform.OS === "android" ? Math.max(insets.bottom, 34) : insets.bottom;
  const items = [
    { label: "Feed", onPress: () => router.push("/(tabs)/home"), icon: <FeedIcon color={colors.textMuted} /> },
    { label: "Discover", onPress: () => router.push("/(tabs)/discover"), icon: <Icon name="search" size={24} color={colors.textMuted} strokeWidth={1.75} /> },
    { label: "Library", onPress: () => router.push("/(tabs)/create"), icon: <LibraryIcon color={colors.textMuted} /> },
    { label: "Messages", onPress: () => router.push("/(tabs)/inbox"), icon: <Icon name="message-circle" size={24} color={colors.textMuted} strokeWidth={1.75} /> },
    { label: "Profile", onPress: () => router.push("/(tabs)/profile"), icon: <Icon name="user" size={24} color={colors.textMuted} strokeWidth={1.75} /> },
  ];
  return <View style={[s.bottomNav, { backgroundColor: colors.surface, borderTopColor: colors.border, height: 76 + bottomInset, paddingBottom: bottomInset }]}>{items.map((item) => <Pressable key={item.label} onPress={item.onPress} style={s.navItem}>{item.icon}<Text color="muted" style={s.navLabel}>{item.label}</Text></Pressable>)}</View>;
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: { height: 68, paddingHorizontal: 16, paddingTop: 14, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  back: { width: 28, height: 32, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: "serif", fontSize: 24 },
  loader: { marginTop: 48 },
  disabled: { marginTop: 40, paddingHorizontal: 28 },
  list: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 110, flexGrow: 1 },
  balanceCard: { minHeight: 236, borderRadius: 28, padding: 24, paddingTop: 28, overflow: "hidden", shadowColor: "#000", shadowOpacity: .25, shadowRadius: 22, shadowOffset: { width: 0, height: 14 }, elevation: 8 },
  watermark: { position: "absolute", right: -22, top: -24 },
  balanceTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  balanceLabel: { color: "rgba(6,18,11,0.7)", fontSize: 11, lineHeight: 15, fontWeight: "700", letterSpacing: 1.4 },
  balance: { color: "#07130D", marginTop: 12, marginBottom: 28, fontFamily: "serif", fontSize: 44, lineHeight: 52 },
  actionRow: { flexDirection: "row", gap: 24, alignItems: "center" },
  walletAction: { alignItems: "center", gap: 6 },
  actionIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(7,19,13,0.14)", alignItems: "center", justifyContent: "center" },
  actionText: { color: "#07130D", fontSize: 12, lineHeight: 15, fontWeight: "700" },
  unavailable: { color: "rgba(6,18,11,0.7)", marginTop: 18, fontSize: 12 },
  recentTitle: { marginTop: 30, marginBottom: 12, fontFamily: "serif", fontSize: 18, lineHeight: 23 },
  empty: { paddingVertical: 40, alignItems: "center" },
  emptyMain: { fontSize: 14, lineHeight: 19 },
  emptySub: { marginTop: 4, fontSize: 12, lineHeight: 16 },
  txnRow: { minHeight: 68, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 12 },
  txnIcon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  txnCopy: { flex: 1, minWidth: 0 },
  txnTitle: { fontSize: 14, lineHeight: 19 },
  txnDate: { marginTop: 2, fontSize: 12, lineHeight: 16 },
  txnAmount: { fontSize: 14, lineHeight: 19, fontWeight: "600" },
  bottomNav: { position: "absolute", left: 0, right: 0, bottom: 0, height: 76, borderTopWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: 28, borderTopRightRadius: 28, overflow: "hidden", flexDirection: "row", paddingTop: 13 },
  navItem: { flex: 1, alignItems: "center", gap: 5 },
  navLabel: { fontSize: 11, lineHeight: 14, fontWeight: "500" },
});
