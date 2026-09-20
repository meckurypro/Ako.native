// File: components/PostContent.tsx
// Port of web's src/components/PostContent.tsx.
//
// Heading matches the author name in family (both a plain sans) so the
// two read as one consistent voice. A heading with no body underneath
// isn't really a "headline" for anything — it's just what the person
// typed into the title field with nothing added below — so it renders
// as plain body text instead of a large bold headline, which otherwise
// reads like a shouty, half-empty post.
//
// Color: colors.postHeader, not colors.ink — a dedicated blue token
// (own light/dark pair in lib/theme.ts) rather than colors.accent
// (sage, reads as a link/action color here). Weight: semibold, a step
// down from bold but still clearly heavier than the body/details text
// below it, so the heading stays the most prominent line without
// shouting.
//
// A picked color (see Compose.tsx's palette button, lib/headingColors.ts)
// overrides the default postHeader color — themed the same way
// postHeader itself already is (each HeadingColorDef carries its own
// light/dark pair; isDark below picks the right one). No pick (null/
// undefined, every heading from before this feature existed) leaves
// colors.postHeader alone, so it keeps reading exactly as before.
//
// Web wraps each paragraph in a <p> with Tailwind's whitespace-pre-wrap
// break-words; RN's Text already wraps and preserves internal newlines
// by default, so each paragraph is just its own <Text> with a bottom
// margin on all but the last.
import { StyleSheet, Text, View } from "react-native";
import { renderFormattedText } from "../lib/formatText";
import { getHeadingColorDef } from "../lib/headingColors";
import { useTheme } from "../lib/theme";

interface PostContentProps {
  heading?: string | null;
  headingColor?: string | null;
  content: string;
}

function Paragraphs({ content, color }: { content: string; color: string }) {
  const paragraphs = content.split(/\n{2,}/);
  return (
    <>
      {paragraphs.map((para, i) => (
        <Text
          key={i}
          style={[styles.paragraph, { color }, i < paragraphs.length - 1 && styles.paragraphSpacing]}
        >
          {renderFormattedText(para, `p${i}`)}
        </Text>
      ))}
    </>
  );
}

export function PostContent({ heading, headingColor, content }: PostContentProps) {
  const { colors, isDark } = useTheme();
  const hasBody = content.trim() !== "";

  if (heading && !hasBody) {
    return (
      <View>
        <Paragraphs content={heading} color={colors.ink} />
      </View>
    );
  }

  const colorDef = getHeadingColorDef(headingColor);
  const headingColorValue = colorDef ? (isDark ? colorDef.dark : colorDef.light) : colors.postHeader;

  return (
    <View>
      {!!heading && (
        <Text style={[styles.heading, { color: headingColorValue }]}>
          {renderFormattedText(heading, "h")}
        </Text>
      )}
      {hasBody && <Paragraphs content={content} color={colors.ink} />}
    </View>
  );
}

const styles = StyleSheet.create({
  // web: text-[15px] leading-[24px] mb-3 (on all but last paragraph)
  paragraph: { fontSize: 15, lineHeight: 24 },
  paragraphSpacing: { marginBottom: 12 },
  // web: font-simple text-[26px] font-semibold leading-[30px] mb-3
  heading: { fontSize: 26, fontWeight: "600", lineHeight: 30, marginBottom: 12 },
});
