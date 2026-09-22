// File: components/feed/FormattedText.tsx
//
// Inline formatting for user-authored text — the token grammar of web's
// src/lib/formatText.tsx, as nested <Text>: #hashtag and @mention links,
// WhatsApp-style *bold* / _italic_ / ~strikethrough~, and [u]underline[/u]
// (only ever inserted by web's FormatToolbar button). Single level only — no
// nesting of one marker inside another. Render inside a parent <Text>.
//
// Native notes:
//   - Bold uses the weight-specific Inter/Roboto file, not fontWeight (see
//     theme/fonts.ts: the two together double-bold on Android). Pass
//     font="simple" inside a Roboto run (the post heading).
//   - The hashtag pattern stays unicode-aware (\p{L}), as it already was in
//     PostText, so #Ọjọ links whole; web's is ASCII-only.
//   - Hashtags open the unified Discover tab pre-filled with `q` and the Posts
//     tab selected; there is no dedicated hashtag screen.
//   - @mentions resolve profile-vs-page the way web's MentionLink does
//     (useAccountKind), starting at the profile route and correcting itself.
//   - A nested <Text onPress> takes the touch itself, so tapping a link inside
//     a tappable post body doesn't also open the post.
import { Fragment } from "react";
import { Text as RNText } from "react-native";
import { useRouter } from "expo-router";
import { useAccountKind } from "@/features/feed/postExtras";
import { useTheme } from "@/providers/ThemeProvider";
import { fonts } from "@/theme/fonts";

const TOKEN_PATTERN = /(#\p{L}[\p{L}\p{N}_]*|@[a-zA-Z0-9_]+|\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|\[u\][^[\]]*\[\/u\])/gu;

function MentionText({ username, label }: { username: string; label: string }) {
  const router = useRouter();
  const { colors } = useTheme();
  const { data: kind } = useAccountKind(username);
  const open = () =>
    kind === "page"
      ? router.push({ pathname: "/pages/[username]", params: { username } })
      : router.push({ pathname: "/profiles/[username]", params: { username } });
  return (
    <RNText onPress={open} style={{ color: colors.accent }}>
      {label}
    </RNText>
  );
}

export function FormattedText({ value, font = "body" }: { value: string; font?: "body" | "simple" }) {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <>
      {value.split(TOKEN_PATTERN).map((part, index) => {
        if (!part) return null;
        const key = `${index}-${part}`;

        if (part.startsWith("#") && part.length > 1) {
          return (
            <RNText
              key={key}
              onPress={() => router.push({ pathname: "/(tabs)/discover", params: { q: part.slice(1) } })}
              style={{ color: colors.accent }}
            >
              {part}
            </RNText>
          );
        }
        if (/^@[a-zA-Z0-9_]+$/.test(part)) return <MentionText key={key} username={part.slice(1)} label={part} />;
        if (part.length > 2 && part.startsWith("*") && part.endsWith("*"))
          return (
            <RNText key={key} style={{ fontFamily: fonts[font].bold }}>
              {part.slice(1, -1)}
            </RNText>
          );
        if (part.length > 2 && part.startsWith("_") && part.endsWith("_"))
          return (
            <RNText key={key} style={{ fontStyle: "italic" }}>
              {part.slice(1, -1)}
            </RNText>
          );
        if (part.length > 2 && part.startsWith("~") && part.endsWith("~"))
          return (
            <RNText key={key} style={{ textDecorationLine: "line-through" }}>
              {part.slice(1, -1)}
            </RNText>
          );
        if (part.startsWith("[u]") && part.endsWith("[/u]"))
          return (
            <RNText key={key} style={{ textDecorationLine: "underline" }}>
              {part.slice(3, -4)}
            </RNText>
          );
        return <Fragment key={key}>{part}</Fragment>;
      })}
    </>
  );
}
