import { testBackend } from "./test-target.mjs";
export const INTEGRATION_PROJECT = "dhvfrnlxskqjnefndztu";
export function integrationBackend(config) {
  if (
    config.projectRef !== INTEGRATION_PROJECT ||
    config.url !== `https://${INTEGRATION_PROJECT}.supabase.co`
  )
    throw new Error("Only the explicitly approved isolated integration project is allowed");
  return testBackend(
    {
      SMILE_TEST_SUPABASE_URL: config.url,
      SMILE_TEST_SUPABASE_PUBLISHABLE_KEY: config.publishableKey,
    },
    true,
  );
}
