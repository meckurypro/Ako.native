// File: app/dev/components.tsx
//
// TEMPORARY review screen for the basic overlay/form components — open it
// via the deep link `ako://dev/components` (or router.push("/dev/components")).
// Delete this file, and the `dev` folder, once you've eyeballed everything.
import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation } from "@tanstack/react-query";
import { Bell, Settings, Trash2, Pencil } from "lucide-react-native";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { ConversationActionSheet } from "../../components/ConversationActionSheet";
import { DropdownMenu } from "../../components/DropdownMenu";
import { Modal } from "../../components/Modal";
import { OtpInput } from "../../components/OtpInput";
import { PostActionSheet } from "../../components/PostActionSheet";
import { PrivacyToggle } from "../../components/PrivacyToggle";
import { PrivateProjectNotice } from "../../components/PrivateProjectNotice";
import { SettingsSection } from "../../components/SettingsSection";
import { useToast } from "../../components/Toast";
import { UnavailableNotice } from "../../components/UnavailableNotice";
import { useTheme } from "../../lib/theme";

type Demo = "modal" | "confirm" | "menu" | "postSheet" | "convoSheet" | null;

export default function ComponentsDemo() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const [demo, setDemo] = useState<Demo>(null);
  const [openSection, setOpenSection] = useState<string | null>("a");
  const [priv, setPriv] = useState(false);
  const [otpError, setOtpError] = useState<string | undefined>();
  const menuAnchor = useRef<View>(null);

  // Blocking mutation — LoadingOverlay shows for 2s.
  const fakeSave = useMutation({
    mutationFn: () => new Promise<void>((r) => setTimeout(r, 2000)),
    meta: { blocking: true },
  });

  const Btn = ({ label, onPress }: { label: string; onPress: () => void }) => (
    <Pressable
      onPress={onPress}
      style={[styles.btn, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <Text style={{ color: colors.ink, fontSize: 14 }}>{label}</Text>
    </Pressable>
  );

  return (
    <ScrollView
      style={{ backgroundColor: colors.canvas }}
      contentContainerStyle={{ padding: 16, paddingTop: insets.top + 16, paddingBottom: 48, gap: 12 }}
    >
      <Text style={{ color: colors.ink, fontSize: 20, fontWeight: "500" }}>Components (dev)</Text>

      <View ref={menuAnchor} collapsable={false} style={{ alignSelf: "flex-end" }}>
        <Btn label="Dropdown menu" onPress={() => setDemo("menu")} />
      </View>
      <Btn label="Modal" onPress={() => setDemo("modal")} />
      <Btn label="ConfirmDialog" onPress={() => setDemo("confirm")} />
      <Btn label="PostActionSheet (Delete → ConfirmDialog)" onPress={() => setDemo("postSheet")} />
      <Btn label="ConversationActionSheet" onPress={() => setDemo("convoSheet")} />
      <Btn label="LoadingOverlay (2s blocking mutation)" onPress={() => fakeSave.mutate()} />
      <Btn label="Toast: default / success / error" onPress={() => {
        toast("Default toast");
        toast("Saved.", { variant: "success" });
        toast("Something failed.", { variant: "error" });
      }} />

      <SettingsSection
        icon={<Bell size={18} color={colors.inkMuted} />}
        title="Notifications"
        summary="All"
        open={openSection === "a"}
        onToggle={() => setOpenSection(openSection === "a" ? null : "a")}
      >
        <Text style={{ color: colors.inkMuted, fontSize: 14 }}>Section body — any content, any height.</Text>
      </SettingsSection>
      <SettingsSection
        icon={<Settings size={18} color={colors.danger} />}
        title="Danger zone"
        danger
        open={openSection === "b"}
        onToggle={() => setOpenSection(openSection === "b" ? null : "b")}
      >
        <Text style={{ color: colors.inkMuted, fontSize: 14 }}>Irreversible things live here.</Text>
      </SettingsSection>

      <PrivacyToggle checked={priv} onChange={setPriv} />

      <OtpInput
        error={otpError}
        onComplete={(code) => setOtpError(code === "12345678" ? undefined : "That code isn't right.")}
      />

      <UnavailableNotice kind="post" reason="You deleted this post." />
      <PrivateProjectNotice onMessage={() => toast("Message opened")} messagePending={false} />

      {demo === "modal" && (
        <Modal onClose={() => setDemo(null)} ariaLabel="Demo">
          <Text style={{ color: "#F5F5F7", fontSize: 15 }}>A plain Modal card.</Text>
        </Modal>
      )}
      {demo === "confirm" && (
        <ConfirmDialog
          title="Delete this chat?"
          description="It disappears for you only. The other person keeps their copy."
          confirmLabel="Delete"
          onConfirm={() => setDemo(null)}
          onCancel={() => setDemo(null)}
        />
      )}
      {demo === "menu" && (
        <DropdownMenu
          anchorRef={menuAnchor}
          onClose={() => setDemo(null)}
          items={[
            { key: "edit", label: "Edit", icon: ({ color, size }) => <Pencil size={size} color={color} />, onSelect: () => toast("Edit") },
            "divider",
            { key: "del", label: "Delete", variant: "danger", icon: ({ color, size }) => <Trash2 size={size} color={color} />, onSelect: () => setDemo("confirm") },
          ]}
        />
      )}
      {demo === "postSheet" && (
        <PostActionSheet
          canEdit
          isArchived={false}
          onEdit={() => toast("Edit")}
          onToggleArchive={() => toast("Archive toggled")}
          onDelete={() => setDemo("confirm")}
          onClose={() => setDemo(null)}
        />
      )}
      {demo === "convoSheet" && (
        <ConversationActionSheet
          displayName="Ada Obi"
          isPinned={false}
          onTogglePin={() => toast("Pinned")}
          onArchive={() => toast("Archived")}
          onSelect={() => toast("Select mode")}
          onDelete={() => setDemo("confirm")}
          onClose={() => setDemo(null)}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  btn: { borderWidth: 1, borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16 },
});
