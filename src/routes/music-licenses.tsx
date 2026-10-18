import { createFileRoute } from "@tanstack/react-router";
import { MusicLicensesPage } from "@/components/MusicLicensesPage";

export const Route = createFileRoute("/music-licenses")({
  component: MusicLicensesPage,
  head: () => ({
    meta: [
      { title: "Ліцензування музики — Smile Stream" },
      {
        name: "description",
        content:
          "Походження музики Smile Stream, підтвердження CC0 та відомості про права на фонограми.",
      },
    ],
  }),
});
