export const MIN_PASSWORD_LENGTH = 8;
export const MIN_USERNAME_LENGTH = 3;

export function normalizeUsername(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9_]/g, "");
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function friendlyAuthError(error: unknown, fallback = "Something went wrong. Please try again.") {
  const message = error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String(error.message) : "";
  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials")) return "Incorrect email or password.";
  if (lower.includes("email not confirmed")) return "Confirm your email before signing in.";
  if (lower.includes("already registered") || lower.includes("already exists") || lower.includes("already in use")) return "An account with this email already exists. Try signing in instead.";
  if (lower.includes("rate limit") || lower.includes("too many")) return "Too many attempts. Wait a moment and try again.";
  if (lower.includes("network") || lower.includes("fetch") || lower.includes("timeout")) return "Check your connection and try again.";
  if (lower.includes("expired") || lower.includes("invalid token")) return "This link has expired or has already been used.";
  if (lower.includes("username") && (lower.includes("duplicate") || lower.includes("unique"))) return "That username is already taken.";
  return fallback;
}
