import { useMemo, useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Avatar, Text } from "@/components/core";
import { type MobileGiftType, useGiftTypes, useSendGift, useWallet } from "@/features/feed/api";
import { useTheme } from "@/providers/ThemeProvider";

type Step = "catalog" | "confirm" | "sent";

const imageUrl = (value: string | null) =>
  !value ? null : value.startsWith("http") ? value : `https://ako-taupe.vercel.app${value.startsWith("/") ? value : `/gifts/${value}`}`;

function articleFor(name: string) {
  return /^[aeiou]/i.test(name.trim()) ? "an" : "a";
}

export function GiftPicker({ recipientId, recipientName, recipientAvatar, postId, onClose }: { recipientId: string; recipientName: string; recipientAvatar: string | null; postId?: string; onClose: () => void }) {
  const { colors } = useTheme();
  const router = useRouter();
  const gifts = useGiftTypes();
  const wallet = useWallet();
  const send = useSendGift();
  const [step, setStep] = useState<Step>("catalog");
  const [selected, setSelected] = useState<MobileGiftType | null>(null);
  const [insufficientGift, setInsufficientGift] = useState<MobileGiftType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const balance = Number(wallet.data?.balance ?? 0);
  const sorted = useMemo(() => [...(gifts.data ?? [])].sort((a, b) => b.cost_usd - a.cost_usd), [gifts.data]);

  const pick = (gift: MobileGiftType) => {
    if (balance < gift.cost_usd) {
      setSelected(gift);
      setError(null);
      setInsufficientGift(gift);
      return;
    }
    setInsufficientGift(null);
    setError(null);
    setSelected(gift);
    setStep("confirm");
  };

  const confirm = async () => {
    if (!selected) return;
    setError(null);
    try {
      await send.mutateAsync({ recipient_id: recipientId, gift_type_id: selected.id, ...(postId ? { post_id: postId } : {}) });
      setStep("sent");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't send gift.");
    }
  };

  const openWallet = () => {
    setInsufficientGift(null);
    onClose();
    router.push("/wallet" as never);
  };

  return <Modal visible transparent animationType="fade" onRequestClose={onClose}>
    <View style={s.root}>
      <Pressable style={[s.backdrop, { backgroundColor: colors.overlay }]} onPress={onClose} />
      <View style={[s.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[s.header, { borderBottomColor: colors.border }]}>
          {step === "confirm" ? <Pressable onPress={() => setStep("catalog")} style={s.headerButton}><MaterialCommunityIcons name="arrow-left" size={21} color={colors.textMuted} /></Pressable> : <View><Text maxFontSizeMultiplier={1} style={s.title}>Send a gift</Text><Text maxFontSizeMultiplier={1} color="muted" style={s.subhead}>Send a piece of heritage.</Text></View>}
          <View style={s.headerRight}>{step === "catalog" && <Text maxFontSizeMultiplier={1} color="muted" style={s.balance}>Balance <Text maxFontSizeMultiplier={1} style={[s.balanceValue, { color: colors.text }]}>${balance.toFixed(2)}</Text></Text>}<Pressable onPress={onClose} style={s.headerButton}><MaterialCommunityIcons name="close" size={21} color={colors.textMuted} /></Pressable></View>
        </View>

        <ScrollView contentContainerStyle={s.content}>
          {step === "catalog" ? gifts.isLoading ? <ActivityIndicator color={colors.accent} style={s.loader} /> : <View style={s.grid}>{sorted.map(gift => <Pressable key={gift.id} onPress={() => pick(gift)} style={s.gift}><GiftImage gift={gift} /><Text maxFontSizeMultiplier={1} color="muted" style={s.price}>${gift.cost_usd.toFixed(2)}</Text></Pressable>)}</View> : step === "confirm" && selected ? <View style={s.confirm}><GiftImage gift={selected} large /><Text maxFontSizeMultiplier={1} style={s.confirmTitle}>Send {selected.name}</Text><View style={s.recipient}><Avatar uri={recipientAvatar} name={recipientName} size={28} /><Text maxFontSizeMultiplier={1} color="muted" style={s.toText}>to {recipientName}</Text></View><View style={[s.receipt, { backgroundColor: colors.background, borderColor: colors.border }]}><Receipt label="Gift value" value={`$${selected.cost_usd.toFixed(2)}`} /><View style={[s.rule, { backgroundColor: colors.border }]} /><Receipt label="Your balance" value={`$${balance.toFixed(2)}`} /></View>{error && <Text color="danger" style={s.error}>{error}</Text>}</View> : selected ? <View style={s.sent}><GiftImage gift={selected} large /><Text maxFontSizeMultiplier={1} style={s.confirmTitle}>Gift sent!</Text><Text maxFontSizeMultiplier={1} color="muted" align="center" style={s.sentCopy}>You sent a {selected.name} to {recipientName}.{`\n`}${selected.cost_usd.toFixed(2)} deducted from your wallet.</Text></View> : null}
        </ScrollView>

        {insufficientGift && <View style={s.insufficientLayer}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setInsufficientGift(null)} />
          <View style={s.insufficientContent} pointerEvents="box-none">
            <GiftImage gift={insufficientGift} hero />
            <Text maxFontSizeMultiplier={1} style={s.insufficientText}>Insufficient balance to gift {articleFor(insufficientGift.name)} {insufficientGift.name}. Please fund your <Text maxFontSizeMultiplier={1} style={s.walletLink} onPress={openWallet}>wallet</Text>.</Text>
          </View>
        </View>}

        {step === "confirm" && selected && <View style={[s.footer, { borderTopColor: colors.border }]}><Pressable onPress={() => setStep("catalog")} style={[s.footerButton, { borderColor: colors.border }]}><Text style={s.buttonText}>Cancel</Text></Pressable><Pressable disabled={send.isPending} onPress={() => void confirm()} style={[s.footerButton, { backgroundColor: colors.accent, opacity: send.isPending ? .55 : 1 }]}>{send.isPending ? <ActivityIndicator size="small" color="#07130D" /> : <Text style={[s.buttonText, { color: "#07130D" }]}>Send gift</Text>}</Pressable></View>}
        {step === "sent" && <View style={[s.footer, { borderTopColor: colors.border }]}><Pressable onPress={onClose} style={[s.done, { backgroundColor: colors.accent }]}><Text style={[s.buttonText, { color: "#07130D" }]}>Done</Text></Pressable></View>}
      </View>
    </View>
  </Modal>;
}

