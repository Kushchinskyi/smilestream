// Offline admission only. Does not fetch, upload, execute SQL or alter the live catalog.
export function premiumRejectionReasons(track) {
  const reasons = [];
  const review = track.listening;
  if (
    review?.status !== "confirmed" ||
    ![4, 5].includes(review.premiumFit) ||
    !review.reviewer?.trim() ||
    !review.reviewedAt ||
    review.recordingSha256 !== track.technical?.sha256 ||
    !review.notes?.trim()
  )
    reasons.push(
      "потребує прослуховування: confirmed Premium Fit 4–5 for these exact bytes required",
    );
  if (track.legacyRejectedByClinic) reasons.push("previous selection rejected by clinic");
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
  if (!tracks.length) throw Error("No approved replacement: keep current catalog");
  const seen = new Set();
  for (const track of tracks) {
    const reasons = premiumRejectionReasons(track);
    if (reasons.length) throw Error(`${track.id}: ${reasons.join("; ")}`);
    if (seen.has(track.technical.sha256)) throw Error("Duplicate recording");
    seen.add(track.technical.sha256);
  }
}
