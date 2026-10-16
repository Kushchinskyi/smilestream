import { useEffect, useState } from "react";
import { toast } from "sonner";
import { readAudio, validateAudio, DEFAULT_AUDIO } from "@/lib/audio-settings";
import type { Video } from "@/lib/backend";
import { fetchAudio, writeAudio } from "@/lib/playback-api";

export function AudioSettingsPanel({ videos }: { videos: Video[] }) {
  const [settings, setSettings] = useState(DEFAULT_AUDIO);
  const [urls, setUrls] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    setLoading(true);
    setError("");
    fetchAudio(controller.signal)
      .then((s) => {
        if (alive) {
          setSettings(s);
          setUrls(s.musicUrls.join("\n"));
        }
      })
      .catch(() => {
        if (alive)
          setError(
            "Не вдалося завантажити налаштування. Перевірте мережу та застосування міграції.",
          );
      })
      .finally(() => {
        clearTimeout(timeout);
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [reload]);
  async function save() {
    const musicUrls = urls
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    let draft;
    try {
      draft = validateAudio({ ...settings, musicUrls });
    } catch (error) {
      toast.error((error as Error).message);
      return;
    }
    try {
      setSaving(true);
      await writeAudio(draft);
      toast.success("Налаштування збережено для всіх ТВ. Оновлення приблизно через 10 секунд.");
    } catch {
      toast.error(
        "Не вдалося підтвердити збереження. Перевірте мережу, права адміністратора та міграцію; перечитайте налаштування.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="mt-8 space-y-4 rounded-xl border bg-card p-6">
      <h2 className="text-xl font-semibold">Музика та звук ТВ</h2>
      <p>
        Налаштування зберігаються централізовано та автоматично застосовуються на відкритих ТВ
        приблизно через 10 секунд. Імпорт змінює лише чернетку до натискання «Зберегти звук».
      </p>
      {loading && <p>Завантаження…</p>}
      {error && <p role="alert">{error}</p>}
      <button
        disabled={loading || saving}
        className="rounded border px-4 py-2"
        onClick={() => setReload((n) => n + 1)}
      >
        Перечитати з сервера (замінити чернетку)
      </button>
      <fieldset disabled={loading || saving || !!error} className="space-y-4">
        <label className="block">
          Музика: прямі HTTPS URL MP3/AAC, по одному в рядку
          <textarea
            className="mt-2 block w-full rounded border p-2"
            value={urls}
            onChange={(e) => setUrls(e.target.value)}
          />
        </label>
        {(["musicVolume", "videoVolume", "duckVolume"] as const).map((key, i) => (
          <label className="block" key={key}>
            {
              [
                "Гучність музики",
                "Гучність оригінального звуку",
                "Частка гучності музики під час оригінального звуку",
              ][i]
            }
            : {Math.round(settings[key] * 100)}%
            <input
              className="ml-4"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings[key]}
              onChange={(e) => setSettings({ ...settings, [key]: Number(e.target.value) })}
            />
          </label>
        ))}
        <p>Відтворювати оригінальний звук у роликах (інші ролики без звуку):</p>
        {videos.map((v) => (
          <label key={v.id} className="block">
            <input
              type="checkbox"
              checked={settings.originalIds.includes(v.id)}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  originalIds: e.target.checked
                    ? [...settings.originalIds, v.id]
                    : settings.originalIds.filter((id) => id !== v.id),
                })
              }
            />{" "}
            {v.title}
          </label>
        ))}
        <button className="rounded border px-4 py-2" onClick={save}>
          {saving ? "Збереження…" : "Зберегти звук"}
        </button>{" "}
        <button
          className="rounded border px-4 py-2"
          onClick={() => {
            const url = URL.createObjectURL(
              new Blob(
                [
                  JSON.stringify({
                    ...settings,
                    musicUrls: urls
                      .split(/\r?\n/)
                      .map((s) => s.trim())
                      .filter(Boolean),
                  }),
                ],
                { type: "application/json" },
              ),
            );
            const a = document.createElement("a");
            a.href = url;
            a.download = "smile-audio.json";
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}
        >
          Експорт
        </button>
        <label className="block">
          Імпорт налаштувань{" "}
          <input
            type="file"
            accept="application/json"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                if (file.size > 2 * 1024 * 1024) throw new Error("Файл перевищує 2 МБ");
                const s = validateAudio(JSON.parse(await file.text()));
                setSettings(s);
                setUrls(s.musicUrls.join("\n"));
              } catch (error) {
                toast.error((error as Error).message || "Некоректний JSON");
              }
            }}
          />
        </label>
        <button
          className="rounded border px-4 py-2"
          onClick={() => {
            const s = readAudio();
            setSettings(s);
            setUrls(s.musicUrls.join("\n"));
          }}
        >
          Імпортувати попередні локальні налаштування в чернетку
        </button>
      </fieldset>
    </section>
  );
}
