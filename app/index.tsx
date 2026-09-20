// File: app/index.tsx
// Root route ("/"). For now this always sends to /login — once more
// screens exist, this should check auth state and redirect to /feed
// (or wherever) if already logged in, matching what LoginScreen.tsx
// already does for the reverse case.
import { Redirect } from "expo-router";

export default function Index() {
  return <Redirect href="/login" />;
}
