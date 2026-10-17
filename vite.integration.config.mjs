import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { fileURLToPath } from "node:url";
import { integrationBackend, INTEGRATION_PROJECT } from "./scripts/integration-target.mjs";
import { mediaTestEnvironment } from "./scripts/media-test/guard.mjs";

export default async (env) => {
  if (
    env.mode !== "integration-test" ||
    process.env.SMILE_INTEGRATION_PROJECT !== INTEGRATION_PROJECT
  )
    throw new Error("Use scripts/start-integration-test.mjs for the approved isolated project");
  mediaTestEnvironment(process.env, []); // Refuse CI/Lovable/hosting.
  const backend = integrationBackend({
    projectRef: process.env.SMILE_INTEGRATION_PROJECT,
    url: process.env.VITE_SUPABASE_URL,
    publishableKey: process.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  });
  return defineConfig({
    envDefine: false,
    vite: {
      envDir: false,
      envPrefix: "SMILE_NEVER_EXPOSE_ENV_",
      resolve: {
        alias: [
          {
            find: /^(\.\/ad-clock|@\/lib\/ad-clock)$/,
            replacement: fileURLToPath(
              new URL("./scripts/integration-ad-clock.ts", import.meta.url),
            ),
          },
        ],
      },
      build: { target: "chrome85", cssTarget: "chrome85" },
      define: {
        "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(backend.endpoint),
        "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(backend.key),
      },
    },
    nitro: {
      preset: "node-server",
      output: {
        dir: ".integration-test-output",
        publicDir: ".integration-test-output/public",
        serverDir: ".integration-test-output/server",
      },
    },
    tanstackStart: { server: { entry: "server" } },
  })(env);
};
