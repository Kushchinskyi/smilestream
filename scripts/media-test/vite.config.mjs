import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import { assertMediaTestBuild } from "./guard.mjs";
export default defineConfig(({ mode }) => {
  assertMediaTestBuild(process.env, mode);
  return {
    root: fileURLToPath(new URL("./", import.meta.url)),
    envDir: false,
    envPrefix: "SMILE_NEVER_EXPOSE_ENV_",
    publicDir: false,
    appType: "spa",
    build: {
      outDir: fileURLToPath(new URL("../../.media-test-output", import.meta.url)),
      emptyOutDir: true,
      target: "chrome85",
      cssTarget: "chrome85",
    },
  };
});
