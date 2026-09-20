// File: lib/bottomNavRoutes.ts
//
// On web every page renders <BottomNav /> itself, so which screens show it
// is decided page by page. On native the bar lives once at the root layout
// (so it doesn't remount/animate on every navigation) and this list is
// what decides visibility. It mirrors the web pages that import BottomNav:
// Feed, Discover, LibraryActivity, ConversationList, Archive, PageInbox,
// PageMessageThread, ProfilePage, PagePage, PostDetail, ProjectDetail,
// Wallet, Notifications, FollowRequests, Search, HashtagFeed, Activity,
// SavedHub, LikedHub, HistoryActivity, EventsActivity, MyGigs.
//
// Deliberately NOT here (web hides the nav on these): message threads,
// compose/create/edit screens, followers/following lists, page team/edit,
// wallet fund/withdraw/callback, auth, onboarding, admin.
//
// "/inbox" and "/me" are native-only entries: web redirects them to the
// real destination, native has placeholders until those screens exist.
const EXACT = new Set([
  "/feed",
  "/topics",
  "/library",
  "/inbox",
  "/me",
  "/messages",
  "/messages/archive",
  "/page-inbox",
  "/wallet",
  "/notifications",
  "/requests",
  "/search",
  "/activity",
  "/activity/saved",
  "/activity/liked",
  "/activity/history",
  "/activity/events",
  "/gigs",
]);

const PATTERNS = [
  /^\/page-inbox\/[^/]+$/, // PageMessageThread
  /^\/profile\/[^/]+$/, // ProfilePage (not /followers, /following)
  /^\/page\/[^/]+$/, // PagePage (not /team, /edit)
  /^\/post\/[^/]+$/, // PostDetail (not /edit)
  /^\/projects\/(?!new$)[^/]+$/, // ProjectDetail (not /new, /edit, /ticket, ...)
  /^\/hashtag\/[^/]+$/, // HashtagFeed
];

export function shouldShowBottomNav(pathname: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return EXACT.has(path) || PATTERNS.some((p) => p.test(path));
}
