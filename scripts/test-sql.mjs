import { readFile } from "node:fs/promises";
import postgres from "postgres";
import { testTarget } from "./test-target.mjs";
const args = process.argv.slice(2);
if (args.some((a) => !["--staging", "--prepare-empty-local"].includes(a)))
  throw new Error("Unsupported SQL test flag");
if (process.env.SMILE_SQL_TEST_CONFIRM !== "isolated-test")
  throw new Error(
    "Set SMILE_SQL_TEST_CONFIRM=isolated-test after verifying the database is disposable/test-only",
  );
const { local, url } = testTarget(process.env.SMILE_TEST_DATABASE_URL, {
  staging: args.includes("--staging"),
});
if (!["postgres:", "postgresql:"].includes(url.protocol))
  throw new Error("A test Postgres URL is required");
if (args.includes("--prepare-empty-local") && !local)
  throw new Error("Automatic schema preparation is restricted to an empty LOCAL database");
const sql = postgres(url.href, { max: 1, connect_timeout: 5, idle_timeout: 5 });
try {
  if (args.includes("--prepare-empty-local")) {
    const [existing] =
      await sql`select to_regclass('public.videos') is not null or to_regclass('public.user_roles') is not null or to_regclass('public.playback_settings') is not null as present`;
    if (existing.present) throw new Error("Preparation requires an empty application schema");
    // Preserve the exact original Drizzle DDL/auth/RLS; omit all original screen/video seeds.
    const baseline = await readFile(
      new URL("../drizzle/migrations/0000_migration.sql", import.meta.url),
      "utf8",
    );
    const end = baseline.indexOf("insert into public.screens");
    if (end < 0) throw new Error("Baseline seed boundary changed; review the bootstrap");
    await sql.unsafe(baseline.slice(0, end)).simple();
    await sql
      .unsafe(
        await readFile(
          new URL(
            "../supabase/migrations/20261016174139_centralized_playback_settings.sql",
            import.meta.url,
          ),
          "utf8",
        ),
      )
      .simple();
  }
  await sql`select set_config('smile.isolated_sql_test', 'on', false)`;
  await sql
    .unsafe(
      await readFile(new URL("../supabase/tests/playback_settings.sql", import.meta.url), "utf8"),
    )
    .simple();
  console.log("PASS: playback_settings SQL integration assertions (fixtures rolled back).");
} catch (error) {
  // Do not log connection strings, passwords or inherited environment.
  try {
    await sql.unsafe("rollback").simple();
  } catch {
    /* connection may not exist */
  }
  let reason = String(error.message || error.code || "unknown failure");
  for (const secret of [url.href, url.password, decodeURIComponent(url.password)]) {
    if (secret) reason = reason.split(secret).join("[redacted]");
  }
  console.error("SQL integration check failed:", error.code || error.name, reason);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 3 });
}
