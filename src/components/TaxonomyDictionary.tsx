import { useState } from "react";
import type { Video } from "@/lib/backend";
import { useTaxonomy } from "@/hooks/use-taxonomy";
import { saveCategory, saveTag, mergeTags } from "@/lib/video-taxonomy-api";
import { TAG_GROUPS, type VideoCategory, type VideoTag, type TagGroup } from "@/lib/video-taxonomy";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "./ui/dialog";
export function TaxonomyDictionary({ videos }: { videos: Video[] }) {
  const { data, error, refresh } = useTaxonomy();
  const [category, setCategory] = useState<Partial<VideoCategory> | null>(null),
    [tag, setTag] = useState<Partial<VideoTag> | null>(null),
    [aliasText, setAliasText] = useState(""),
    [group, setGroup] = useState("all"),
    [query, setQuery] = useState(""),
    [merge, setMerge] = useState<VideoTag | null>(null),
    [target, setTarget] = useState(""),
    [busy, setBusy] = useState(false),
    [failure, setFailure] = useState("");
  const currentVideos = new Set(videos.map((v) => v.id));
  async function mutate(action: () => Promise<void>) {
    setBusy(true);
    setFailure("");
    try {
      await action();
      setCategory(null);
      setTag(null);
      setMerge(null);
      await refresh();
    } catch (err) {
      setFailure((err as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <section className="panel">
        <h1>Класифікація відео</h1>
        <p role="status">{error || "Завантаження довідників…"}</p>
        <button className="button" onClick={() => void refresh()}>
          Повторити
        </button>
      </section>
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ОРГАНІЗАЦІЯ ВІДЕОТЕКИ</p>
          <h1>Категорії та теги</h1>
          <p>
            Категорії організовують бібліотеку. Теги описують зміст і не змінюють поточний ефір.
          </p>
        </div>
        <button className="button" onClick={() => void refresh()}>
          Оновити
        </button>
      </div>
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      <section className="panel taxonomy-dictionary">
        <h2>Основні категорії · {data.categories.length}</h2>
        <button
          className="button primary"
          onClick={() => {
            setFailure("");
            setCategory({
              name: "",
              slug: "",
              description: "",
              sort_order: data.categories.length + 1,
              is_active: true,
            });
          }}
        >
          Додати категорію
        </button>
        {data.categories.map((c) => (
          <article key={c.id}>
            <div>
              <strong>{c.name}</strong>
              <small>
                {" "}
                {
                  data.classifications.filter(
                    (v) => v.category_id === c.id && currentVideos.has(v.video_id),
                  ).length
                }{" "}
                відео · {c.slug} · порядок {c.sort_order}
                {!c.is_active ? " · неактивна" : ""}
              </small>
              <p>{c.description}</p>
            </div>
            <button
              className="button"
              onClick={() => {
                setFailure("");
                setCategory({ ...c });
              }}
            >
              Редагувати категорію {c.name}
            </button>
          </article>
        ))}
      </section>
      <section className="panel taxonomy-dictionary">
        <h2>Формати контенту</h2>
        <p>{data.formats.map((f) => f.name).join(" · ")}</p>
        <h2>Теги · {data.tags.length}</h2>
        <div className="taxonomy-filters">
          <label>
            Пошук тегу або синоніма
            <input value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <label>
            Група тегів
            <select value={group} onChange={(e) => setGroup(e.target.value)}>
              <option value="all">Усі групи</option>
              {Object.entries(TAG_GROUPS).map(([k, n]) => (
                <option key={k} value={k}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button
            className="button primary"
            onClick={() => {
              setFailure("");
              setTag({ name: "", slug: "", group_key: "direction", is_active: true });
              setAliasText("");
            }}
          >
            Додати тег
          </button>
        </div>
        {data.tags
          .filter(
            (t) =>
              (group === "all" || t.group_key === group) &&
              [t.name, ...t.aliases]
                .join(" ")
                .toLocaleLowerCase("uk")
                .includes(query.toLocaleLowerCase("uk")),
          )
          .map((t) => (
            <article key={t.id}>
              <div>
                <strong>{t.name}</strong>
                <small>
                  {" "}
                  {TAG_GROUPS[t.group_key]} ·{" "}
                  {
                    new Set(
                      data.relations
                        .filter((r) => r.tag_id === t.id && currentVideos.has(r.video_id))
                        .map((r) => r.video_id),
                    ).size
                  }{" "}
                  відео{!t.is_active ? " · неактивний" : ""}
                </small>
                <p>Синоніми: {t.aliases.join(", ") || "—"}</p>
              </div>
              <button
                className="button"
                onClick={() => {
                  setFailure("");
                  setTag({ ...t });
                  setAliasText(t.aliases.join(", "));
                }}
              >
                Редагувати тег {t.name}
              </button>
              <button
                className="button"
                onClick={() => {
                  setFailure("");
                  setMerge(t);
                  setTarget("");
                }}
              >
                Об’єднати тег {t.name}
              </button>
            </article>
          ))}
      </section>
      {(category || tag) && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !busy) {
              setCategory(null);
              setTag(null);
            }
          }}
        >
          <DialogContent className="admin-dialog">
            <DialogTitle>{category ? "Редактор категорії" : "Редактор тегу"}</DialogTitle>
            <DialogDescription>
              Slug — постійний ідентифікатор. Еквівалентні назви зберігайте як синоніми, а не як
              нові теги.
            </DialogDescription>
            <form
              className="editor-form"
              onSubmit={(e) => {
                e.preventDefault();
                void mutate(() =>
                  category
                    ? saveCategory(category)
                    : saveTag({
                        ...tag!,
                        aliases: aliasText
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      }),
                );
              }}
            >
              <label>
                Назва
                <input
                  required
                  maxLength={120}
                  value={(category || tag)!.name || ""}
                  onChange={(e) =>
                    category
                      ? setCategory({ ...category, name: e.target.value })
                      : setTag({ ...tag, name: e.target.value })
                  }
                />
              </label>
              <label>
                Slug
                <input
                  required
                  pattern="[a-z][a-z0-9-]{0,79}"
                  disabled={!!(category || tag)!.id}
                  value={(category || tag)!.slug || ""}
                  onChange={(e) =>
                    category
                      ? setCategory({ ...category, slug: e.target.value })
                      : setTag({ ...tag, slug: e.target.value })
                  }
                />
              </label>
              {category ? (
                <>
                  <label>
                    Опис
                    <textarea
                      maxLength={1000}
                      value={category.description || ""}
                      onChange={(e) => setCategory({ ...category, description: e.target.value })}
                    />
                  </label>
                  <label>
                    Порядок
                    <input
                      required
                      type="number"
                      step="1"
                      value={category.sort_order ?? 0}
                      onChange={(e) =>
                        setCategory({ ...category, sort_order: Number(e.target.value) })
                      }
                    />
                  </label>
                </>
              ) : (
                <>
                  <label>
                    Група
                    <select
                      value={tag!.group_key}
                      onChange={(e) => setTag({ ...tag, group_key: e.target.value as TagGroup })}
                    >
                      {Object.entries(TAG_GROUPS).map(([k, n]) => (
                        <option key={k} value={k}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Синоніми / англійські відповідники (через кому)
                    <textarea value={aliasText} onChange={(e) => setAliasText(e.target.value)} />
                  </label>
                </>
              )}
              <label>
                <input
                  type="checkbox"
                  checked={(category || tag)!.is_active ?? true}
                  onChange={(e) =>
                    category
                      ? setCategory({ ...category, is_active: e.target.checked })
                      : setTag({ ...tag, is_active: e.target.checked })
                  }
                />
                Активність
              </label>
              {failure && (
                <p role="alert" className="error-banner">
                  {failure}
                </p>
              )}
              <button className="button primary" disabled={busy}>
                Зберегти
              </button>
            </form>
          </DialogContent>
        </Dialog>
      )}
      {merge && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !busy) setMerge(null);
          }}
        >
          <DialogContent className="admin-dialog">
            <DialogTitle>Об’єднання тегів</DialogTitle>
            <DialogDescription>
              Зв’язки «{merge.name}» перейдуть до вибраного тегу тієї самої групи, без дублів. Назва
              й синоніми джерела збережуться як синоніми цілі.
            </DialogDescription>
            <label>
              Залишити тег
              <select value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="">Оберіть тег</option>
                {data.tags
                  .filter((t) => t.id !== merge.id && t.group_key === merge.group_key)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </label>
            {failure && <p role="alert">{failure}</p>}
            <button
              className="button primary"
              disabled={!target || busy}
              onClick={() => {
                if (confirm(`Об’єднати «${merge.name}» зі збереженням усіх зв’язків?`))
                  void mutate(() => mergeTags(merge.id, target));
              }}
            >
              Підтвердити об’єднання
            </button>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
