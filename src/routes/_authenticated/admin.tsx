import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { formatDuration, type Video } from "@/lib/backend";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Плейлист — Dental Media Network" },
      { name: "description", content: "Керування роликами та порядком відтворення." },
      { property: "og:title", content: "Плейлист — Dental Media Network" },
      { property: "og:description", content: "Керування роликами." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

type Draft = { title: string; url: string; duration_seconds: number; sort_order: number; is_active: boolean };
const empty: Draft = { title: "", url: "", duration_seconds: 0, sort_order: 0, is_active: true };

function AdminPage() {
  const admin = useIsAdmin();
  const [videos, setVideos] = useState<Video[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(empty);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from("videos").select("*").order("sort_order");
    if (error) toast.error(error.message);
    else setVideos(data);
  }, []);

  useEffect(() => {
    if (admin === "yes") load();
  }, [admin, load]);

  function startNew() {
    setEditing("new");
    setDraft({ ...empty, sort_order: (videos[videos.length - 1]?.sort_order ?? 0) + 1 });
  }

  async function save() {
    if (!draft.title.trim() || !/^https?:\/\//.test(draft.url)) {
      toast.error("Вкажіть назву та коректний URL (http/https)");
      return;
    }
    const payload = { ...draft, title: draft.title.trim(), url: draft.url.trim() };
    const { error } =
      editing === "new"
        ? await supabase.from("videos").insert(payload)
        : await supabase.from("videos").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", editing!);
    if (error) { toast.error(error.message); return; }
    toast.success("Збережено");
    setEditing(null);
    load();
  }

  async function remove(v: Video) {
    if (!confirm(`Видалити «${v.title}»?`)) return;
    const { error } = await supabase.from("videos").delete().eq("id", v.id);
    if (error) { toast.error(error.message); return; }
    load();
  }

  async function toggle(v: Video) {
    const { error } = await supabase.from("videos").update({ is_active: !v.is_active }).eq("id", v.id);
    if (error) { toast.error(error.message); return; }
    load();
  }

  async function move(i: number, dir: -1 | 1) {
    const a = videos[i], b = videos[i + dir];
    if (!a || !b) return;
    // Equal sort_order values would make a swap a no-op; fall back to neighbour ±1.
    const aNew = a.sort_order === b.sort_order ? b.sort_order + dir : b.sort_order;
    const bNew = a.sort_order;
    const r1 = await supabase.from("videos").update({ sort_order: aNew }).eq("id", a.id);
    if (r1.error) { toast.error(r1.error.message); load(); return; }
    const r2 = await supabase.from("videos").update({ sort_order: bNew }).eq("id", b.id);
    if (r2.error) {
      // Roll back the first update so order stays consistent.
      await supabase.from("videos").update({ sort_order: a.sort_order }).eq("id", a.id);
      toast.error(r2.error.message);
    }
    load();
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">Плейлист</h1>
            <p className="mt-2 text-sm text-muted-foreground">Активні ролики відтворюються на /tv по порядку, по колу.</p>
          </div>
          {admin === "yes" && <Button variant="teal" onClick={startNew}>Додати ролик</Button>}
        </div>

        {admin === "loading" && <p className="mt-8 text-sm text-muted-foreground">Перевірка прав…</p>}
        {admin === "no" && (
          <p className="mt-8 rounded-lg bg-warning p-4 text-sm text-warning-foreground">
            Ваш обліковий запис не має прав адміністратора. Зміни недоступні.
          </p>
        )}

        {admin === "yes" && editing && (
          <div className="mt-8 grid gap-4 rounded-xl border bg-card p-6 md:grid-cols-6">
            <label className="space-y-1 text-sm md:col-span-3">Назва
              <Input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
            </label>
            <label className="space-y-1 text-sm md:col-span-3">URL MP4
              <Input value={draft.url} placeholder="https://…/video.mp4" onChange={(e) => setDraft({ ...draft, url: e.target.value })} />
            </label>
            <label className="space-y-1 text-sm md:col-span-2">Тривалість, сек
              <Input type="number" min={0} value={draft.duration_seconds} onChange={(e) => setDraft({ ...draft, duration_seconds: Number(e.target.value) || 0 })} />
            </label>
            <label className="space-y-1 text-sm md:col-span-2">Порядок
              <Input type="number" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) || 0 })} />
            </label>
            <label className="flex items-center gap-3 pt-6 text-sm md:col-span-2">
              <Switch checked={draft.is_active} onCheckedChange={(c) => setDraft({ ...draft, is_active: c })} /> Активний
            </label>
            <div className="flex gap-2 md:col-span-6">
              <Button onClick={save}>Зберегти</Button>
              <Button variant="outline" onClick={() => setEditing(null)}>Скасувати</Button>
            </div>
          </div>
        )}

        {admin === "yes" && (
          <div className="mt-8 overflow-hidden rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-left text-muted-foreground">
                <tr><th className="p-4">#</th><th className="p-4">Назва</th><th className="p-4">Тривалість</th><th className="p-4">Активний</th><th className="p-4 text-right">Дії</th></tr>
              </thead>
              <tbody>
                {videos.map((v, i) => (
                  <tr key={v.id} className="border-t align-top">
                    <td className="p-4 text-muted-foreground">{v.sort_order}</td>
                    <td className="p-4">
                      <div className="font-medium">{v.title}</div>
                      {v.is_test && <span className="mt-1 inline-block rounded bg-warning px-2 py-0.5 text-xs text-warning-foreground">тестове відео</span>}
                      <div className="mt-1 max-w-md truncate text-xs text-muted-foreground">{v.url}</div>
                    </td>
                    <td className="p-4">{formatDuration(v.duration_seconds)}</td>
                    <td className="p-4"><Switch checked={v.is_active} onCheckedChange={() => toggle(v)} /></td>
                    <td className="p-4">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" disabled={i === 0} onClick={() => move(i, -1)}>↑</Button>
                        <Button size="sm" variant="ghost" disabled={i === videos.length - 1} onClick={() => move(i, 1)}>↓</Button>
                        <Button size="sm" variant="outline" onClick={() => { setEditing(v.id); setDraft({ title: v.title, url: v.url, duration_seconds: v.duration_seconds, sort_order: v.sort_order, is_active: v.is_active }); }}>Змінити</Button>
                        <Button size="sm" variant="destructive" onClick={() => remove(v)}>Видалити</Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {videos.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">Плейлист порожній</td></tr>}
              </tbody>
            </table>
          </div>
        )}

        <section className="mt-12 rounded-xl border bg-card p-6 text-sm">
          <h2 className="text-base font-semibold">Перевірити на фізичних телевізорах (Samsung Tizen 2022)</h2>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Чи стартує відео автоматично без звуку, чи потрібне натискання «Запустити»</li>
            <li>Чи працює повний екран з пульта (кнопка OK на «Повний екран»)</li>
            <li>Перехід до наступного ролика й повтор плейлиста після останнього</li>
            <li>Поведінка при недоступному URL (має пропустити ролик)</li>
            <li>Стабільність 8+ годин: пам’ять, перегрів, вимкнення екрана через енергозбереження</li>
            <li>Відновлення після втрати Wi‑Fi та після перезавантаження ТВ</li>
            <li>Якість H.264 1080p на 43″ і 65″, відсутність підвисань</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
