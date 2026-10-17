import { useEffect, useState } from "react";
import { Monitor, Plus, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUnsaved } from "@/hooks/use-unsaved";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
type Screen = {
  id: string;
  name: string;
  diagonal_inches: number | null;
  last_heartbeat_at: string | null;
};
export function ScreenLibrary() {
  const [rows, setRows] = useState<Screen[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [editing, setEditing] = useState<Screen | null | undefined>(),
    [name, setName] = useState(""),
    [diagonal, setDiagonal] = useState(""),
    [busy, setBusy] = useState(false);
  useUnsaved(editing !== undefined);
  async function load() {
    setLoading(true);
    const r = await supabase
      .from("screens")
      .select("id,name,diagonal_inches,last_heartbeat_at")
      .order("created_at");
    if (r.error) setError("Не вдалося завантажити екрани. Перевірте мережу й права.");
    else {
      setRows(r.data);
      setError("");
    }
    setLoading(false);
  }
  useEffect(() => {
    void load();
  }, []);
  function edit(row: Screen | null) {
    setEditing(row);
    setName(row?.name || "");
    setDiagonal(row?.diagonal_inches?.toString() || "");
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">ВАША МЕРЕЖА</p>
          <h1>Екрани</h1>
          <p>Облік телевізорів і місць трансляції у клініці.</p>
        </div>
        <button className="button primary" onClick={() => edit(null)}>
          <Plus size={18} />
          Додати екран
        </button>
      </div>
      <div className="info-banner">
        <Monitor size={22} />
        <span>
          Відкрийте /tv у браузері телевізора. Безпечна прив’язка пристроїв і телеметрія ще не
          підключені: запис у цьому списку не означає, що ТВ онлайн.
        </span>
      </div>
      {error && (
        <p role="alert" className="error-banner">
          {error}
          <button onClick={() => void load()}>Повторити</button>
        </p>
      )}
      {loading ? (
        <div className="panel skeleton" aria-label="Завантаження екранів" />
      ) : error && rows.length === 0 ? (
        <div className="panel empty-state">Дані екранів недоступні. Повторіть завантаження.</div>
      ) : rows.length === 0 ? (
        <div className="panel empty-state">
          <Monitor size={40} />
          <h2>Додайте перший екран</h2>
          <p>Назвіть екран за кабінетом або зоною очікування.</p>
        </div>
      ) : (
        <div className="screen-grid">
          {rows.map((row) => (
            <section className="panel screen-card" key={row.id}>
              <span className="icon-tile">
                <Monitor size={28} />
              </span>
              <h2>{row.name}</h2>
              <p>{row.diagonal_inches ? `${row.diagonal_inches}″` : "Діагональ не вказана"}</p>
              <span className="pill">Статус: дані відсутні</span>
              <dl>
                <dt>Останній сигнал</dt>
                <dd>
                  {row.last_heartbeat_at
                    ? new Date(row.last_heartbeat_at).toLocaleString("uk-UA", {
                        timeZone: "Europe/Kyiv",
                      })
                    : "Дані відсутні"}
                </dd>
                <dt>Поточне відео</dt>
                <dd>Дані відсутні</dd>
              </dl>
              <div className="row-actions">
                <button className="button secondary" onClick={() => edit(row)}>
                  <Pencil size={15} />
                  Редагувати
                </button>
                <button
                  className="icon-button danger"
                  aria-label={`Видалити екран ${row.name}`}
                  onClick={async () => {
                    if (!confirm(`Видалити запис «${row.name}»?`)) return;
                    const r = await supabase.from("screens").delete().eq("id", row.id);
                    if (r.error) setError("Не вдалося видалити екран");
                    else await load();
                  }}
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </section>
          ))}
        </div>
      )}
      {editing !== undefined && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !busy && confirm("Закрити форму? Незбережені зміни буде втрачено."))
              setEditing(undefined);
          }}
        >
          <DialogContent className="admin-dialog">
            <DialogTitle>{editing ? "Редагувати екран" : "Новий екран"}</DialogTitle>
            <DialogDescription>
              Лише назва та діагональ. Налаштування прив’язки не змінюються.
            </DialogDescription>
            <form
              className="editor-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const inches = diagonal ? Number(diagonal) : null;
                if (
                  !name.trim() ||
                  name.length > 100 ||
                  (inches !== null && (!Number.isInteger(inches) || inches < 10 || inches > 200))
                ) {
                  setError("Перевірте назву та діагональ (10–200 дюймів)");
                  return;
                }
                setBusy(true);
                const value = { name: name.trim(), diagonal_inches: inches };
                const r = editing
                  ? await supabase.from("screens").update(value).eq("id", editing.id)
                  : await supabase.from("screens").insert(value);
                setBusy(false);
                if (r.error) setError("Не вдалося зберегти екран");
                else {
                  setEditing(undefined);
                  await load();
                }
              }}
            >
              <label>
                Назва
                <input
                  required
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                Діагональ, дюйми
                <input
                  type="number"
                  min="10"
                  max="200"
                  value={diagonal}
                  onChange={(e) => setDiagonal(e.target.value)}
                />
              </label>
              {error && (
                <p className="error-banner" role="alert">
                  {error}
                </p>
              )}
              <button className="button primary" disabled={busy}>
                {busy ? "Збереження…" : "Зберегти екран"}
              </button>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
