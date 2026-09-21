// File: lib/web-url.ts
// Base URL of the web app, for links that hand off to it (share links, and screens that don't exist natively yet). Override with EXPO_PUBLIC_WEB_URL.
const DEFAULT_WEB_URL = "https://ako.app";
export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL?.trim() || DEFAULT_WEB_URL).replace(/\/+$/, "");
export const webUrl = (path: string) => `${WEB_URL}${path.startsWith("/") ? path : `/${path}`}`;
