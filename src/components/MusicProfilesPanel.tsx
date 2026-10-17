import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { fetchMusicProfiles, saveMusicProfile } from "@/lib/music-profile-api";
import type { MusicProfile } from "@/lib/music-profiles";
import { useUnsaved } from "@/hooks/use-unsaved";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export function MusicProfilesPanel({
  library,
  labels,
  volume,
  onDirtyChange,
}: {
  library: string[];
  labels: Record<string, string>;
  volume: number;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [rows, setRows] = useState<MusicProfile[]>([]),
    [editing, setEditing] = useState<MusicProfile | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const preview = useRef<HTMLAudioElement>(null);
  const previewQueue = useRef<string[]>([]);
  const previewIndex = useRef(0);
  useUnsaved(!!editing);
  useEffect(() => {
    onDirtyChange(!!editing);
    return () => onDirtyChange(false);
  }, [editing, onDirtyChange]);
  useEffect(() => {
    const node = preview.current;
    return () => {
      node?.pause();
    };
  }, []);
  async function load() {
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 12000);
    try {
      setRows(await fetchMusicProfiles(controller.signal));
      setLoaded(true);
      setError("");
    } catch {
      setError("Профілі недоступні. Перевірте мережу, права й міграцію music_profiles.");
    } finally {
      clearTimeout(timer);
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function action(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function move(index: number, direction: number) {
    const next = rows.slice(),
      target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    await action(async () => {
      const r = await supabase.rpc("reorder_music_profiles", {
        ordered_ids: next.map((p) => p.id),
      });
      if (r.error) throw new Error(r.error.message);
    });
  }
  function trackMove(index: number, direction: number) {
    if (!editing) return;
    const next = editing.track_urls.slice(),
      target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    setEditing({ ...editing, track_urls: next });
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">АТМОСФЕРА ДЛЯ КОЖНОГО ЕКРАНА</p>
          <h1>Музичні профілі</h1>
          <p>Треки з наявної бібліотеки. Вибір профілю на ТВ не змінює відеочергу.</p>
        </div>
        <button
          className="button primary"
          disabled={busy || !loaded}
          onClick={() =>
            setEditing({
              id: crypto.randomUUID(),
              name: "",
              description: "",
              is_active: true,
              is_default: false,
              sort_order: Math.max(0, ...rows.map((p) => p.sort_order)) + 1,
              volume_override: null,
              track_urls: [],
            })
          }
        >
          Створити профіль
        </button>
      </div>
      {error && (
        <div role="alert" className="error-banner">
          {error}
          <button className="button secondary" onClick={() => void load()}>
            Повторити
          </button>
        </div>
      )}
      <audio
        ref={preview}
        hidden={!previewing}
        controls
        aria-label="Предпрослуховування профілю"
        onEnded={() => {
          const next = previewQueue.current[++previewIndex.current];
          if (next && preview.current) {
            preview.current.src = next;
            void preview.current
              .play()
              .catch(() => setError("Не вдалося відтворити наступну композицію."));
          }
        }}
      />
      <p>
        «Без музики» завжди доступний на ТВ. Порожній профіль також відтворює відео без фонової
        музики.
      </p>
      {loaded && !rows.length && (
        <div className="panel empty-state">
          Профілів поки немає. Поточна музична бібліотека збережена.
        </div>
      )}
      {rows.map((p, i) => (
        <section className="panel" key={p.id}>
          <h2>{p.name}</h2>
          <p>{p.description}</p>
          <p>
            {p.is_active ? "Активний" : "Неактивний"}
            {p.is_default ? " · За замовчуванням" : ""} ·{" "}
            {p.track_urls.filter((url) => library.includes(url)).length} треків
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setEditing({ ...p, track_urls: [...p.track_urls] })}
            >
              Редагувати {p.name}
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() =>
                void action(() =>
                  saveMusicProfile({
                    ...p,
                    is_active: !p.is_active,
                    is_default: p.is_active ? false : p.is_default,
                  }),
                )
              }
            >
              {p.is_active ? "Вимкнути" : "Увімкнути"} {p.name}
            </button>
            <button
              className="button secondary"
              disabled={busy || !p.is_active || p.is_default}
              onClick={() => void action(() => saveMusicProfile({ ...p, is_default: true }))}
            >
              За замовчуванням {p.name}
            </button>
            <button
              className="button secondary"
              disabled={busy || i === 0}
              onClick={() => void move(i, -1)}
            >
              Вище {p.name}
            </button>
            <button
              className="button secondary"
              disabled={busy || i === rows.length - 1}
              onClick={() => void move(i, 1)}
            >
              Нижче {p.name}
            </button>
            <button
              className="button secondary"
              disabled={busy || !p.track_urls.some((url) => library.includes(url))}
              onClick={() => {
                if (preview.current) {
                  setPreviewing(true);
                  previewQueue.current = p.track_urls.filter((url) => library.includes(url));
                  previewIndex.current = 0;
                  preview.current.src = previewQueue.current[0]!;
                  preview.current.volume = p.volume_override ?? volume;
                  void preview.current
                    .play()
                    .catch(() => setError("Натисніть Play у попередньому прослуховуванні."));
                }
              }}
            >
              Слухати {p.name}
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => {
                if (
                  confirm(
                    `Видалити профіль «${p.name}»? Треки бібліотеки залишаться. ТВ перейде на доступний профіль.`,
                  )
                )
                  void action(async () => {
                    const r = await supabase
                      .from("music_profiles")
                      .delete()
                      .eq("id", p.id)
                      .select("id")
                      .single();
                    if (r.error) throw new Error(r.error.message);
                  });
              }}
            >
              Видалити {p.name}
            </button>
          </div>
        </section>
      ))}
      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open && !busy && confirm("Закрити редактор без збереження?")) setEditing(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogTitle>Музичний профіль</DialogTitle>
          <DialogDescription>
            Збереження застосовується на ТВ приблизно за 10 секунд. Звук відео та реклами не
            змінюється.
          </DialogDescription>
          {editing && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void action(async () => {
                  await saveMusicProfile(editing);
                  setEditing(null);
                });
              }}
              className="space-y-4"
            >
              <label className="block">
                Назва
                <input
                  className="w-full rounded border p-2"
                  required
                  maxLength={100}
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </label>
              <label className="block">
                Опис
                <textarea
                  className="w-full rounded border p-2"
                  maxLength={500}
                  value={editing.description}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                />
              </label>
              <label className="block">
                <input
                  type="checkbox"
                  checked={editing.is_active}
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      is_active: e.target.checked,
                      is_default: e.target.checked ? editing.is_default : false,
                    })
                  }
                />{" "}
                Активний
              </label>
              <label className="block">
                <input
                  type="checkbox"
                  disabled={!editing.is_active}
                  checked={editing.is_default}
                  onChange={(e) => setEditing({ ...editing, is_default: e.target.checked })}
                />{" "}
                За замовчуванням
              </label>
              <label className="block">
                Гучність профілю, % (порожньо — загальна)
                <input
                  className="w-full rounded border p-2"
                  type="number"
                  min={0}
                  max={100}
                  value={
                    editing.volume_override === null
                      ? ""
                      : Math.round(editing.volume_override * 100)
                  }
                  onChange={(e) =>
                    setEditing({
                      ...editing,
                      volume_override: e.target.value === "" ? null : Number(e.target.value) / 100,
                    })
                  }
                />
              </label>
              <h3>Композиції та порядок</h3>
              {editing.track_urls.map((url, i) => (
                <div key={url} className="flex flex-wrap items-center gap-2">
                  <span>
                    {i + 1}. {labels[url] || url}
                    {!library.includes(url) ? " — видалено з бібліотеки" : ""}
                  </span>
                  <button type="button" disabled={i === 0} onClick={() => trackMove(i, -1)}>
                    ↑
                  </button>
                  <button
                    type="button"
                    disabled={i === editing.track_urls.length - 1}
                    onClick={() => trackMove(i, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEditing({
                        ...editing,
                        track_urls: editing.track_urls.filter((u) => u !== url),
                      })
                    }
                  >
                    Прибрати
                  </button>
                </div>
              ))}
              <label className="block">
                Додати з бібліотеки
                <select
                  className="w-full rounded border p-2"
                  value=""
                  onChange={(e) => {
                    if (e.target.value)
                      setEditing({
                        ...editing,
                        track_urls: [...editing.track_urls, e.target.value],
                      });
                  }}
                >
                  <option value="">Оберіть композицію</option>
                  {library
                    .filter((url) => !editing.track_urls.includes(url))
                    .map((url) => (
                      <option key={url} value={url}>
                        {labels[url] || url}
                      </option>
                    ))}
                </select>
              </label>
              {!library.length && (
                <p>Спочатку додайте й збережіть композиції у «Музика та звук».</p>
              )}
              {error && <p role="alert">{error}</p>}
              <button className="button primary" disabled={busy} type="submit">
                Зберегти профіль
              </button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