function GiftImage({ gift, large, hero }: { gift: MobileGiftType; large?: boolean; hero?: boolean }) {
  const uri = imageUrl(gift.icon_url);
  const box = hero ? s.giftHero : large ? s.giftLarge : s.giftImage;
  return <View style={box}>{uri ? <Image source={{ uri }} style={s.image} resizeMode="contain" /> : <Text style={hero ? s.fallbackHero : large ? s.fallbackLarge : s.fallback}>🎁</Text>}</View>;
}

function Receipt({ label, value }: { label: string; value: string }) {
  return <View style={s.receiptRow}><Text color="muted">{label}</Text><Text style={s.receiptValue}>{value}</Text></View>;
}

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: { maxHeight: "85%", borderWidth: StyleSheet.hairlineWidth, borderBottomWidth: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden" },
  header: { minHeight: 67, paddingHorizontal: 16, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  title: { fontFamily: "serif", fontSize: 19, lineHeight: 25, fontWeight: "700", letterSpacing: -0.15 },
  subhead: { fontSize: 12, lineHeight: 16, marginTop: 1 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 0 },
  balance: { fontSize: 12, lineHeight: 16 },
  balanceValue: { fontWeight: "700" },
  headerButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  content: { padding: 16 },
  loader: { marginVertical: 60 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 12 },
  gift: { width: "30%", alignItems: "center", gap: 5, paddingVertical: 3 },
  giftImage: { width: 78, height: 78, alignItems: "center", justifyContent: "center" },
  giftLarge: { width: 92, height: 92, alignItems: "center", justifyContent: "center" },
  giftHero: { width: 190, height: 150, alignItems: "center", justifyContent: "center" },
  image: { width: "100%", height: "100%" },
  fallback: { fontSize: 34 },
  fallbackLarge: { fontSize: 46 },
  fallbackHero: { fontSize: 76 },
  price: { fontSize: 12, lineHeight: 16 },
  confirm: { alignItems: "center", gap: 14, paddingVertical: 8 },
  confirmTitle: { fontFamily: "serif", fontSize: 20, fontWeight: "700" },
  recipient: { flexDirection: "row", alignItems: "center", gap: 8 },
  toText: { fontSize: 14 },
  receipt: { width: "100%", borderWidth: 1, borderRadius: 13, padding: 15, gap: 12, marginTop: 3 },
  receiptRow: { flexDirection: "row", justifyContent: "space-between" },
  receiptValue: { fontWeight: "700" },
  rule: { height: StyleSheet.hairlineWidth },
  error: { fontSize: 13, textAlign: "center" },
  sent: { alignItems: "center", gap: 13, paddingVertical: 35 },
  sentCopy: { fontSize: 14, lineHeight: 20 },
  footer: { padding: 14, flexDirection: "row", gap: 10, borderTopWidth: StyleSheet.hairlineWidth },
  footerButton: { flex: 1, height: 46, borderRadius: 24, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  done: { flex: 1, height: 46, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  buttonText: { fontSize: 14, fontWeight: "700" },
  insufficientLayer: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,.72)", alignItems: "center", justifyContent: "center", paddingHorizontal: 36 },
  insufficientContent: { alignItems: "center", marginTop: -12 },
  insufficientText: { marginTop: 12, color: "#FFFFFF", fontSize: 16, lineHeight: 24, fontWeight: "700", textAlign: "center" },
  walletLink: { color: "#FFFFFF", textDecorationLine: "underline", fontWeight: "800" },
});

