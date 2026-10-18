import { isMusicUrl } from "./audio-settings";

export type MusicLicenseEntry = {
  id: string;
  title: string;
  performer: string;
  productionUrl: string;
  sourceUrl: string;
  cc0EvidenceUrl: string;
  checkedAt: string;
  compositionStatus: string;
  performanceStatus: string;
  recordingStatus: string;
  archiveUrl: string;
};

// A source receipt alone never establishes import. The public settings row is the
// same allow-list used by profileAudio; candidates and retired URLs stay absent.
export function musicLicenseView(urls: string[], entries: readonly MusicLicenseEntry[]) {
  const current = new Set(urls.filter(isMusicUrl));
  const seen = new Set<string>();
  const tracks = entries.filter((entry) => {
    if (!current.has(entry.productionUrl) || seen.has(entry.productionUrl)) return false;
    seen.add(entry.productionUrl);
    return true;
  });
  return { tracks, unregistered: current.size - tracks.length, total: current.size };
}
