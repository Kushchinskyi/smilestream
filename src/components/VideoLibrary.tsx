import { useState } from "react";
import {
  Plus,
  Search,
  LayoutGrid,
  List,
  Film,
  Volume2,
  VolumeX,
  ArrowUp,
  ArrowDown,
  Pencil,
  Play,
} from "lucide-react";
import type { Video } from "@/lib/backend";
import { formatDuration } from "@/lib/backend";
import { MediaCover } from "./MediaCover";
import { CATEGORIES, selectVideos, type MediaMetadata } from "@/lib/admin-library";
type Props = {
  advertisement?: boolean;
  videos: Video[];
  metadata: MediaMetadata[];
  originalIds: string[];
  busy: boolean;
  onEdit: (v: Video | null) => void;
  onPreview: (v: Video) => void;
  onActive: (ids: string[], active: boolean) => void;
  onOriginal: (ids: string[], enabled: boolean) => void;
  onReorder: (ids: string[]) => void;
};
export function VideoLibrary({
  videos,
  metadata,
  originalIds,
  busy,
  onEdit,
  onPreview,
  onActive,
  onOriginal,
  onReorder,
  advertisement = false,
}: Props) {
  const [query, setQuery] = useState(""),
    [filter, setFilter] = useState("all"),
    [category, setCategory] = useState("all"),
    [view, setView] = useState("list"),
    [selected, setSelected] = useState<string[]>([]),
    [page, setPage] = useState(0),
    [drag, setDrag] = useState<string | null>(null);
  const filtered = selectVideos(videos, query, filter, category, metadata),
    visible = filtered.slice(page * 25, (page + 1) * 25);
  function move(id: string, delta: number) {
    const ids = videos.map((v) => v.id),
      index = ids.indexOf(id),
      next = index + delta;
    if (next < 0 || next >= ids.length) return;
    [ids[index], ids[next]] = [ids[next]!, ids[index]!];
    onReorder(ids);
  }
  function drop(target: string) {
    if (!drag || drag === target) return;
    const ids = videos.map((v) => v.id).filter((id) => id !== drag);
    ids.splice(ids.indexOf(target), 0, drag);
    onReorder(ids);
    setDrag(null);
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">КОНТЕНТ ДЛЯ ВАШИХ ПАЦІЄНТІВ</p>
          <h1>
            {advertisement ? "Рекламна бібліотека" : "Відеотека"}{" "}
            <span className="count-badge">{videos.length}</span>
          </h1>
          <p>Керуйте порядком, активністю та оригінальним звуком роликів.</p>
        </div>
        <button className="button primary" onClick={() => onEdit(null)}>
          <Plus size={18} />
          {advertisement ? "Додати рекламу" : "Додати відео"}
        </button>
      </div>
      <section className="panel library-panel">
        <div className="library-toolbar">
          <label className="search-box">
            <Search size={18} />
            <input
              aria-label="Пошук відео"
              placeholder="Знайти відео…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
            />
          </label>
          {!advertisement && (
            <select
              aria-label="Категорія"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(0);
              }}
            >
              <option value="all">Усі категорії</option>
              {Object.entries(CATEGORIES).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          )}
          <select
            aria-label="Активність"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">Усі статуси</option>
            <option value="active">Активні</option>
            <option value="inactive">Неактивні</option>
          </select>
          <div className="view-switch">
            <button
              aria-label="Список"
              aria-pressed={view === "list"}
              className="icon-button"
              onClick={() => setView("list")}
            >
              <List size={18} />
            </button>
            <button
              aria-label="Картки"
              aria-pressed={view === "cards"}
              className="icon-button"
              onClick={() => setView("cards")}
            >
              <LayoutGrid size={18} />
            </button>
          </div>
        </div>
        {selected.length > 0 && (
          <div className="bulk-bar">
            <strong>Обрано: {selected.length}</strong>
            <button onClick={() => onActive(selected, true)}>Активувати</button>
            <button onClick={() => onActive(selected, false)}>Вимкнути</button>
            <button onClick={() => onOriginal(selected, true)}>Зі звуком</button>
            <button onClick={() => onOriginal(selected, false)}>Без звуку</button>
            <button onClick={() => setSelected([])}>Скасувати вибір</button>
          </div>
        )}
        {filtered.length === 0 ? (
          <div className="empty-state">
            <Film size={36} />
            <h3>{videos.length ? "Нічого не знайдено" : "Почніть із першого відео"}</h3>
            <p>
              {videos.length
                ? "Спробуйте змінити пошук або фільтри."
                : advertisement
                  ? "Додайте MP4 до окремої рекламної бібліотеки та ввімкніть рекламні блоки."
                  : "Додайте пряме HTTPS-посилання на MP4. Активні відео з’являться на телевізорах."}
            </p>
          </div>
        ) : (
          <div className={view === "cards" ? "video-grid" : "video-list"}>
            <div className="video-list-head">
              <span>ВІДЕО</span>
              <span>СТАТУС / ЗВУК</span>
              <span>ПОРЯДОК / ДІЇ</span>
            </div>
            {visible.map((v) => {
              const original = originalIds.includes(v.id),
                meta = metadata.find((m) => m.kind === "video" && m.source_key === v.id);
              return (
                <article
                  className="video-row"
                  key={v.id}
                  draggable={!busy && query === "" && category === "all" && filter === "all"}
                  onDragStart={() => setDrag(v.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => drop(v.id)}
                >
                  <div className="video-identity">
                    <input
                      type="checkbox"
                      aria-label={`Обрати ${v.title}`}
                      checked={selected.includes(v.id)}
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...selected, v.id]
                            : selected.filter((id) => id !== v.id),
                        )
                      }
                    />
                    <button
                      className="video-thumb"
                      aria-label={`Переглянути ${v.title}`}
                      onClick={() => onPreview(v)}
                    >
                      <MediaCover key={meta?.cover_url || "empty"} url={meta?.cover_url || ""} />
                      <span>
                        <Play size={13} />
                        {formatDuration(v.duration_seconds)}
                      </span>
                    </button>
                    <div className="video-title">
                      <strong>{v.title}</strong>
                      <small>
                        {CATEGORIES[(meta?.category || "other") as keyof typeof CATEGORIES]}
                        {v.is_test ? " · Тестове відео" : ""}
                      </small>
                      <span title={v.url}>{v.url}</span>
                    </div>
                  </div>
                  <div className="video-status">
                    <button
                      disabled={busy}
                      className={`pill ${v.is_active ? "active" : ""}`}
                      onClick={() => onActive([v.id], !v.is_active)}
                    >
                      {v.is_active ? "Активний" : "Неактивний"}
                    </button>
                    <button
                      disabled={busy}
                      className="sound-button"
                      aria-label={`Оригінальний звук: ${v.title}`}
                      aria-pressed={original}
                      onClick={() => onOriginal([v.id], !original)}
                    >
                      {original ? <Volume2 size={16} /> : <VolumeX size={16} />}
                      <span>{original ? "Зі звуком" : "Без звуку"}</span>
                    </button>
                  </div>
                  <div className="row-actions">
                    <span className="order-number">{v.sort_order}</span>
                    <button
                      className="icon-button"
                      aria-label={`Підняти ${v.title}`}
                      disabled={busy || videos[0]?.id === v.id}
                      onClick={() => move(v.id, -1)}
                    >
                      <ArrowUp size={15} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Опустити ${v.title}`}
                      disabled={busy || videos[videos.length - 1]?.id === v.id}
                      onClick={() => move(v.id, 1)}
                    >
                      <ArrowDown size={15} />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Редагувати ${v.title}`}
                      onClick={() => onEdit(v)}
                    >
                      <Pencil size={17} />
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
        <div className="list-footer">
          <label>
            <input
              type="checkbox"
              checked={visible.length > 0 && visible.every((v) => selected.includes(v.id))}
              onChange={(e) =>
                setSelected(
                  e.target.checked
                    ? [...new Set([...selected, ...visible.map((v) => v.id)])]
                    : selected.filter((id) => !visible.some((v) => v.id === id)),
                )
              }
            />{" "}
            Обрати сторінку
          </label>
          <span>Знайдено {filtered.length} · по 25 на сторінці</span>
          <button
            className="icon-button"
            aria-label="Попередня сторінка"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
          >
            ←
          </button>
          <button
            className="icon-button"
            aria-label="Наступна сторінка"
            disabled={(page + 1) * 25 >= filtered.length}
            onClick={() => setPage(page + 1)}
          >
            →
          </button>
        </div>
      </section>
      <p className="subtle-note">
        Перетягніть рядок, щоб змінити порядок, або скористайтеся стрілками.{" "}
        {advertisement
          ? "Рекламна бібліотека не змінює поточну трансляцію."
          : "Поточне відео на ТВ завершиться перед оновленням черги."}
      </p>
    </>
  );
}
