// File: app/auth/callback.tsx
// Deliberately NOT inside app/(auth)/ — that folder's parens make it a
// route *group* (no path segment), so a file there maps to /login,
// /signup, etc. This route needs the literal path "/auth/callback" to
// match Linking.createURL("/auth/callback") (used by SignUpScreen and
// ResetPasswordScreen), so it lives at the real app/auth/ path instead.
//
// Expo Router convention otherwise unchanged: this file is just the
// route; the actual UI lives in screens/AuthCallbackScreen.tsx.
export { AuthCallbackScreen as default } from "../../screens/AuthCallbackScreen";
