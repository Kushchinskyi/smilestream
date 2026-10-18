// Offline admission only. Does not fetch, upload, execute SQL or alter the live catalog.
import { readFileSync } from "node:fs";
const retiredHashes = new Set(
  JSON.parse(
    readFileSync(new URL("../content/music-retired-recordings.json", import.meta.url), "utf8"),
  ).recordings.map((track) => track.sha256),
);
export function premiumRejectionReasons(track) {
  const reasons = [];
  // Clinic policy 2026-10-18: human listening is informative, not an import gate.
  // Metadata suitability must still be documented; no fabricated listening score.
  if (track.styleAudit?.status !== "metadata_fit" || !track.styleAudit.evidence?.length)
    reasons.push("documented genre/arrangement metadata fit required");
  if (track.legacyRejectedByClinic || retiredHashes.has(track.technical?.sha256))
    reasons.push("previous selection rejected by clinic");
  const rights = track.replacementRights;
  if (
    rights?.status !== "cleared" ||
    rights.composition !== true ||
    rights.recording !== true ||
    rights.commercialClinicUkraine !== true ||
    rights.publicMp3Hosting !== true ||
    !rights.evidence?.length ||
    !rights.checkedAt
  )
    reasons.push("clinic/public-hosting rights require evidence");
  const tech = track.technical;
  if (
    !/^[a-f0-9]{64}$/.test(tech?.sha256 ?? "") ||
    tech?.decoded !== true ||
    tech?.codec?.codec_name !== "mp3" ||
    ![1, 2].includes(tech?.codec?.channels) ||
    !Number.isFinite(tech?.durationSeconds) ||
    tech.durationSeconds < 120 ||
    !Number.isFinite(tech?.integratedLufs) ||
    !Number.isFinite(tech?.truePeakDbfs) ||
    tech?.browserPlaybackConfirmed !== true
  )
    reasons.push("technical audit incomplete");
  try {
    const url = new URL(track.url);
    if (url.protocol !== "https:" || url.username || url.password) throw Error();
  } catch {
    reasons.push("valid HTTPS file URL required");
  }
  return reasons;
}

export function assertPremiumBatch(tracks) {
  if (!tracks.length) throw Error("No approved replacement: run without background music");
  const seen = new Set();
  for (const track of tracks) {
    const reasons = premiumRejectionReasons(track);
    if (reasons.length) throw Error(`${track.id}: ${reasons.join("; ")}`);
    if (seen.has(track.technical.sha256)) throw Error("Duplicate recording");
    seen.add(track.technical.sha256);
  }
}
