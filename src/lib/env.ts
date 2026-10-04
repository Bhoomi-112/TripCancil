function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`,
    );
  }
  return value;
}

export const env = {
  get supabaseUrl(): string {
    return required("SUPABASE_URL");
  },
  get supabaseServiceRoleKey(): string {
    return required("SUPABASE_SERVICE_ROLE_KEY");
  },
  get sessionSecret(): string {
    return required("SESSION_SECRET");
  },
  get appUrl(): string {
    // Typed into a dashboard by hand, so "trip-cancil.vercel.app" is as likely as
    // the full URL. Invite links and QR codes need the scheme to resolve.
    const raw = required("NEXT_PUBLIC_APP_URL").trim().replace(/\/+$/, "");
    return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  },
};
