import { useState } from "react";
import { Film } from "lucide-react";
import { isMusicUrl } from "@/lib/audio-settings";
export function MediaCover({ url }: { url?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <>
      <Film size={26} />
      {url && isMusicUrl(url) && !failed && (
        <img
          className="media-cover"
          alt=""
          src={url}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      )}
    </>
  );
}
