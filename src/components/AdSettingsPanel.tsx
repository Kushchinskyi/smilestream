import { useEffect, useState } from "react";
import { fetchAdSettings, writeAdSettings } from "@/lib/ad-api";
import { DEFAULT_ADS, type AdSettings } from "@/lib/ad-scheduler";
import { useUnsaved } from "@/hooks/use-unsaved";
import { integrationAdClockLabel } from "@/lib/ad-clock";
export function AdSettingsPanel({ onDirtyChange }: { onDirtyChange?: (dirty: boolean) => void }) {
  const [draft, setDraft] = useState<AdSettings>(DEFAULT_ADS),
    [saved, setSaved] = useState<AdSettings>(DEFAULT_ADS);
  const [loading, setLoading] = useState(true),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const [ready, setReady] = useState(false),
    [retry, setRetry] = useState(0);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  useUnsaved(dirty);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError("");
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), 12000);
    fetchAdSettings(controller.signal)
      .then((settings) => {
        if (mounted) {
          setDraft(settings);
          setSaved(settings);
          setReady(true);
        }
      })
      .catch(() => {
        if (mounted)
          setError("Налаштування недоступні. Перевірте мережу та міграцію ad_playback_settings.");
      })
      .finally(() => {
        clearTimeout(timer);
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
      controller.abort();
      clearTimeout(timer);
    };
  }, [retry]);
  return (
    <section className="panel ad-settings">
      {integrationAdClockLabel && (
        <p className="info-banner">
          {integrationAdClockLabel}. Збережений інтервал не змінюється; прискорення діє лише в
          ізольованій локальній збірці.
        </p>
      )}
      <div className="panel-heading">
        <div>
          <h2>Рекламні блоки</h2>
          <p>
            {ready
              ? `Збережено: ${saved.enabled ? "Увімкнено" : "Вимкнено"} · ${saved.interval_minutes} хв · ${saved.block_count || "Усі"} роликів`
              : "Збережені налаштування ще не прочитано"}
          </p>
        </div>
        <span className="save-state" role="status">
          {loading
            ? "Завантаження…"
            : saving
              ? "Збереження…"
              : error
                ? "Помилка"
                : dirty
                  ? "Чернетка — не збережено"
                  : "Збережено"}
        </span>
      </div>
      <fieldset disabled={loading || saving || !ready} className="ad-settings-fields">
        <label>
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
          />{" "}
          Увімкнути рекламу
        </label>
        <label>
          Інтервал
          <select
            value={draft.interval_minutes}
            onChange={(e) => setDraft({ ...draft, interval_minutes: Number(e.target.value) })}
          >
            {[15, 20, 30, 45, 60].map((n) => (
              <option key={n} value={n}>
                {n} хв
              </option>
            ))}
          </select>
        </label>
        <label>
          Роликів у блоці
          <select
            value={draft.block_count}
            onChange={(e) => setDraft({ ...draft, block_count: Number(e.target.value) })}
          >
            {[1, 2, 3, 0].map((n) => (
              <option key={n} value={n}>
                {n || "Усі активні"}
              </option>
            ))}
          </select>
        </label>
      </fieldset>
      <p>
        Послідовна ротація за порядком бібліотеки. Блок починається після завершення основного
        ролика. Кожен ТВ рахує власний час активного перегляду; офлайн, пауза й фон скидають відлік.
        Зміни інтервалу скидають відлік; вимкнення завершує поточну рекламу. Ліміт — 1000 активних
        рекламних роликів. Перевищення відхиляється без часткового оновлення ТВ.
      </p>
      <p>
        Останній / наступний показ: <strong>Дані недоступні</strong> — телеметрія окремих ТВ ще не
        збирається.
      </p>
      {error && (
        <div role="alert" className="error-banner">
          {error}
          {!ready && (
            <button className="button secondary" onClick={() => setRetry((n) => n + 1)}>
              Повторити
            </button>
          )}
        </div>
      )}
      <button
        className="button primary"
        disabled={loading || saving || !dirty || !ready}
        onClick={async () => {
          setSaving(true);
          setError("");
          try {
            const settings = await writeAdSettings(draft);
            setSaved(settings);
          } catch {
            setError("Не збережено. Перевірте мережу та права адміністратора.");
          } finally {
            setSaving(false);
          }
        }}
      >
        Зберегти рекламу
      </button>
    </section>
  );
}
