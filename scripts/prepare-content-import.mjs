import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { preparePlan } from "./content-import-plan.mjs";
const [catalogPath, existingPath, outputPath, ...extra] = process.argv.slice(2);
if (
  !catalogPath ||
  !existingPath ||
  !outputPath ||
  extra.length ||
  !outputPath.endsWith(".local.json")
)
  throw new Error(
    "Usage: node scripts/prepare-content-import.mjs catalog.json existing-export.json output.local.json",
  );
if ([catalogPath, existingPath].some((p) => resolve(p) === resolve(outputPath)))
  throw new Error("Output must differ from inputs");
async function json(path) {
  const value = await readFile(path, "utf8");
  if (Buffer.byteLength(value) > 2 * 1024 * 1024) throw new Error("Input exceeds 2 MiB");
  return JSON.parse(value.replace(/^\uFEFF/, ""));
}
const catalog = await json(catalogPath),
  snapshot = await json(existingPath);
const result = preparePlan(catalog, Array.isArray(snapshot) ? snapshot : snapshot.videos);
// Exclusive creation: no overwrite, no API client, no credential access, no SQL execution.
await writeFile(outputPath, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
console.log(
  `Offline plan: ${result.additions.length} disabled additions, ${result.held.length} held. No database writes.`,
);
