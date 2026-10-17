import { useEffect, useState } from "react";
import { Download, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { Video } from "@/lib/backend";
import { readPages } from "@/lib/admin-api";
import { downloadJson, validateVideo } from "@/lib/admin-library";
import { VideoLibrary } from "./VideoLibrary";
import { VideoEditor } from "./VideoEditor";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";
import { useUnsaved } from "@/hooks/use-unsaved";
type Advertisement = Database["public"]["Tables"]["advertisements"]["Row"];
export function AdvertisementLibrary() {
  const [rows, setRows] = useState<Advertisement[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState<Video | null | undefined>(),
    [preview, setPreview] = useState<Video | null>(null);
  useUnsaved(editing !== undefined);
  async function load() {
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 12000);
    setLoading(true);
    setError("");
    try {
      setRows(
        await readPages<Advertisement>((from, to) =>
          supabase
            .from("advertisements")
            .select("*")
            .order("sort_order")
            .order("id")
            .range(from, to)
            .abortSignal(controller.signal),
        ),
      );
    } catch {
      setError(
        "Рекламна бібліотека недоступна. Перевірте мережу, права та міграцію advertisements.",
      );
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  const videos: Video[] = rows.map((row) => ({ ...row, is_test: false }));
  async function update(ids: string[], value: { is_active?: boolean; original_sound?: boolean }) {
    setBusy(true);
    const r = await supabase.from("advertisements").update(value).in("id", ids);
    setBusy(false);
    if (r.error) toast.error("Рекламу не змінено. Перевірте права й мережу.");
    else
      setRows((previous) =>
        previous.map((row) => (ids.includes(row.id) ? { ...row, ...value } : row)),
      );
  }
  return (
    <>
      <div className="info-banner">
        <Megaphone size={22} />
        <span>
          <strong>Окрема рекламна бібліотека.</strong> Автоматичні рекламні блоки ще не підключені.
          Ці ролики не потрапляють до звичайного /tv; прапорці зберігають налаштування бібліотеки, а
          не запускають показ.
        </span>
      </div>
      {error ? (
        <div role="alert" className="error-banner">
          {error}
          <button className="button secondary" onClick={() => void load()}>
            Повторити
          </button>
        </div>
      ) : loading ? (
        <div className="panel skeleton" aria-label="Завантаження реклами" />
      ) : (
        <>
          <VideoLibrary
            advertisement
            videos={videos}
            metadata={[]}
            originalIds={rows.filter((row) => row.original_sound).map((row) => row.id)}
            busy={busy}
            onEdit={setEditing}
            onPreview={setPreview}
            onActive={(ids, value) => void update(ids, { is_active: value })}
            onOriginal={(ids, value) => void update(ids, { original_sound: value })}
            onReorder={async (ids) => {
              setBusy(true);
              const r = await supabase.rpc("reorder_advertisements", { ordered_ids: ids });
              setBusy(false);
              if (r.error) toast.error("Не вдалося змінити порядок. Перечитайте бібліотеку.");
              else
                setRows(
                  ids.map((id, i) => ({
                    ...rows.find((row) => row.id === id)!,
                    sort_order: i + 1,
                  })),
                );
            }}
          />
          <button
            className="button secondary"
            onClick={() =>
              downloadJson("smile-advertisements.json", {
                version: 1,
                advertisements: rows.map((row) => ({
                  id: row.id,
                  title: row.title,
                  url: row.url,
                  duration_seconds: row.duration_seconds,
                  sort_order: row.sort_order,
                  is_active: row.is_active,
                  original_sound: row.original_sound,
                })),
              })
            }
          >
            <Download size={17} />
            Експортувати рекламу
          </button>
          <p className="subtle-note">
            Результати показів — дані відсутні. Автоматична ротація й лічильники ще не збираються.
          </p>
        </>
      )}
      {editing !== undefined && (
        <VideoEditor
          showCategory={false}
          key={editing?.id || "new"}
          video={editing}
          category="other"
          original={rows.find((row) => row.id === editing?.id)?.original_sound || false}
          order={(rows[rows.length - 1]?.sort_order || 0) + 1}
          onClose={() => setEditing(undefined)}
          onSave={async (draft, _category, original) => {
            const clean = validateVideo(draft);
            if (
              rows.some((row) => row.id !== editing?.id && row.url === clean.url) &&
              !confirm("Таке посилання вже є в рекламі. Зберегти дублікат?")
            )
              return;
            const value = { ...clean, original_sound: original };
            const r = editing
              ? await supabase.from("advertisements").update(value).eq("id", editing.id)
              : await supabase.from("advertisements").insert(value);
            if (r.error) throw new Error("Не вдалося зберегти рекламу. Перевірте мережу й права.");
            setEditing(undefined);
            await load();
            toast.success("Рекламну бібліотеку оновлено");
          }}
          onDelete={async () => {
            if (!editing) return;
            const r = await supabase.from("advertisements").delete().eq("id", editing.id);
            if (r.error) throw new Error("Не вдалося видалити рекламу");
            setEditing(undefined);
            await load();
          }}
        />
      )}
      {preview && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setPreview(null);
          }}
        >
          <DialogContent className="admin-dialog">
            <DialogTitle>{preview.title}</DialogTitle>
            <DialogDescription>
              Локальний перегляд реклами. Трансляція не змінюється.
            </DialogDescription>
            <video
              className="preview-video"
              src={preview.url}
              muted={!rows.find((row) => row.id === preview.id)?.original_sound}
              preload="metadata"
              controls
              playsInline
              onError={() => toast.error("Рекламний файл не вдалося завантажити")}
            />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
