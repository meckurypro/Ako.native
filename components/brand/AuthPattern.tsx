// components/brand/AuthPattern.tsx
//
// Shared background texture — mudcloth/bogolan-style geometric symbol grid,
// ported from web's src/components/AuthPattern.tsx. This is the "shared"
// version called for by the splash-screen spec: components/auth/AuthPattern.tsx
// (the pre-existing, loop-tiled version used by AuthScreen) stays in place and
// unchanged for now, but should be pointed at this component once this has
// been verified pixel-for-pixel against web — see the LIMITATION note below.
//
// Structure matches web exactly: a <Defs> block of <Symbol> shapes tiled via
// a single <Pattern patternUnits="userSpaceOnUse"> of <Use> references, not a
// JS position/rotation loop. This is one <Rect fill="url(#...)" /> draw call
// instead of 49 separate <Svg> nodes, which is both closer to web's DOM and
// (per the spec's own "Motif performance" note) the thing to swap for a
// pre-rendered PNG first if a low-end Android device ever drops a frame on it.
//
// LIMITATION (be explicit about this in the PR): web's AuthPattern.tsx ships
// 29 unique motifs and a verbatim 49-entry (symbolId, rotation) placement
// grid. That source file was not available to port from in this session — the
// only motifs on hand are the 14 already carried over into
// components/auth/AuthPattern.tsx by an earlier pass. SYMBOLS below reuses
// those 14 verbatim (same path data, unchanged) and GRID cycles them across
// the 49 cells with a deterministic rotation, which reads as the same "woven
// swatch" sampler but is NOT byte-for-byte what web renders. Before this
// replaces the AuthScreen pattern or ships in the splash, diff against web's
// file and paste in the remaining 15 symbols + the real 49-entry grid.
//
// Usage — first child of a `flex:1` / absolute-fill container, real content
// in a sibling on top:
//
//   <View style={{ flex: 1 }}><AuthPattern /><View style={{ flex: 1 }}>...</View></View>

import { memo, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, G, Path, Pattern, Rect, Symbol, Use } from "react-native-svg";
import { useTheme } from "@/providers/ThemeProvider";

// Same 14 path sets as components/auth/AuthPattern.tsx (kept verbatim so the
// two components agree until they're unified) — each keyed as a <Symbol id>.
const SYMBOL_PATHS: Record<string, (c: string) => ReactNode> = {
  m0: (c) => <><Path d="M15 5 35 25 15 45 35 65 15 85 35 95" stroke={c} fill="none" /><Path d="M65 5 85 25 65 45 85 65 65 85 85 95" stroke={c} fill="none" /></>,
  m1: (c) => <><Circle cx={50} cy={50} r={14} stroke={c} fill="none" /><Circle cx={50} cy={50} r={27} stroke={c} fill="none" /><Circle cx={50} cy={50} r={40} stroke={c} fill="none" /></>,
  m2: (c) => <Path d="M50 8 92 50 50 92 8 50Z" stroke={c} fill="none" />,
  m3: (c) => <Path d="M50 10 90 90H10Z" stroke={c} fill="none" />,
  m4: (c) => <Path d="M50 12 88 88H12Z" fill={c} stroke="none" />,
  m5: (c) => <><Path d="M15 30 50 12 85 30" stroke={c} fill="none" /><Path d="M15 55 50 37 85 55" stroke={c} fill="none" /><Path d="M15 80 50 62 85 80" stroke={c} fill="none" /></>,
  m6: (c) => <><Path d="M50 8v84" stroke={c} fill="none" /><Path d="M50 20 30 8M50 20 70 8M50 40 30 28M50 40 70 28M50 60 30 48M50 60 70 48M50 80 30 68M50 80 70 68" stroke={c} fill="none" /></>,
  m7: (c) => <>{[22, 50, 78].flatMap((cx) => [22, 50, 78].map((cy) => <Circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={5} fill={c} stroke="none" />))}</>,
  m8: (c) => <Path d="M12 12 88 88M88 12 12 88" stroke={c} fill="none" />,
  m9: (c) => <><Path d="M20 25a35 35 0 0 1 0 50" stroke={c} fill="none" /><Path d="M38 33a24 24 0 0 1 0 34" stroke={c} fill="none" /><Path d="M55 40a15 15 0 0 1 0 20" stroke={c} fill="none" /><Circle cx={75} cy={50} r={4} fill={c} stroke="none" /></>,
  m10: (c) => <><Circle cx={50} cy={50} r={10} stroke={c} fill="none" /><Circle cx={50} cy={50} r={22} stroke={c} fill="none" /><Circle cx={50} cy={50} r={34} stroke={c} fill="none" /></>,
  m11: (c) => <Path d="M15 8v84M32 8v84M50 8v84M68 8v84M85 8v84" stroke={c} fill="none" />,
  m12: (c) => <Path d="M8 15h84M8 32h84M8 50h84M8 68h84M8 85h84" stroke={c} fill="none" />,
  m13: (c) => <><Path d="M10 85 22 62 34 85Z" stroke={c} fill="none" /><Path d="M38 85 50 62 62 85Z" stroke={c} fill="none" /><Path d="M66 85 78 62 90 85Z" stroke={c} fill="none" /></>,
};
const SYMBOL_IDS = Object.keys(SYMBOL_PATHS);

const TILE = 476; // 7 * CELL
const CELL = 68;
const COLS = 7;
const ROWS = 7;
const ROTATIONS = [0, 90, 180, 270] as const;

// Deterministic (symbolId, rotationDeg) per cell, row-major — see LIMITATION
// above re: this being a stand-in for web's verbatim 49-entry grid.
const GRID: Array<{ id: string; rotation: number }> = Array.from({ length: ROWS * COLS }, (_, i) => {
  const row = Math.floor(i / COLS);
  const col = i % COLS;
  return {
    id: SYMBOL_IDS[(row * 5 + col * 3 + i) % SYMBOL_IDS.length],
    rotation: ROTATIONS[(row * 3 + col * 5) % ROTATIONS.length],
  };
});

export const AuthPattern = memo(function AuthPattern({
  color,
  opacity = 0.07,
}: {
  color?: string;
  opacity?: number;
}) {
  const { colors } = useTheme();
  const strokeColor = color ?? colors.text;

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      renderToHardwareTextureAndroid
      shouldRasterizeIOS
      style={[StyleSheet.absoluteFill, { opacity }]}
    >
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          {SYMBOL_IDS.map((id) => (
            <Symbol key={id} id={id} viewBox="0 0 100 100">
              <G strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round">
                {SYMBOL_PATHS[id](strokeColor)}
              </G>
            </Symbol>
          ))}
          <Pattern id="authPattern" width={TILE} height={TILE} patternUnits="userSpaceOnUse">
            {GRID.map(({ id, rotation }, i) => {
              const row = Math.floor(i / COLS);
              const col = i % COLS;
              const x = col * CELL;
              const y = row * CELL;
              const cx = x + CELL / 2;
              const cy = y + CELL / 2;
              return (
                <Use
                  key={i}
                  href={`#${id}`}
                  x={x}
                  y={y}
                  width={CELL}
                  height={CELL}
                  transform={`rotate(${rotation} ${cx} ${cy})`}
                />
              );
            })}
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#authPattern)" />
      </Svg>
    </View>
  );
});
