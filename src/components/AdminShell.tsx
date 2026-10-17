import type { ReactNode } from "react";
import {
  LayoutDashboard,
  Library,
  Music2,
  Monitor,
  Activity,
  Settings2,
  ArrowUpRight,
  LogOut,
  HeartPulse,
  Megaphone,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import "@/admin.css";
export const SECTIONS = [
  { id: "overview", label: "Огляд", icon: LayoutDashboard },
  { id: "videos", label: "Відеотека", icon: Library },
  { id: "ads", label: "Реклама", icon: Megaphone },
  { id: "audio", label: "Музика та звук", icon: Music2 },
  { id: "profiles", label: "Музичні профілі", icon: Music2 },
  { id: "screens", label: "Екрани", icon: Monitor },
  { id: "diagnostics", label: "Діагностика", icon: Activity },
  { id: "settings", label: "Налаштування", icon: Settings2 },
] as const;
export type AdminSection = (typeof SECTIONS)[number]["id"];
export function AdminShell({
  section,
  onNavigate,
  children,
}: {
  section: AdminSection;
  onNavigate: (s: AdminSection) => void;
  children: ReactNode;
}) {
  return (
    <div className="admin-app">
      <aside className="admin-sidebar">
        <a className="admin-brand" href="/admin">
          <span className="brand-mark">
            <HeartPulse size={24} />
          </span>
          <span>
            smile<span className="brand-accent">stream</span>
            <small>ПРОСТІР ВАШОЇ КЛІНІКИ</small>
          </span>
        </a>
        <p className="nav-caption">КЕРУВАННЯ ТРАНСЛЯЦІЄЮ</p>
        <nav aria-label="Адміністративні розділи">
          {SECTIONS.map((item) => (
            <button
              key={item.id}
              aria-current={section === item.id ? "page" : undefined}
              className={section === item.id ? "nav-item selected" : "nav-item"}
              onClick={() => onNavigate(item.id)}
            >
              <item.icon size={19} />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="status-dot" /> Централізоване керування
          <small>Зміни застосовуються на ТВ автоматично</small>
        </div>
        <a className="nav-item" href="/tv" target="_blank" rel="noreferrer">
          <Monitor size={18} />
          Відкрити ТВ-плеєр
          <ArrowUpRight size={16} />
        </a>
        <button
          className="nav-item"
          onClick={async () => {
            if (!confirm("Вийти з панелі керування? Незбережені зміни буде втрачено.")) return;
            await supabase.auth.signOut();
            location.assign("/auth");
          }}
        >
          <LogOut size={18} />
          Вийти
        </button>
      </aside>
      <div className="admin-workspace">
        <header className="admin-topbar">
          <span>
            Керування клінікою{" "}
            <span className="breadcrumb">/ {SECTIONS.find((s) => s.id === section)?.label}</span>
          </span>
          <span className="timezone">Europe/Kyiv</span>
        </header>
        <main className="admin-main">{children}</main>
        <footer className="admin-footer">
          Smile Stream · Керуйте контентом. Створюйте атмосферу.
        </footer>
      </div>
    </div>
  );
}
