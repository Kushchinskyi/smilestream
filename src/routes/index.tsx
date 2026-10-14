import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dental Media Network — безкоштовне ТБ для стоматологій" },
      { name: "description", content: "Безкоштовне стоматологічне телебачення для зон очікування клінік України. Плейлист, екрани, простий запуск на Smart TV." },
      { property: "og:title", content: "Dental Media Network" },
      { property: "og:description", content: "Безкоштовне стоматологічне ТБ для клінік України." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const steps = [
  { n: "01", t: "Відкрийте /tv на телевізорі", d: "Вбудований браузер Smart TV, без встановлення застосунків." },
  { n: "02", t: "Натисніть «Запустити»", d: "Відео грає по колу, без звуку за замовчуванням, у повний екран." },
  { n: "03", t: "Керуйте плейлистом", d: "Адміністратор додає, впорядковує й вимикає ролики з панелі." },
];

function Index() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main>
        <section className="mx-auto max-w-6xl px-6 pb-20 pt-24">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
            MVP · пілот у клініках України
          </p>
          <h1 className="max-w-4xl text-4xl font-semibold leading-tight md:text-6xl">
            Безкоштовне телебачення для зон очікування стоматологій
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            Dental Media Network показує спокійний відеоконтент на екранах у кабінетах і на ресепшн.
            Без YouTube, без сторонньої реклами, з повним контролем плейлиста.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button asChild size="lg" variant="teal"><Link to="/tv">Відкрити ТВ-плеєр</Link></Button>
            <Button asChild size="lg" variant="outline"><Link to="/admin">Панель керування</Link></Button>
          </div>
        </section>

        <section className="border-y bg-card">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-16 md:grid-cols-3">
            {steps.map((s) => (
              <div key={s.n}>
                <div className="font-display text-sm text-teal">{s.n}</div>
                <h3 className="mt-3 text-lg font-semibold">{s.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-16">
          <div className="rounded-2xl bg-ink p-10 text-ink-foreground">
            <h2 className="text-2xl font-semibold">Що далі</h2>
            <ul className="mt-6 grid gap-3 text-sm opacity-80 md:grid-cols-2">
              <li>· Підключення телевізорів за кодом (заплановано)</li>
              <li>· Реальний статус екранів через heartbeat (заплановано)</li>
              <li>· Планувальник рекламних блоків (заплановано)</li>
              <li>· Власний контент клініки замість тестових відео</li>
            </ul>
          </div>
        </section>
      </main>
      <footer className="border-t py-8 text-center text-xs text-muted-foreground">
        © Dental Media Network · Тестові відео: Blender Foundation (CC BY), будуть замінені власним контентом
      </footer>
    </div>
  );
}
