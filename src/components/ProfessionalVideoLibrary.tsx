import { useEffect, useState } from "react";
import { VideoLibrary, type VideoLibraryProps } from "./VideoLibrary";
import { useTaxonomy } from "@/hooks/use-taxonomy";
import { matchesClassification, TAG_GROUPS } from "@/lib/video-taxonomy";
import { deleteVideoRecords } from "@/lib/video-taxonomy-api";
import { VideoClassificationEditor } from "./VideoClassificationEditor";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";
export function ProfessionalVideoLibrary(
  props: Omit<VideoLibraryProps, "classification"> & {
    onDeleted: (ids: string[]) => void;
    deleteAllowed: boolean;
  },
) {
  const { data, error, refresh } = useTaxonomy();
  const [category, setCategory] = useState("all"),
    [format, setFormat] = useState("all"),
    [tags, setTags] = useState<string[]>([]),
    [review, setReview] = useState(false),
    [editing, setEditing] = useState<string[] | null>(null),
    [deleting, setDeleting] = useState<string[] | null>(null),
    [confirmation, setConfirmation] = useState(""),
    [failure, setFailure] = useState(""),
    [busy, setBusy] = useState(false);
  const idsKey = props.videos.map((v) => v.id).join(",");
  useEffect(() => {
    void refresh();
  }, [idsKey, refresh]);
  const controls = data && (
    <div className="taxonomy-filters">
      <label>
        Основна категорія
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">Усі категорії</option>
          <option value="none">Без категорії</option>
          {data.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({data.classifications.filter((v) => v.category_id === c.id).length})
            </option>
          ))}
        </select>
      </label>
      <label>
        Формат
        <select value={format} onChange={(e) => setFormat(e.target.value)}>
          <option value="all">Усі формати</option>
          <option value="none">Без формату</option>
          {data.formats.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Теги (мають бути всі вибрані)
        <select
          multiple
          value={tags}
          onChange={(e) => setTags(Array.from(e.target.selectedOptions, (o) => o.value))}
        >
          {Object.entries(TAG_GROUPS).map(([key, label]) => (
            <optgroup key={key} label={label}>
              {data.tags
                .filter((t) => t.group_key === key)
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({data.relations.filter((r) => r.tag_id === t.id).length})
                  </option>
                ))}
            </optgroup>
          ))}
        </select>
      </label>
      <label>
        <input type="checkbox" checked={review} onChange={(e) => setReview(e.target.checked)} />
        Потребує класифікації
      </label>
      <button
        className="button"
        onClick={() => {
          setCategory("all");
          setFormat("all");
          setTags([]);
          setReview(false);
        }}
      >
        Скинути фільтри
      </button>
      <button className="button" onClick={() => void refresh()}>
        Оновити класифікацію
      </button>
    </div>
  );
  return (
    <>
      {error && (
        <p role="alert" className="error-banner">
          {error}
          <button onClick={() => void refresh()}>Повторити</button>
        </p>
      )}
      <VideoLibrary
        {...props}
        classification={{
          ready: !!data,
          filterKey: [category, format, review, ...tags].join(","),
          controls,
          filter: (v) => !data || matchesClassification(v.id, data, category, format, tags, review),
          label: (v) => {
            const c = data?.classifications.find((c) => c.video_id === v.id);
            return [
              data?.categories.find((k) => k.id === c?.category_id)?.name || "Без категорії",
              data?.formats.find((f) => f.id === c?.format_id)?.name,
              c?.review_status !== "classified" ? "Потребує класифікації" : "",
            ]
              .filter(Boolean)
              .join(" · ");
          },
          onEdit: (v) => {
            if (data) setEditing([v.id]);
          },
          bulk: (ids) =>
            ids.length > 0 && (
              <>
                <button disabled={!data} onClick={() => setEditing(ids)}>
                  Класифікувати обрані
                </button>
                <button
                  disabled={!props.deleteAllowed}
                  onClick={() => {
                    setDeleting(ids);
                    setConfirmation("");
                    setFailure("");
                  }}
                >
                  Видалити записи…
                </button>
              </>
            ),
        }}
      />
      {editing && data && (
        <VideoClassificationEditor
          key={editing.join(",")}
          ids={editing}
          data={data}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      )}
      {deleting && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !busy) setDeleting(null);
          }}
        >
          <DialogContent className="admin-dialog">
            <DialogTitle>Видалити {deleting.length} записів відео?</DialogTitle>
            <DialogDescription>
              Для щоденної роботи краще вимкнути відео. Ця дія видаляє записи та їхні класифікації.
              Самі MP4 залишаться на місці. Фізичне видалення файлів цим інтерфейсом недоступне.
            </DialogDescription>
            <ul>
              {props.videos
                .filter((v) => deleting.includes(v.id))
                .map((v) => (
                  <li key={v.id}>{v.title}</li>
                ))}
            </ul>
            <label>
              Введіть «ВИДАЛИТИ {deleting.length}»
              <input value={confirmation} onChange={(e) => setConfirmation(e.target.value)} />
            </label>
            {failure && <p role="alert">{failure}</p>}
            <div className="dialog-actions">
              <button className="button" disabled={busy} onClick={() => setDeleting(null)}>
                Скасувати
              </button>
              <button
                className="button danger"
                disabled={busy || confirmation !== `ВИДАЛИТИ ${deleting.length}`}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await deleteVideoRecords(deleting, confirmation);
                    props.onDeleted(deleting);
                    setDeleting(null);
                    await refresh();
                  } catch (err) {
                    setFailure((err as Error).message);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Остаточно видалити записи
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
