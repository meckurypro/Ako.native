// File: components/ShellPlaceholder.tsx
//
// Temporary stand-in for tab screens that aren't ported yet, wired the way
// every real screen should be: main scroller reports scroll to the
// auto-hide context, and is padded for the top bar + bottom nav. Delete
// each usage as the real screen lands.
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AutoHideTopBar } from "./AutoHideTopBar";
import { TopHeader } from "./TopHeader";
import { useAutoHideScrollHandler } from "../hooks/useAutoHideOnScroll";
import { useTheme } from "../lib/theme";

interface ShellPlaceholderProps {
  title: string;
  header?: "create" | "avatar";
}

export function ShellPlaceholder({ title, header }: ShellPlaceholderProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const onScroll = useAutoHideScrollHandler();
  const [topBarHeight, setTopBarHeight] = useState(0);

  return (
    <View style={[styles.root, { backgroundColor: colors.canvas }]}>
      <ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: header ? topBarHeight + 16 : insets.top + 24,
          paddingBottom: 96 + insets.bottom,
          paddingHorizontal: 16,
          gap: 12,
        }}
      >
        <Text style={{ color: colors.ink, fontSize: 20, fontWeight: "500" }}>{title}</Text>
        <Text style={{ color: colors.inkMuted, fontSize: 14 }}>Not ported yet.</Text>
        {Array.from({ length: 30 }).map((_, i) => (
          <View
            key={i}
            style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <Text style={{ color: colors.inkMuted, fontSize: 14 }}>Row {i + 1}</Text>
          </View>
        ))}
      </ScrollView>

      {header && (
        <AutoHideTopBar onHeightChange={setTopBarHeight}>
          <TopHeader leftAction={header} />
        </AutoHideTopBar>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  row: { borderWidth: 1, borderRadius: 16, padding: 20 },
});
