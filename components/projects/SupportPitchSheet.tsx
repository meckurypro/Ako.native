// File: components/projects/SupportPitchSheet.tsx
import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import { Button, Icon, Input, Text } from "@/components/core";
import { useSupportPitch } from "@/features/projects/api";
import { useTheme } from "@/providers/ThemeProvider";

// Bottom sheet to back a Pitch project with an amount and optional message (mirrors web's SupportPitchSheet).
export function SupportPitchSheet({ projectId, projectTitle, onClose, onSupported }: { projectId: string; projectTitle: string; onClose: () => void; onSupported: () => void }) {
  const { colors, radii } = useTheme();
  const support = useSupportPitch(projectId);
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setError(null);
    const amountUsd = parseFloat(amount);
    if (!amount.trim() || Number.isNaN(amountUsd) || amountUsd <= 0) { setError("Enter an amount above $0."); return; }
    try { await support.mutateAsync({ amountUsd, message: message.trim() || undefined }); onSupported(); } catch (err) { setError(err instanceof Error ? err.message : "Couldn’t process your support."); }
  };
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <Pressable accessibilityLabel="Close" style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]} onPress={onClose} />
        <View style={{ flex: 1, justifyContent: "flex-end" }} pointerEvents="box-none">
          <View style={{ backgroundColor: colors.surface, borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, padding: 20, paddingBottom: 28, gap: 14 }}>
            <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text variant="heading">Support this idea</Text>
                <Text variant="caption" color="secondary" numberOfLines={1} style={{ marginTop: 2 }}>{projectTitle}</Text>
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} onPress={onClose}><Icon name="x" size={20} color={colors.textMuted} /></Pressable>
            </View>
            <Input label="Amount (USD)" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="25" autoFocus />
            <Input label="Message (optional)" value={message} onChangeText={setMessage} multiline maxLength={500} />
            {error ? <Text variant="caption" color="danger" accessibilityRole="alert">{error}</Text> : null}
            <Button label="Support" loading={support.isPending} onPress={() => void submit()} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
