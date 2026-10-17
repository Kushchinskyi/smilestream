import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Film,
  Music2,
  Clock,
  ArrowUpRight,
  Download,
  Upload,
  CheckCircle2,
  Activity,
  Monitor,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useUnsaved } from "@/hooks/use-unsaved";
import { AdminShell, SECTIONS, type AdminSection } from "@/components/AdminShell";
import { AudioSettingsPanel } from "@/components/AudioSettingsPanel";
import { MusicProfilesPanel } from "@/components/MusicProfilesPanel";
import { VideoLibrary } from "@/components/VideoLibrary";
import { VideoEditor, type VideoDraft } from "@/components/VideoEditor";
import { ScreenLibrary } from "@/components/ScreenLibrary";
import { AdvertisementLibrary } from "@/components/AdvertisementLibrary";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { type Video, formatDuration } from "@/lib/backend";
import { DEFAULT_AUDIO, validateAudio, type AudioSettings } from "@/lib/audio-settings";
import { fetchAudio, writeAudio } from "@/lib/playback-api";
import { readAdminVideos, readAdminMetadata } from "@/lib/admin-api";
import {
  downloadJson,
  formatCycleDuration,
  exportLibrary,
  parseAudioImport,
  type MediaMetadata,
} from "@/lib/admin-library";
export const Route = createFileRoute("/_authenticated/admin")({
  validateSearch: (search: Record<string, unknown>): { section?: AdminSection } => ({
    section: SECTIONS.some((s) => s.id === search["section"])
      ? (search["section"] as AdminSection)
      : ("overview" as AdminSection),
  }),
  head: () => ({ meta: [{ title: "Панель керування — Smile Stream" }] }),
  component: AdminPage,
});
function AdminPage() {
  const admin = useIsAdmin(),
    { section = "overview" } = Route.useSearch(),
    navigate = Route.useNavigate();
  const [videos, setVideos] = useState<Video[]>([]),
    [metadata, setMetadata] = useState<MediaMetadata[]>([]),
    [audio, setAudio] = useState<AudioSettings>(DEFAULT_AUDIO),
    [savedAudio, setSavedAudio] = useState<AudioSettings>(DEFAULT_AUDIO),
    [labels, setLabels] = useState<Record<string, string>>({}),
    [savedLabels, setSavedLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true),
    [adDirty, setAdDirty] = useState(false),
    [error, setError] = useState(""),
    [audioError, setAudioError] = useState(""),
    [saving, setSaving] = useState(false),
    [busy, setBusy] = useState(false),
    [lastSync, setLastSync] = useState<string | null>(null),
    [editing, setEditing] = useState<Video | null | undefined>(),
    [preview, setPreview] = useState<Video | null>(null),
    [imported, setImported] = useState<AudioSettings | null>(null);
  const dirty =
    JSON.stringify(audio) !== JSON.stringify(savedAudio) ||
    JSON.stringify(labels) !== JSON.stringify(savedLabels);
  useUnsaved(dirty || adDirty || editing !== undefined);
  async function load() {
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), 12000);
    setLoading(true);
    setError("");
    try {
      const [v, m, a] = await Promise.all([
        readAdminVideos(controller.signal),
        readAdminMetadata(controller.signal)
          .then((data) => ({ data, error: false }))
          .catch(() => ({ data: [] as MediaMetadata[], error: true })),
        fetchAudio(controller.signal),
      ]);
      setVideos(v);
      if (m.error)
        setError("Метадані недоступні. Перевірте мережу та застосування міграції media_metadata.");
      const meta = m.data || [];
      setMetadata(meta);
      const names = Object.fromEntries(
        meta.filter((row) => row.kind === "music").map((row) => [row.source_key, row.label]),
      );
      setLabels(names);
      setSavedLabels(names);
      setAudio(a);
      setSavedAudio(a);
      setLastSync(new Date().toISOString());
    } catch (err) {
      setError((err as Error).message || "Не вдалося прочитати налаштування");
    } finally {
      clearTimeout(deadline);
      setLoading(false);
    }
  }
  useEffect(() => {
    if (admin === "yes") void load();
  }, [admin]);
  function go(next: AdminSection) {
    if (next === section) return;
    if ((dirty || adDirty) && !confirm("Відхилити незбережені зміни?")) return;
    setAdDirty(false);
    if (dirty) {
      setAudio(savedAudio);
      setLabels(savedLabels);
    }
    void navigate({ search: { section: next } });
  }
  async function saveAudio() {
    setAudioError("");
    try {
      const clean = validateAudio(audio);
      setSaving(true);
      const rows = clean.musicUrls.map((url) => ({
        kind: "music",
        source_key: url,
        label: (labels[url] || "").slice(0, 160),
        category: "other",
      }));
      if (rows.length) {
        const r = await supabase
          .from("media_metadata")
          .upsert([...new Map(rows.map((row) => [row.source_key, row])).values()]);
        if (r.error)
          throw new Error("Не вдалося зберегти назви композицій. Перевірте міграцію та права.");
      }
      await writeAudio(clean);
      setAudio(clean);
      setSavedAudio(clean);
      setSavedLabels({ ...labels });
      toast.success("Звук збережено. Оновлення на ТВ — приблизно за 10 секунд.");
    } catch (err) {
      setAudioError((err as Error).message || "Не вдалося зберегти налаштування");
    } finally {
      setSaving(false);
    }
  }
  async function original(ids: string[], enabled: boolean) {
    if (dirty) {
      toast.error("Спочатку збережіть або відхиліть чернетку звуку.");
      return;
    }
    setBusy(true);
    try {
      const current = await fetchAudio(new AbortController().signal);
      const next = {
        ...current,
        originalIds: enabled
          ? [...new Set([...current.originalIds, ...ids])]
          : current.originalIds.filter((id) => !ids.includes(id)),
      };
      await writeAudio(next);
      setAudio(next);
      setSavedAudio(next);
      toast.success("Оригінальний звук оновлено для всіх ТВ.");
    } catch {
      toast.error("Звук не змінено. Перевірте мережу та права.");
    } finally {
      setBusy(false);
    }
  }
  async function active(ids: string[], value: boolean) {
    setBusy(true);
    const result = await supabase.from("videos").update({ is_active: value }).in("id", ids);
    setBusy(false);
    if (result.error) toast.error("Не вдалося змінити активність");
    else
      setVideos((rows) => rows.map((v) => (ids.includes(v.id) ? { ...v, is_active: value } : v)));
  }
  async function reorder(ids: string[]) {
    setBusy(true);
    const r = await supabase.rpc("reorder_videos", { ordered_ids: ids });
    setBusy(false);
    if (r.error) {
      toast.error("Порядок не змінено. Бібліотека могла оновитися; перечитайте дані.");
      return;
    }
    setVideos(ids.map((id, i) => ({ ...videos.find((v) => v.id === id)!, sort_order: i + 1 })));
    toast.success("Порядок збережено");
  }
  const activeVideos = videos.filter((v) => v.is_active),
    total = activeVideos.reduce((sum, v) => sum + v.duration_seconds, 0);
  return (
    <AdminShell section={section} onNavigate={go}>
      {admin === "no" ? (
        <div className="panel empty-state">
          <h1>Доступ обмежено</h1>
          <p>Ваш обліковий запис не має прав адміністратора.</p>
        </div>
      ) : loading || admin === "loading" ? (
        <>
          <div className="skeleton heading-skeleton" />
          <div className="volume-grid">
            {[1, 2, 3].map((n) => (
              <div className="panel skeleton" key={n} />
            ))}
          </div>
          <p role="status">Завантаження панелі керування…</p>
        </>
      ) : (
        <>
          {error && (
            <div role="alert" className="error-banner">
              {error}
              <button
                className="button secondary"
                onClick={() => {
                  if (!dirty || confirm("Відхилити чернетку й перечитати дані?")) void load();
                }}
              >
                Перечитати дані
              </button>
            </div>
          )}
          {lastSync && section === "overview" && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">ВАШ ПРОСТІР. ВАШ КОНТЕНТ.</p>
                  <h1>Добрий день 👋</h1>
                  <p>Усе для комфортної атмосфери у вашій клініці.</p>
                </div>
                <a className="button primary" href="/tv" target="_blank" rel="noreferrer">
                  Відкрити трансляцію
                  <ArrowUpRight size={18} />
                </a>
              </div>
              <div className="stats-grid">
                {[
                  {
                    icon: Film,
                    label: "Активних відео",
                    value: activeVideos.length,
                    note: `${videos.length} у бібліотеці`,
                  },
                  {
                    icon: Clock,
                    label: "Тривалість циклу",
                    value: formatCycleDuration(total),
                    note: "За вказаними тривалостями",
                  },
                  {
                    icon: Music2,
                    label: "Композицій",
                    value: savedAudio.musicUrls.length,
                    note: "Незалежний музичний канал",
                  },
                ].map((s) => (
                  <section className="panel stat-card" key={s.label}>
                    <span className="icon-tile">
                      <s.icon size={22} />
                    </span>
                    <p>{s.label}</p>
                    <strong>{s.value}</strong>
                    <small>{s.note}</small>
                  </section>
                ))}
              </div>
              <div className="dashboard-grid">
                <section className="panel">
                  <div className="panel-heading">
                    <div>
                      <h2>На черзі</h2>
                      <p>Активний плейлист у порядку відтворення</p>
                    </div>
                    <button className="text-button" onClick={() => go("videos")}>
                      Уся відеотека →
                    </button>
                  </div>
                  {activeVideos.length ? (
                    activeVideos.slice(0, 5).map((v, i) => (
                      <div className="queue-row" key={v.id}>
                        <span className="queue-number">{String(i + 1).padStart(2, "0")}</span>
                        <span className="icon-tile">
                          <Film size={20} />
                        </span>
                        <div>
                          <strong>{v.title}</strong>
                          <small>
                            {formatDuration(v.duration_seconds)} ·{" "}
                            {savedAudio.originalIds.includes(v.id)
                              ? "Оригінальний звук"
                              : "Без звуку"}
                          </small>
                        </div>
                        <span className="pill active">Активний</span>
                      </div>
                    ))
                  ) : (
                    <div className="empty-state">
                      Немає активних роликів. Додайте або увімкніть відео.
                    </div>
                  )}
                </section>
                <section className="panel atmosphere-card">
                  <span className="icon-tile">
                    <Music2 size={24} />
                  </span>
                  <h2>Звук, що створює атмосферу</h2>
                  <p>Налаштуйте баланс музики та відео для ваших пацієнтів.</p>
                  <div className="audio-summary">
                    <span>
                      Фонова музика<strong>{Math.round(savedAudio.musicVolume * 100)}%</strong>
                    </span>
                    <span>
                      Оригінальний звук<strong>{Math.round(savedAudio.videoVolume * 100)}%</strong>
                    </span>
                    <span>
                      Коефіцієнт приглушення
                      <strong>{Math.round(savedAudio.duckVolume * 100)}%</strong>
                    </span>
                  </div>
                  <button className="button secondary" onClick={() => go("audio")}>
                    Налаштувати звук →
                  </button>
                </section>
              </div>
              <div className="info-banner">
                <CheckCircle2 size={22} />
                <span>
                  Налаштування централізовані. Телевізори самостійно отримують оновлення. Статус
                  пристроїв поки не збирається.
                </span>
              </div>
            </>
          )}
          {lastSync && section === "videos" && (
            <VideoLibrary
              videos={videos}
              metadata={metadata}
              originalIds={savedAudio.originalIds}
              busy={busy}
              onEdit={setEditing}
              onPreview={setPreview}
              onActive={(ids, value) => void active(ids, value)}
              onOriginal={(ids, value) => void original(ids, value)}
              onReorder={(ids) => void reorder(ids)}
            />
          )}
          {lastSync && section === "audio" && (
            <AudioSettingsPanel
              settings={audio}
              onChange={setAudio}
              labels={labels}
              onLabels={setLabels}
              onSave={() => void saveAudio()}
              saving={saving}
              dirty={dirty}
              error={audioError}
            />
          )}
          {section === "screens" && <ScreenLibrary />}
          {lastSync && section === "profiles" && (
            <MusicProfilesPanel
              library={savedAudio.musicUrls}
              labels={savedLabels}
              volume={savedAudio.musicVolume}
              onDirtyChange={setAdDirty}
            />
          )}
          {section === "ads" && <AdvertisementLibrary onDirtyChange={setAdDirty} />}
          {section === "diagnostics" && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">ПРОЗОРИЙ СТАН СИСТЕМИ</p>
                  <h1>Діагностика</h1>
                  <p>Лише підтверджені дані, без умовних показників.</p>
                </div>
                <button className="button secondary" onClick={() => void load()}>
                  Оновити перевірку
                </button>
              </div>
              <section className="panel">
                <h2>Конфігурація</h2>
                <dl className="diagnostic-list">
                  <dt>Останнє успішне читання у цій панелі</dt>
                  <dd>
                    {lastSync
                      ? new Date(lastSync).toLocaleString("uk-UA", { timeZone: "Europe/Kyiv" })
                      : "Дані відсутні"}
                  </dd>
                  <dt>Джерело звуку</dt>
                  <dd>Центральні налаштування Supabase</dd>
                  <dt>Оновлення ТВ</dt>
                  <dd>Приблизно кожні 10 секунд</dd>
                  <dt>Часовий пояс</dt>
                  <dd>Europe/Kyiv</dd>
                </dl>
              </section>
              <section className="panel empty-state">
                <Activity size={36} />
                <h2>Телеметрія ще не підключена</h2>
                <p>
                  Поточний ролик, помилки, кількість показів та uptime окремих екранів — дані
                  відсутні. Нульові значення не підставляються.
                </p>
              </section>
            </>
          )}
          {lastSync && section === "settings" && (
            <>
              <div className="page-heading">
                <div>
                  <p className="eyebrow">КОНТРОЛЬ І ЗБЕРЕЖЕННЯ</p>
                  <h1>Налаштування</h1>
                  <p>Резервні копії та безпечне перенесення налаштувань.</p>
                </div>
              </div>
              <div className="settings-grid">
                <section className="panel">
                  <span className="icon-tile">
                    <Download size={22} />
                  </span>
                  <h2>Резервна копія бібліотеки</h2>
                  <p>
                    Відеотека, категорії та збережені музичні налаштування. Паролі, сесії й
                    API-ключі не експортуються.
                  </p>
                  <button
                    className="button secondary"
                    onClick={() =>
                      downloadJson(
                        "smile-stream-library.json",
                        exportLibrary(videos, savedAudio, metadata),
                      )
                    }
                  >
                    <Download size={17} />
                    Експортувати JSON
                  </button>
                </section>
                <section className="panel">
                  <span className="icon-tile">
                    <Upload size={22} />
                  </span>
                  <h2>Імпорт звуку</h2>
                  <p>
                    Спочатку перевірте зміни. Імпорт створює лише чернетку й не змінює ТВ до
                    збереження.
                  </p>
                  <label className="button secondary file-button">
                    Обрати JSON
                    <input
                      type="file"
                      accept="application/json"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        try {
                          if (file.size > 2 * 1024 * 1024) throw new Error("Файл перевищує 2 МБ");
                          setImported(parseAudioImport(await file.text()));
                        } catch (err) {
                          toast.error((err as Error).message);
                        }
                        e.target.value = "";
                      }}
                    />
                  </label>
                </section>
              </div>
              <section className="panel">
                <h2>Реклама та розклад</h2>
                <p>
                  Рекламні блоки налаштовуються в розділі «Реклама». Розклад робочих годин ще не
                  керує трансляціями.
                </p>
              </section>
            </>
          )}
          {editing !== undefined && (
            <VideoEditor
              coverUrl={
                metadata.find((m) => m.kind === "video" && m.source_key === editing?.id)
                  ?.cover_url || ""
              }
              key={editing?.id || "new"}
              video={editing}
              category={
                metadata.find((m) => m.kind === "video" && m.source_key === editing?.id)
                  ?.category || "other"
              }
              original={savedAudio.originalIds.includes(editing?.id || "")}
              order={(videos[videos.length - 1]?.sort_order || 0) + 1}
              onClose={() => setEditing(undefined)}
              onSave={async (
                draft: VideoDraft,
                category: string,
                sound: boolean,
                cover_url: string,
              ) => {
                if (dirty) throw new Error("Спочатку збережіть або відхиліть чернетку звуку.");
                if (
                  videos.some((v) => v.id !== editing?.id && v.url === draft.url) &&
                  !confirm("Це посилання вже є у бібліотеці. Зберегти дублікат?")
                )
                  return;
                const r = editing
                  ? await supabase
                      .from("videos")
                      .update(draft)
                      .eq("id", editing.id)
                      .select("*")
                      .single()
                  : await supabase.from("videos").insert(draft).select("*").single();
                if (r.error)
                  throw new Error("Не вдалося зберегти відео. Перевірте мережу й права.");
                const m = await supabase
                  .from("media_metadata")
                  .upsert({ kind: "video", source_key: r.data.id, label: "", category, cover_url });
                if (m.error) {
                  setEditing(r.data);
                  toast.error("Відео вже збережено. Категорію потрібно повторно зберегти.");
                  await load();
                  throw new Error(
                    "Відео збережено, але категорія ні. Перевірте міграцію й повторіть.",
                  );
                }
                const current = await fetchAudio(new AbortController().signal);
                const next = {
                  ...current,
                  originalIds: sound
                    ? [...new Set([...current.originalIds, r.data.id])]
                    : current.originalIds.filter((id) => id !== r.data.id),
                };
                try {
                  await writeAudio(next);
                } catch {
                  setEditing(r.data);
                  toast.error("Відео вже збережено. Налаштування звуку потрібно повторити.");
                  await load();
                  throw new Error(
                    "Відео й категорію збережено, але звук ні. Повторіть налаштування звуку.",
                  );
                }
                setEditing(undefined);
                await load();
                toast.success("Відео збережено");
              }}
              onDelete={async () => {
                if (!editing) return;
                const r = await supabase.from("videos").delete().eq("id", editing.id);
                if (r.error) throw new Error("Не вдалося видалити відео");
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
                  Попередній перегляд на цьому пристрої. Трансляція на ТВ не змінюється.
                </DialogDescription>
                <video
                  className="preview-video"
                  src={preview.url}
                  controls
                  playsInline
                  preload="metadata"
                  onError={() => toast.error("Відео недоступне. Перевірте URL і формат.")}
                />
              </DialogContent>
            </Dialog>
          )}
          {imported && (
            <Dialog
              open
              onOpenChange={(open) => {
                if (!open) setImported(null);
              }}
            >
              <DialogContent className="admin-dialog">
                <DialogTitle>Перевірте імпорт звуку</DialogTitle>
                <DialogDescription>
                  Поточні чернеткові налаштування буде замінено. Дані на сервері поки не зміняться.
                </DialogDescription>
                <dl className="diagnostic-list">
                  <dt>Композицій</dt>
                  <dd>{imported.musicUrls.length}</dd>
                  <dt>Фонова музика</dt>
                  <dd>{Math.round(imported.musicVolume * 100)}%</dd>
                  <dt>Оригінальний звук</dt>
                  <dd>{Math.round(imported.videoVolume * 100)}%</dd>
                  <dt>Приглушення</dt>
                  <dd>{Math.round(imported.duckVolume * 100)}%</dd>
                </dl>
                <button
                  className="button primary"
                  onClick={() => {
                    setAudio(imported);
                    setImported(null);
                    void navigate({ search: { section: "audio" } });
                  }}
                >
                  Завантажити у чернетку
                </button>
              </DialogContent>
            </Dialog>
          )}
        </>
      )}
    </AdminShell>
  );
}
