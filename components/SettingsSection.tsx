// File: components/SettingsSection.tsx
//
// Collapsible settings card: icon + title + optional collapsed-state
// summary + chevron. Open state is controlled by the parent so it can
// enforce "only one section open at a time". Web animates
// grid-template-rows 0fr <-> 1fr over 300ms ease-out; RN has no
// equivalent, so the body's real height is measured and animated instead
// (the body follows if its content changes height while open).
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { ChevronDown } from "lucide-react-native";
import { useTheme } from "../lib/theme";

interface SettingsSectionProps {
  icon: ReactNode;
  title: string;
  /** Short collapsed-state preview, e.g. "System" or "Private". */
  summary?: string;
  open: boolean;
  onToggle: () => void;
  /** Red-tinted header for destructive/irreversible settings. */
  danger?: boolean;
  children: ReactNode;
}

const EASE_OUT = Easing.bezier(0, 0, 0.58, 1);

export function SettingsSection({
  icon,
  title,
  summary,
  open,
  onToggle,
  danger = false,
  children,
}: SettingsSectionProps) {
  const { colors } = useTheme();
  const [contentHeight, setContentHeight] = useState(0);
  const expand = useRef(new Animated.Value(open ? 1 : 0)).current; // body height, JS-driven
  const rotate = useRef(new Animated.Value(open ? 1 : 0)).current; // chevron, native-driven

  useEffect(() => {
    Animated.timing(expand, {
      toValue: open ? 1 : 0,
      duration: 300,
      easing: EASE_OUT,
      useNativeDriver: false, // height can't use the native driver
    }).start();
    Animated.timing(rotate, {
      toValue: open ? 1 : 0,
      duration: 200,
      easing: EASE_OUT,
      useNativeDriver: true,
    }).start();
  }, [open, expand, rotate]);

  function handleContentLayout(e: LayoutChangeEvent) {
    setContentHeight(e.nativeEvent.layout.height);
  }

  const bodyHeight = expand.interpolate({ inputRange: [0, 1], outputRange: [0, contentHeight] });
  const chevronRotation = rotate.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });
  const titleColor = danger ? colors.danger : colors.ink;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={styles.header}
      >
        <View>{icon}</View>
        <Text style={[styles.title, { color: titleColor }]}>{title}</Text>
        {summary && !open && (
          <Text numberOfLines={1} style={[styles.summary, { color: colors.inkMuted }]}>
            {summary}
          </Text>
        )}
        <Animated.View style={{ transform: [{ rotate: chevronRotation }] }}>
          <ChevronDown size={18} color={colors.inkMuted} />
        </Animated.View>
      </Pressable>

      {/* Clip box animates; the inner view is pinned to the top so its
          natural height can be measured while the clip box is 0. */}
      <Animated.View
        style={[styles.clip, { height: bodyHeight }]}
        pointerEvents={open ? "auto" : "none"}
      >
        <View
          onLayout={handleContentLayout}
          style={[styles.body, { borderTopColor: colors.border }]}
        >
          {children}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  // bg-surface rounded-2xl overflow-hidden
  card: { borderRadius: 16, overflow: "hidden" },
  // w-full flex items-center gap-3 p-4
  header: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  // flex-1 min-w-0 text-sm font-medium
  title: { flex: 1, fontSize: 14, fontWeight: "500" },
  // text-xs truncate max-w-[40%]
  summary: { fontSize: 12, maxWidth: "40%" },
  clip: { overflow: "hidden" },
  // px-4 pb-5 pt-1 border-t — absolute so measuring isn't capped by the
  // (animating) clip box.
  body: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 20,
    paddingTop: 4,
    borderTopWidth: 1,
  },
});
