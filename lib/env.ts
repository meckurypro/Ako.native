type PublicEnv = {
  supabaseUrl: string;
  supabaseAnonKey: string;
};

function requirePublicEnv(name: string, value: string | undefined): string {
  if (!value?.trim()) throw new Error(`Missing ${name}. Copy .env.example to .env and provide the public value.`);
  return value.trim();
}

export const env: PublicEnv = {
  supabaseUrl: requirePublicEnv("EXPO_PUBLIC_SUPABASE_URL", process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: requirePublicEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY", process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
};
