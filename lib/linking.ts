import * as Linking from "expo-linking";

export const authCallbackUrl = Linking.createURL("auth/callback");

export function parseIncomingUrl(url: string) {
  return Linking.parse(url);
}
