export function mediaTestEnvironment(source, args) {
  if (args.includes("--staging")) throw new Error("media-test cannot use staging");
  if (
    Object.keys(source).some(
      (key) => /^(CI$|LOVABLE|VERCEL|NETLIFY|CF_PAGES)/i.test(key) && source[key],
    )
  )
    throw new Error("media-test is local preview only; CI/hosting is refused");
  const env = Object.fromEntries(
    Object.entries(source).filter(
      ([key]) => !/^(VITE_|SUPABASE|SMILE_|NITRO_|PORT$|HOST$)/i.test(key),
    ),
  );
  return { ...env, SMILE_MEDIA_TEST_LAUNCH: "local-preview-only", NITRO_PRESET: "node-server" };
}
export function assertMediaTestBuild(env, mode) {
  if (mode !== "media-test" || env.SMILE_MEDIA_TEST_LAUNCH !== "local-preview-only")
    throw new Error("Use the local launcher --media-test; normal builds cannot enable this config");
  mediaTestEnvironment(env, []);
}
