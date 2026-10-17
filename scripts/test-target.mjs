// These launchers never fall back to DATABASE_URL or the app's existing .env.
export function testTarget(value, { staging = false } = {}) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Provide an explicit test endpoint");
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  // Also reject the production reference in Supabase pooled connection usernames.
  if ((url.hostname + decodeURIComponent(url.username)).includes("ieytvixchndxnxsxpcot"))
    throw new Error("Production project is forbidden");
  if (!local && !staging) throw new Error("Remote endpoint requires explicit --staging");
  if (
    !local &&
    url.protocol !== "https:" &&
    url.protocol !== "postgres:" &&
    url.protocol !== "postgresql:"
  )
    throw new Error("Invalid staging endpoint protocol");
  return { url, local };
}
export function testBackend(env, staging = false) {
  const endpoint = env.SMILE_TEST_SUPABASE_URL || "";
  const key = env.SMILE_TEST_SUPABASE_PUBLISHABLE_KEY || "";
  if (!endpoint && !key) return { endpoint: "", key: "" };
  if (!endpoint || !key)
    throw new Error("Provide both SMILE_TEST_SUPABASE_URL and SMILE_TEST_SUPABASE_PUBLISHABLE_KEY");
  const { url } = testTarget(endpoint, { staging });
  if (!["https:", "http:"].includes(url.protocol) || url.username || url.password)
    throw new Error("Invalid test API endpoint");
  if (/sb_secret_|service_role/.test(key))
    throw new Error("Only a publishable/anon key may be used in the browser");
  // Legacy anon JWTs are public; a legacy service_role JWT must never reach Vite.
  if (key.split(".").length === 3) {
    try {
      if (JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString()).role !== "anon")
        throw new Error();
    } catch {
      throw new Error("Legacy browser key must have anon role");
    }
  } else if (!key.startsWith("sb_publishable_"))
    throw new Error("Expected publishable or legacy anon key");
  return { endpoint: url.href.replace(/\/$/, ""), key };
}
