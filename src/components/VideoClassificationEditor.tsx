import { useState } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";
import { TAG_GROUPS, type Taxonomy, type ClassificationPatch } from "@/lib/video-taxonomy";
import { classifyVideos } from "@/lib/video-taxonomy-api";
export function TaxonomyTagPicker({
  data,
  value,
  onChange,
}: {
  data: Taxonomy;
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  return (
    <div className="taxonomy-tags">
      <label>
        Пошук тегів і синонімів
        <input value={search} onChange={(e) => setSearch(e.target.value)} />
      </label>
      {Object.entries(TAG_GROUPS).map(([key, label]) => (
        <fieldset key={key}>
          <legend>{label}</legend>
          {data.tags
            .filter(
              (t) =>
                t.group_key === key &&
                (t.is_active || value.includes(t.id)) &&
                [t.name, ...t.aliases]
                  .join(" ")
                  .toLocaleLowerCase("uk")
                  .includes(search.toLocaleLowerCase("uk")),
            )
            .map((t) => (
              <label key={t.id}>
                <input
                  type="checkbox"
                  checked={value.includes(t.id)}
                  onChange={(e) =>
                    onChange(
                      e.target.checked ? [...value, t.id] : value.filter((id) => id !== t.id),
                    )
                  }
                />
                {t.name}
                {!t.is_active ? " (неактивний)" : ""}
              </label>
            ))}
        </fieldset>
      ))}
    </div>
  );
}
export function VideoClassificationEditor({
  ids,
  data,
  onClose,
  onSaved,
}: {
  ids: string[];
  data: Taxonomy;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const bulk = ids.length > 1,
    row = bulk ? undefined : data.classifications.find((c) => c.video_id === ids[0]);
  const [category, setCategory] = useState(bulk ? "__keep" : row?.category_id || ""),
    [format, setFormat] = useState(bulk ? "__keep" : row?.format_id || "");
  const [tags, setTags] = useState<string[]>(
      bulk ? [] : data.relations.filter((r) => r.video_id === ids[0]).map((r) => r.tag_id),
    ),
    [tagMode, setTagMode] = useState("tags_add");
  const [wow, setWow] = useState(row?.wow_score?.toString() || ""),
    [applyWow, setApplyWow] = useState(!bulk),
    [caseId, setCaseId] = useState(row?.case_id || ""),
    [review, setReview] = useState(bulk ? "__keep" : row?.review_status || "needs_classification"),
    [note, setNote] = useState(row?.evidence || "");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [changed, setChanged] = useState(false);
  const close = () => {
    if (!busy && (!changed || confirm("Відхилити незбережену класифікацію?"))) onClose();
  };
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent className="admin-dialog taxonomy-dialog">
        <DialogTitle>
          {bulk ? `Класифікація ${ids.length} відео` : "Класифікація відео"}
        </DialogTitle>
        <DialogDescription>
          Категорія організовує бібліотеку. Теги описують зміст; формат — спосіб подання. Порядок
          ефіру не змінюється.
        </DialogDescription>
        <form
          className="editor-form"
          onChange={() => setChanged(true)}
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const patch: ClassificationPatch = {};
              if (category !== "__keep") patch.category_id = category || null;
              if (format !== "__keep") patch.format_id = format || null;
              if (applyWow) patch.wow_score = wow === "" ? null : Number(wow);
              if (review !== "__keep")
                patch.review_status = review as "classified" | "needs_classification";
              if (!bulk) {
                patch.case_id = caseId || null;
                patch.evidence = note;
                patch.tags_replace = tags;
              } else if (tagMode === "tags_remove") patch.tags_remove = tags;
              else patch.tags_add = tags;
              await classifyVideos(ids, patch);
              await onSaved();
              onClose();
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <label>
            Основна категорія
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {bulk && <option value="__keep">Не змінювати</option>}
              <option value="">Без категорії</option>
              {data.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {!c.is_active ? " (неактивна)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            Формат
            <select value={format} onChange={(e) => setFormat(e.target.value)}>
              {bulk && <option value="__keep">Не змінювати</option>}
              <option value="">Без формату</option>
              {data.formats.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Статус класифікації
            <select value={review} onChange={(e) => setReview(e.target.value)}>
              {bulk && <option value="__keep">Не змінювати</option>}
              <option value="needs_classification">Потребує класифікації</option>
              <option value="classified">Класифіковано за перевіреними відомостями</option>
            </select>
          </label>
          {bulk && (
            <label>
              <input
                type="checkbox"
                checked={applyWow}
                onChange={(e) => setApplyWow(e.target.checked)}
              />
              Змінити WOW-оцінку
            </label>
          )}
          <label>
            WOW (0–100, необов’язково)
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              disabled={!applyWow}
              value={wow}
              onChange={(e) => setWow(e.target.value)}
            />
            <small>Не впливає на поточний ефір.</small>
          </label>
          {!bulk && (
            <>
              <label>
                ID кейсу (UUID, необов’язково)
                <input value={caseId} onChange={(e) => setCaseId(e.target.value)} />
              </label>
              <label>
                Підстава / примітка
                <textarea maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
            </>
          )}
          {bulk && (
            <label>
              Дія з тегами
              <select value={tagMode} onChange={(e) => setTagMode(e.target.value)}>
                <option value="tags_add">Додати вибрані теги</option>
                <option value="tags_remove">Прибрати вибрані теги</option>
              </select>
            </label>
          )}
          <TaxonomyTagPicker
            data={data}
            value={tags}
            onChange={(value) => {
              setTags(value);
              setChanged(true);
            }}
          />
          {error && (
            <p role="alert" className="error-banner">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <button className="button" type="button" disabled={busy} onClick={close}>
              Скасувати
            </button>
            <button className="button primary" disabled={busy}>
              Зберегти класифікацію
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
