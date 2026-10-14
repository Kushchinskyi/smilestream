import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { useIsAdmin } from "@/hooks/use-is-admin";

export const Route = createFileRoute("/_authenticated/screens")({
  head: () => ({
    meta: [
      { title: "Екрани — Dental Media Network" },
      { name: "description", content: "Список телевізорів у клініці." },
      { property: "og:title", content: "Екрани — Dental Media Network" },
      { property: "og:description", content: "Список телевізорів у клініці." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ScreensPage,
});

type Screen = { id: string; name: string; diagonal_inches: number | null; last_heartbeat_at: string | null };

function ScreensPage() {
  const admin = useIsAdmin();
  const [rows, setRows] = useState<Screen[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (admin !== "yes") return;
    supabase
      .from("screens")
      .select("id,name,diagonal_inches,last_heartbeat_at")
      .order("created_at")
      .then(({ data, error }) => (error ? setErr(error.message) : setRows(data)));
  }, [admin]);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-12">
        <h1 className="text-3xl font-semibold">Екрани</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Підключення за кодом і heartbeat ще не реалізовані — статус показується як «дані відсутні».
        </p>
        {admin === "no" && <p className="mt-8 text-sm">Немає прав адміністратора.</p>}
        {err && <p className="mt-8 text-sm text-destructive">{err}</p>}
        {rows && (
          <div className="mt-8 overflow-hidden rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-left text-muted-foreground">
                <tr><th className="p-4">Назва</th><th className="p-4">Діагональ</th><th className="p-4">Статус</th><th className="p-4">Останній сигнал</th></tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="p-4 font-medium">{s.name}</td>
                    <td className="p-4">{s.diagonal_inches ? `${s.diagonal_inches}″` : "—"}</td>
                    <td className="p-4"><span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">дані відсутні</span></td>
                    <td className="p-4 text-muted-foreground">
                      {s.last_heartbeat_at ? new Date(s.last_heartbeat_at).toLocaleString("uk-UA") : "дані відсутні"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
