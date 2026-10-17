// Offline review only: deliberately has no database, network or environment access.
const categories = new Set([
  "digital",
  "cadcam",
  "printing",
  "implants",
  "prosthetics",
  "orthodontics",
  "hygiene",
  "sterilization",
  "other",
]);
function https(value) {
  if (typeof value !== "string" || value.length > 2048 || /[\s\\\x00-\x1f]/.test(value))
    throw new Error("Invalid HTTPS URL");
  const u = new URL(value);
  if (u.protocol !== "https:" || u.username || u.password || u.search || u.hash)
    throw new Error("Credentials, signed/query URLs and fragments are not accepted");
  return u.href;
}
export function identity(value) {
  const u = new URL(https(value));
  const id =
    u.hostname === "videos.pexels.com" ? u.pathname.match(/^\/video-files\/(\d+)\//)?.[1] : null;
  const mixkit =
    u.hostname === "assets.mixkit.co" ? u.pathname.match(/^\/videos\/(\d+)\//)?.[1] : null;
  return id ? `pexels:${id}` : mixkit ? `mixkit:${mixkit}` : u.href;
}
export function preparePlan(catalog, existing) {
  if (
    !Array.isArray(catalog) ||
    catalog.length > 500 ||
    !Array.isArray(existing) ||
    existing.length > 10000
  )
    throw new Error("Invalid input or capacity exceeded");
  // Never silently ignore a malformed existing row: doing so could permit duplicates.
  const seen = new Set(existing.map((v) => identity(v.url)));
  const highest = existing.reduce((n, v) => {
    if (!Number.isSafeInteger(v.sort_order) || Math.abs(v.sort_order) > 1000000)
      throw new Error("Invalid existing order");
    return Math.max(n, v.sort_order);
  }, 0);
  const additions = [],
    held = [];
  for (const row of catalog) {
    const reasons = [];
    let key;
    try {
      key = identity(row.url);
      https(row.sourceUrl);
      https(row.licenseUrl);
      if (typeof row.title !== "string" || !row.title.trim() || row.title.trim().length > 200)
        throw new Error("Invalid title");
      if (!categories.has(row.category)) throw new Error("Invalid category");
      if (
        !Number.isFinite(row.durationSeconds) ||
        row.durationSeconds <= 0 ||
        row.durationSeconds > 86400
      )
        throw new Error("Invalid duration");
      if (row.originalSound !== false && row.originalSound !== true)
        throw new Error("Explicit originalSound required");
      if (seen.has(key)) reasons.push("duplicate");
      seen.add(key);
      if (row.commercialLicenseConfirmed !== true) reasons.push("license review");
      if (row.technicalStatus !== "hd-h264-aac-or-silent")
        reasons.push("codec/normalization review");
      if (row.visualReviewApproved !== true) reasons.push("visual review");
      if (row.hostingApproved !== true) reasons.push("stable hosting review");
      if (row.originalSound === true) reasons.push("original audio review");
    } catch (e) {
      reasons.push(e.message);
    }
    if (reasons.length) {
      held.push({ title: typeof row?.title === "string" ? row.title : "", reasons });
      continue;
    }
    const order = highest + additions.length + 1;
    if (order > 1000000) throw new Error("Order capacity exceeded");
    additions.push({
      title: row.title.trim(),
      url: https(row.url),
      duration_seconds: Math.ceil(row.durationSeconds),
      sort_order: order,
      is_active: false,
      is_test: false,
      originalSound: false,
      category: row.category,
      sourceUrl: https(row.sourceUrl),
      licenseUrl: https(row.licenseUrl),
    });
  }
  return {
    format: "smile-append-review-v1",
    executable: false,
    existingCount: existing.length,
    additions,
    held,
  };
}
