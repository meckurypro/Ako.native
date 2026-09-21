import { Fragment } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { Text } from "@/components/core";
import { useTheme } from "@/providers/ThemeProvider";
import { fonts } from "@/theme/fonts";

const hashtagPattern = /(#\p{L}[\p{L}\p{N}_]*)/gu;
const headingColors: Record<string, [string, string]> = { sapphire: ["#1E4C9A", "#7CB3FF"], emerald: ["#08633F", "#4FE0A8"], amber: ["#7A4A00", "#F2B84D"], garnet: ["#7A1140", "#E893BE"], amethyst: ["#5B3A8A", "#C6A6F0"], petrol: ["#0E5F63", "#5FD6DC"], espresso: ["#5C3A1E", "#D9A876"], graphite: ["#2B2B2E", "#DAD6CC"] };

function FormattedText({ value }: { value: string }) {
  const router = useRouter();
  return <>{value.split(hashtagPattern).map((part, index) => part.startsWith("#") ? <Text key={`${part}-${index}`} color="accent" onPress={() => router.push({ pathname: "/discover/search", params: { q: part.slice(1) } })}>{part}</Text> : <Fragment key={index}>{part}</Fragment>)}</>;
}

export function PostText({ heading, content, headingColor }: { heading?: string | null; content: string; headingColor?: string | null }) {
  const { isDark } = useTheme();
  const hasBody = Boolean(content.trim());
  const paragraphs = (hasBody ? content : heading ?? "").split(/\n{2,}/);
  const headingColorValue = headingColors[headingColor ?? ""]?.[isDark ? 1 : 0] ?? (isDark ? "#7CB3FF" : "#1E4C9A");
  return <View>{heading && hasBody ? <Text style={{ fontSize: 26, lineHeight: 30, fontFamily: fonts.simple.semibold, color: headingColorValue, marginBottom: 12 }}><FormattedText value={heading} /></Text> : null}{paragraphs.map((paragraph, index) => <Text key={index} style={{ fontSize: 15, lineHeight: 24, marginBottom: index < paragraphs.length - 1 ? 12 : 0 }}><FormattedText value={paragraph} /></Text>)}</View>;
}
