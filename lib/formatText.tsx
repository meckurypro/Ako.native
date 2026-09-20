// File: lib/formatText.tsx
// Port of web's src/lib/formatText.tsx — shared inline-formatting
// parser used everywhere user-authored text is displayed: post
// content, project descriptions, comments. Handles:
//   - #hashtag / @mention -> tappable links (existing behavior)
//   - *bold* / _italic_ / ~strikethrough~ -> WhatsApp-style typed
//     markers, since that's the convention creators already reach for
//   - [u]underline[/u] -> no natural typed convention exists for
//     underline (unlike * _ ~), so this marker is only ever inserted
//     by FormatToolbar's Underline button, never typed by hand
//
// Single-level only (no nesting of one marker inside another) — kept
// simple on purpose to match how people actually type on WhatsApp.
//
// Web renders bold/italic/strikethrough/underline with real HTML tags
// (<strong>/<em>/<s>/<u>) and the hashtag link inline via
// react-router-dom's <Link>, which needs no hook to navigate. RN has
// none of those tags — every case becomes a nested <Text> with the
// matching style prop (fontWeight/fontStyle/textDecorationLine) — and
// <Link> has no RN equivalent, so the hashtag case is a tiny local
// <HashtagLink> component (this file's own) that calls expo-router's
// useRouter() itself, mirroring how MentionLink.tsx already handles
// the @mention case the same way.
import { Fragment, type ReactNode } from "react";
import { Text } from "react-native";
import { useRouter } from "expo-router";
import { MentionLink } from "../components/MentionLink";
import { useTheme } from "./theme";

const TOKEN_PATTERN =
  /(#[a-zA-Z0-9_]+|@[a-zA-Z0-9_]+|\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~|\[u\][^[\]]*\[\/u\])/g;

// /hashtag/[tag] isn't ported yet — pushes to the same route web uses.
function HashtagLink({ tag, children }: { tag: string; children: ReactNode }) {
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <Text onPress={() => router.push(`/hashtag/${tag}` as any)} style={{ color: colors.accent }}>
      {children}
    </Text>
  );
}

export function renderFormattedText(text: string, keyPrefix = "f"): ReactNode[] {
  const parts = text.split(TOKEN_PATTERN);

  return parts.map((part, i) => {
    const key = `${keyPrefix}-${i}`;
    if (!part) return null;

    if (/^#[a-zA-Z0-9_]+$/.test(part)) {
      const tag = part.slice(1).toLowerCase();
      return (
        <HashtagLink key={key} tag={tag}>
          {part}
        </HashtagLink>
      );
    }

    if (/^@[a-zA-Z0-9_]+$/.test(part)) {
      const username = part.slice(1);
      // Could be a personal profile or an organization/brand page —
      // MentionLink resolves which and routes accordingly (see
      // useAccountKind); this parser has no account-type context of
      // its own, just the raw @handle text.
      return (
        <MentionLink key={key} username={username}>
          {part}
        </MentionLink>
      );
    }

    if (part.length > 2 && part.startsWith("*") && part.endsWith("*")) {
      return (
        <Text key={key} style={{ fontWeight: "700" }}>
          {part.slice(1, -1)}
        </Text>
      );
    }

    if (part.length > 2 && part.startsWith("_") && part.endsWith("_")) {
      return (
        <Text key={key} style={{ fontStyle: "italic" }}>
          {part.slice(1, -1)}
        </Text>
      );
    }

    if (part.length > 2 && part.startsWith("~") && part.endsWith("~")) {
      return (
        <Text key={key} style={{ textDecorationLine: "line-through" }}>
          {part.slice(1, -1)}
        </Text>
      );
    }

    if (part.startsWith("[u]") && part.endsWith("[/u]")) {
      return (
        <Text key={key} style={{ textDecorationLine: "underline" }}>
          {part.slice(3, -4)}
        </Text>
      );
    }

    return <Fragment key={key}>{part}</Fragment>;
  });
}
