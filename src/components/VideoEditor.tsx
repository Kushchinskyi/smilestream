import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CATEGORIES, validateVideo } from "@/lib/admin-library";
import type { Video } from "@/lib/backend";
export type VideoDraft = {
  title: string;
  url: string;
  duration_seconds: number;
  sort_order: number;
  is_active: boolean;
};
export function VideoEditor({
  video,
  category,
  original,
  order,
  onClose,
  onSave,
  onDelete,
}: {
  video: Video | null;
  category: string;
  original: boolean;
  order: number;
  onClose: () => void;
  onSave: (draft: VideoDraft, category: string, original: boolean) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<VideoDraft>(
    video
      ? {
          title: video.title,
          url: video.url,
          duration_seconds: video.duration_seconds,
          sort_order: video.sort_order,
          is_active: video.is_active,
        }
      : { title: "", url: "", duration_seconds: 0, sort_order: order, is_active: true },
  );
  const [cat, setCat] = useState(category),
    [sound, setSound] = useState(original),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [probe, setProbe] = useState(false);
  const dirty =
    JSON.stringify(draft) !==
      JSON.stringify(
        video
          ? {
              title: video.title,
              url: video.url,
              duration_seconds: video.duration_seconds,
              sort_order: video.sort_order,
              is_active: video.is_active,
            }
          : { title: "", url: "", duration_seconds: 0, sort_order: order, is_active: true },
      ) ||
    cat !== category ||
    sound !== original;
  function close() {
    if (!busy && (!dirty || confirm("Відхилити незбережені зміни відео?"))) onClose();
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent className="admin-dialog">
        <DialogTitle>{video ? "Редагувати відео" : "Додати відео"}</DialogTitle>
        <DialogDescription>
          Пряме HTTPS-посилання. Зміни застосуються до наступних відтворень на ТВ.
        </DialogDescription>
        <form
          className="editor-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setError("");
            try {
              const clean = validateVideo(draft);
              setBusy(true);
              await onSave(clean, cat, sound);
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Назва
            <input
              autoFocus
              maxLength={200}
              required
              value={draft.title}
              onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            />
          </label>
          <label>
            URL MP4
            <input
              type="url"
              required
              value={draft.url}
              placeholder="https://…/video.mp4"
              onChange={(e) => {
                setProbe(false);
                setDraft({ ...draft, url: e.target.value });
              }}
            />
          </label>
          <div className="form-grid">
            <label>
              Категорія
              <select value={cat} onChange={(e) => setCat(e.target.value)}>
                {Object.entries(CATEGORIES).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Тривалість, сек
              <input
                type="number"
                min="0"
                max="86400"
                value={draft.duration_seconds}
                onChange={(e) => setDraft({ ...draft, duration_seconds: Number(e.target.value) })}
              />
            </label>
            <label>
              Порядок
              <input
                type="number"
                min="-1000000"
                max="1000000"
                value={draft.sort_order}
                onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })}
              />
            </label>
          </div>
          <button
            type="button"
            className="text-button"
            onClick={() => {
              try {
                validateVideo(draft);
                setProbe(true);
              } catch (err) {
                setError((err as Error).message);
              }
            }}
          >
            Визначити фактичну тривалість
          </button>
          {probe && (
            <video
              className="metadata-probe"
              src={draft.url}
              preload="metadata"
              muted
              onLoadedMetadata={(e) => {
                const duration = e.currentTarget.duration;
                if (Number.isFinite(duration) && duration <= 86400)
                  setDraft((d) => ({ ...d, duration_seconds: Math.round(duration) }));
                setProbe(false);
              }}
              onError={() => {
                setError("Метадані недоступні. Вкажіть тривалість вручну.");
                setProbe(false);
              }}
            />
          )}
          <label className="check-row">
            <input
              type="checkbox"
              checked={draft.is_active}
              onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
            />
            <span>
              <strong>Активний ролик</strong>
              <small>Буде доданий до черги на телевізорах</small>
            </span>
          </label>
          <label className="check-row">
            <input type="checkbox" checked={sound} onChange={(e) => setSound(e.target.checked)} />
            <span>
              <strong>Оригінальний звук</strong>
              <small>Увімкнути звук відео та приглушувати фонову музику</small>
            </span>
          </label>
          {error && (
            <p role="alert" className="error-banner">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            {video && (
              <button
                type="button"
                className="button danger"
                disabled={busy}
                onClick={async () => {
                  if (!confirm(`Назавжди видалити «${video.title}» з бібліотеки?`)) return;
                  setBusy(true);
                  try {
                    await onDelete();
                  } catch (err) {
                    setError((err as Error).message);
                    setBusy(false);
                  }
                }}
              >
                Видалити
              </button>
            )}
            <button type="button" className="button secondary" disabled={busy} onClick={close}>
              Скасувати
            </button>
            <button className="button primary" disabled={busy}>
              {busy ? "Збереження…" : "Зберегти відео"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
