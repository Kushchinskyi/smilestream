import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { backendConfigured } from "@/lib/backend";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Вхід — Dental Media Network" },
      { name: "description", content: "Вхід до панелі керування Dental Media Network." },
      { property: "og:title", content: "Вхід — Dental Media Network" },
      { property: "og:description", content: "Вхід до панелі керування." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const nav = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) setMsg("Не вдалося увійти: " + error.message);
      else nav({ to: "/admin" });
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin + "/admin" },
      });
      setMsg(error ? "Помилка: " + error.message : "Перевірте пошту та підтвердіть адресу, потім увійдіть.");
    }
    setBusy(false);
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-sm px-6 py-20">
        <h1 className="text-2xl font-semibold">{mode === "in" ? "Вхід" : "Реєстрація"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Перший зареєстрований користувач отримує права адміністратора. Інші облікові записи не мають доступу до змін.
        </p>
        {!backendConfigured ? (
          <p className="mt-8 rounded-lg bg-warning p-4 text-sm text-warning-foreground">Демо-режим: вхід недоступний.</p>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw">Пароль</Label>
              <Input id="pw" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {mode === "in" ? "Увійти" : "Зареєструватися"}
            </Button>
            {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
            <button type="button" className="text-sm text-primary underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>
              {mode === "in" ? "Немає акаунта? Зареєструватися" : "Вже є акаунт? Увійти"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
