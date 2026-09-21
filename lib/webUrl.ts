// File: lib/webUrl.ts
//
// Web builds every shareable link from `window.location.origin`; native has no
// such origin. Set EXPO_PUBLIC_WEB_URL (e.g. https://your-domain.com, no
// trailing slash) so shared links point at the real web app. If it isn't set,
// links fall back to the app's own `ako://` deep link — which only works for
// people who already have the app, so set the env var before shipping.
const WEB_ORIGIN = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/+$/, "") ?? "";

/** Absolute URL for a path like `/post/abc`. */
export function webUrl(path: string): string {
  return WEB_ORIGIN ? `${WEB_ORIGIN}${path}` : `ako:/${path}`;
}

export function getPostShareUrl(postId: string): string {
  return webUrl(`/post/${postId}`);
}
