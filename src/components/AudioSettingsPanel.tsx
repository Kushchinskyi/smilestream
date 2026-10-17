import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  Music2,
  Volume2,
  AudioLines,
  Plus,
  Play,
  Square,
  Trash2,
  ArrowUp,
  ArrowDown,
  Save,
} from "lucide-react";
import type { AudioSettings } from "@/lib/audio-settings";
import { isMusicUrl, MAX_MUSIC_URLS } from "@/lib/audio-settings";
type Props = {
  settings: AudioSettings;
  onChange: (s: AudioSettings) => void;
  labels: Record<string, string>;
  onLabels: (labels: Record<string, string>) => void;
  onSave: () => void;
  saving: boolean;
  dirty: boolean;
  error: string;
};
export function AudioSettingsPanel({
  settings,
  onChange,
  labels,
  onLabels,
  onSave,
  saving,
  dirty,
  error,
}: Props) {
  const audio = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    const node = audio.current;
    return () => {
      node?.pause();
      node?.removeAttribute("src");
      node?.load();
    };
  }, []);
  const [preview, setPreview] = useState<number | null>(null),
    [previewError, setPreviewError] = useState("");
  const lastLevels = useRef({ musicVolume: 0.35, videoVolume: 1 });
  function updateTrack(index: number, url: string) {
    if (preview === index) {
      audio.current?.pause();
      setPreview(null);
    }
    const urls = [...settings.musicUrls],
      previous = urls[index]!;
    urls[index] = url;
    onChange({ ...settings, musicUrls: urls });
    if (labels[previous]) {
      const next = { ...labels, [url]: labels[previous]! };
      delete next[previous];
      onLabels(next);
    }
  }
  function move(index: number, delta: number) {
    const urls = [...settings.musicUrls],
      next = index + delta;
    if (next < 0 || next >= urls.length) return;
    [urls[index], urls[next]] = [urls[next]!, urls[index]!];
    onChange({ ...settings, musicUrls: urls });
    setPreview(null);
    audio.current?.pause();
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">АТМОСФЕРА КЛІНІКИ</p>
          <h1>Музика та звук</h1>
          <p>Незалежні канали. Спокійний фон. Чіткий оригінальний звук.</p>
        </div>
        <span className={`save-state ${dirty ? "pending" : ""}`} role="status">
          {saving ? "Збереження…" : error ? "Помилка" : dirty ? "Зміни не збережено" : "Збережено"}
        </span>
      </div>
      <div className="volume-grid">
        {(
          [
            {
              key: "musicVolume",
              title: "Фонова музика",
              description: "Постійний музичний супровід між усіма роликами.",
              Icon: Music2,
            },
            {
              key: "videoVolume",
              title: "Оригінальний звук",
              description: "Гучність роликів, для яких увімкнено оригінальний звук.",
              Icon: Volume2,
            },
            {
              key: "duckVolume",
              title: "Приглушення музики",
              description:
                "Частка фонової гучності під час звуку відео. 0% — тиша, 100% — без приглушення.",
              Icon: AudioLines,
            },
          ] as const
        ).map(({ key, title, description, Icon }) => (
          <section className="panel volume-card" key={key}>
            <div className="volume-heading">
              <span className="icon-tile">
                <Icon size={22} />
              </span>
              <output>
                {Math.round(settings[key] * 100)}
                <small>%</small>
              </output>
            </div>
            <h2>{title}</h2>
            <p>{description}</p>
            <input
              aria-label={title}
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings[key]}
              style={{ "--level": `${settings[key] * 100}%` } as CSSProperties}
              onChange={(e) => onChange({ ...settings, [key]: Number(e.target.value) })}
            />
            <div className="range-labels">
              <span>0%</span>
              <span>100%</span>
            </div>
            {key !== "duckVolume" && (
              <button
                className="text-button"
                onClick={() => {
                  const value = settings[key];
                  if (value > 0) lastLevels.current[key] = value;
                  onChange({ ...settings, [key]: value > 0 ? 0 : lastLevels.current[key] });
                }}
              >
                {settings[key] === 0 ? "Увімкнути канал" : "Вимкнути канал"}
              </button>
            )}
          </section>
        ))}
      </div>
      <div className="info-banner">
        <AudioLines size={20} />
        <span>
          Музика 40% × приглушення 25% = 10% під час оригінального звуку. Дозвіл звуку вмикається
          окремо для кожного відео у відеотеці.
        </span>
      </div>
      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>
              Музична бібліотека <span className="count-badge">{settings.musicUrls.length}</span>
            </h2>
            <p>
              Зміни залишаються чернеткою до збереження. Прослуховування — лише на цьому пристрої.
            </p>
          </div>
          <button
            className="button secondary"
            disabled={settings.musicUrls.length >= MAX_MUSIC_URLS}
            onClick={() => onChange({ ...settings, musicUrls: [...settings.musicUrls, ""] })}
          >
            <Plus size={17} />
            Додати композицію
          </button>
        </div>
        <audio
          ref={audio}
          preload="none"
          onError={() => {
            setPreviewError("Не вдалося відтворити файл. Перевірте URL, формат і мережу.");
            setPreview(null);
          }}
          onEnded={() => setPreview(null)}
        />
        {settings.musicUrls.length === 0 ? (
          <div className="empty-state">
            <Music2 size={32} />
            <h3>Ваша музична бібліотека</h3>
            <p>Додайте першу композицію за прямим HTTPS-посиланням.</p>
          </div>
        ) : (
          <ol className="track-list">
            {settings.musicUrls.map((url, index) => (
              <li key={index} className="track-row">
                <span className="track-number">{String(index + 1).padStart(2, "0")}</span>
                <button
                  className="icon-button"
                  aria-label={
                    preview === index
                      ? "Зупинити прослуховування"
                      : `Прослухати композицію ${index + 1}`
                  }
                  disabled={!isMusicUrl(url)}
                  onClick={() => {
                    setPreviewError("");
                    if (preview === index) {
                      audio.current?.pause();
                      setPreview(null);
                      return;
                    }
                    audio.current!.src = url;
                    setPreview(index);
                    void audio.current!.play().catch(() => {
                      setPreviewError("Не вдалося запустити прослуховування.");
                      setPreview(null);
                    });
                  }}
                >
                  {preview === index ? <Square size={16} /> : <Play size={16} />}
                </button>
                <div className="track-fields">
                  <input
                    aria-label={`Назва композиції ${index + 1}`}
                    maxLength={160}
                    placeholder={`Композиція ${index + 1} — вкажіть назву`}
                    value={labels[url] || ""}
                    onChange={(e) => onLabels({ ...labels, [url]: e.target.value })}
                  />
                  <input
                    aria-label={`URL композиції ${index + 1}`}
                    type="url"
                    placeholder="https://…/music.mp3"
                    value={url}
                    onChange={(e) => updateTrack(index, e.target.value)}
                  />
                  {url && !isMusicUrl(url) && (
                    <span className="field-error">Потрібне коректне HTTPS-посилання</span>
                  )}
                </div>
                <div className="row-actions">
                  <button
                    className="icon-button"
                    aria-label={`Підняти композицію ${index + 1}`}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp size={16} />
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Опустити композицію ${index + 1}`}
                    disabled={index === settings.musicUrls.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown size={16} />
                  </button>
                  <button
                    className="icon-button danger"
                    aria-label={`Прибрати композицію ${index + 1}`}
                    onClick={() => {
                      if (!confirm("Прибрати композицію з чернетки?")) return;
                      audio.current?.pause();
                      setPreview(null);
                      onChange({
                        ...settings,
                        musicUrls: settings.musicUrls.filter((_, i) => i !== index),
                      });
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
        {previewError && (
          <p role="alert" className="error-banner">
            {previewError}
          </p>
        )}
      </section>
      <div className="save-bar">
        <div>
          <strong>{dirty ? "Є незбережені зміни" : "Усі зміни збережено"}</strong>
          <p>Телевізори отримають налаштування приблизно за 10 секунд.</p>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <button className="button primary" disabled={!dirty || saving} onClick={onSave}>
          <Save size={18} />
          {saving ? "Збереження…" : "Зберегти звук"}
        </button>
      </div>
    </>
  );
}
