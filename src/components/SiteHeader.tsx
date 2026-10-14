import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { backendConfigured } from "@/lib/backend";
import { Button } from "@/components/ui/button";

export function SiteHeader() {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    if (!backendConfigured) return;
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setEmail(s?.user?.email ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <header className="border-b bg-card/80">
      {!backendConfigured && (
        <div className="bg-warning px-4 py-2 text-center text-sm text-warning-foreground">
          Демо-режим: сервер не налаштований. Адміністративні операції вимкнено.
        </div>
      )}
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2 font-display text-sm font-semibold">
          <span className="inline-block h-3 w-3 rounded-full bg-teal" />
          Dental Media Network
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link to="/tv" className="rounded-md px-3 py-2 hover:bg-secondary">ТВ-плеєр</Link>
          <Link to="/admin" className="rounded-md px-3 py-2 hover:bg-secondary" activeProps={{ className: "bg-secondary" }}>Плейлист</Link>
          <Link to="/screens" className="rounded-md px-3 py-2 hover:bg-secondary" activeProps={{ className: "bg-secondary" }}>Екрани</Link>
          {email ? (
            <Button
              variant="outline"
              size="sm"
              className="ml-2"
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.replace("/auth");
              }}
            >
              Вийти
            </Button>
          ) : (
            <Button asChild size="sm" className="ml-2">
              <Link to="/auth">Увійти</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
