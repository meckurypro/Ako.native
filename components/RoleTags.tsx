// File: components/RoleTags.tsx
// Direct port of web's src/components/RoleTags.tsx. Web accepted a
// `className` to let each call site style the text (size/color/weight
// via Tailwind utilities); RN has no cascade to hand that off to, so
// this takes an optional `style` prop instead and callers pass a
// TextStyle the same way they'd have passed a className.
import { Text, type TextStyle } from "react-native";
import type { ProfileRole } from "../types/database";

export function RoleTags({ roles, style }: { roles: ProfileRole[]; style?: TextStyle }) {
  if (!roles || roles.length === 0) return null;
  const sorted = [...roles].sort((a, b) => a.position - b.position);
  return <Text style={style}>{sorted.map((r) => r.label).join(" · ")}</Text>;
}
