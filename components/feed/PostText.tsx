import { View } from "react-native";
import { Text } from "@/components/core";
import { useTheme } from "@/providers/ThemeProvider";
import { fonts } from "@/theme/fonts";
import { getHeadingColorHex } from "@/lib/heading-colors";
import { FormattedText } from "./FormattedText";

export function PostText({ heading, content, headingColor }: { heading?: string | null; content: string; headingColor?: string | null }) {
  const { isDark } = useTheme();
  const hasBody = Boolean(content.trim());
  const paragraphs = (hasBody ? content : heading ?? "").split(/\n{2,}/);
  const headingColorValue = getHeadingColorHex(headingColor, isDark);
  return <View>{heading && hasBody ? <Text style={{ fontSize: 26, lineHeight: 30, fontFamily: fonts.simple.semibold, color: headingColorValue, marginBottom: 12 }}><FormattedText value={heading} font="simple" /></Text> : null}{paragraphs.map((paragraph, index) => <Text key={index} style={{ fontSize: 15, lineHeight: 24, marginBottom: index < paragraphs.length - 1 ? 12 : 0 }}><FormattedText value={paragraph} /></Text>)}</View>;
}
