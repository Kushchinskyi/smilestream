import { useEffect, useState } from "react";
import { SiteHeader } from "./SiteHeader";
import { backendConfigured } from "@/lib/backend";
import { fetchAudio } from "@/lib/playback-api";
import { startPolling } from "@/lib/playback-sync";
import { musicLicenseView } from "@/lib/music-licenses";
import { MUSIC_LICENSES } from "@/data/music-licenses";

export function MusicLicensesPage() {
  const [urls, setUrls] = useState<string[] | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    if (!backendConfigured) {
      setUnavailable(true);
      return;
    }
    return startPolling(
      fetchAudio,
      (audio) => {
        setUrls(audio.musicUrls);
        setUnavailable(false);
      },
      () => setUnavailable(true),
    );
  }, []);
  const view = musicLicenseView(urls || [], MUSIC_LICENSES);
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-16">
        <p className="mb-4 text-sm font-semibold text-teal">Smile Stream · прозоре походження</p>
        <h1 className="text-3xl font-semibold md:text-5xl">Ліцензування музики</h1>
        <p className="mt-6 max-w-3xl text-lg text-muted-foreground">
          Ми добираємо інструментальне тло з документованими вільними правами, зокрема CC0. Нижче —
          записи, які зараз є в музичній бібліотеці Smile Stream. Завантажені кандидати, що ще не
          імпортовані, до цього переліку не потрапляють.
        </p>
        <section className="my-10 rounded-2xl border bg-card p-6 md:p-8">
          <h2 className="text-xl font-semibold">Що означає CC0 1.0</h2>
          <p className="mt-3 text-muted-foreground">
            Правовласник відмовляється від своїх авторських і суміжних прав у максимально
            дозволеному законом обсязі; передбачена також резервна публічна ліцензія. Це дозволяє
            копіювання, зберігання, поширення й комерційне використання в межах прав, якими він
            розпоряджається. CC0 не гарантує відсутності прав третіх осіб.
          </p>
          <a
            className="mt-4 inline-block underline"
            href="https://creativecommons.org/publicdomain/zero/1.0/legalcode.en"
          >
            Офіційний текст CC0 1.0 Universal
          </a>
        </section>
        <section aria-labelledby="catalog-title">
          <h2 id="catalog-title" className="text-2xl font-semibold">
            Музика в бібліотеці
          </h2>
          <div className="my-5 rounded-xl border bg-card p-5" role="status">
            {unavailable
              ? urls === null
                ? "Не вдалося перевірити поточну бібліотеку. Спробуємо ще раз автоматично. Це не означає, що вона порожня."
                : "Синхронізація тимчасово недоступна. Нижче — останній отриманий стан; він може бути застарілим."
              : urls === null
                ? "Перевіряємо поточний стан бібліотеки…"
                : view.total === 0
                  ? "Наразі музичні композиції не імпортовані. Реєстр використаних записів порожній."
                  : `У бібліотеці: ${view.total}. Записів із документованим походженням у реєстрі: ${view.tracks.length}.`}
          </div>
          {view.unregistered > 0 && (
            <p className="mb-6 rounded-xl border p-5">
              Для {view.unregistered} записів бібліотеки публічні підтвердження ще не додано. Ми не
              позначаємо їх як перевірені CC0. Зверніться до адміністратора Smile Stream.
            </p>
          )}
          <div className="grid gap-5">
            {view.tracks.map((track) => (
              <article key={track.id} className="rounded-2xl border bg-card p-6">
                <h3 className="text-xl font-semibold">{track.title}</h3>
                <p className="mt-1 text-muted-foreground">{track.performer}</p>
                <dl className="my-5 grid gap-3 text-sm">
                  <div>
                    <dt className="font-semibold">Твір</dt>
                    <dd>{track.compositionStatus}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold">Виконання</dt>
                    <dd>{track.performanceStatus}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold">Конкретна фонограма</dt>
                    <dd>{track.recordingStatus}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold">Джерело перевірено</dt>
                    <dd>
                      <time dateTime={track.checkedAt}>{track.checkedAt}</time>
                    </dd>
                  </div>
                </dl>
                <div className="flex flex-wrap gap-4 text-sm underline">
                  <a href={track.sourceUrl}>Першоджерело</a>
                  <a href={track.cc0EvidenceUrl}>Заява CC0 для цього запису</a>
                  <a href={track.archiveUrl}>Збережене підтвердження та SHA-256</a>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="mt-12 border-t pt-8">
          <h2 className="text-xl font-semibold">Публічне відтворення в Україні</h2>
          <p className="mt-3 text-muted-foreground">
            Дозвіл на твір, виконання та фонограму перевіряється окремо. Наявність CC0 не означає
            автоматичного звільнення всіх клінік від можливого обов’язкового винагородження чи
            договорів з організаціями колективного управління. Безкоштовність Smile Stream та
            приглушення музики під рекламу цього не змінюють.
          </p>
          <p className="mt-3 text-muted-foreground">
            Цей реєстр фіксує джерела та заявлені права, а не є державним дозволом або
            індивідуальним юридичним висновком. Клініка має перевірити застосовні обов’язки за
            <a className="ml-1 underline" href="https://zakon.rada.gov.ua/laws/show/2811-20">
              Законом № 2811-IX
            </a>{" "}
            та
            <a className="ml-1 underline" href="https://zakon.rada.gov.ua/laws/show/2415-19">
              Законом № 2415-VIII
            </a>
            .
          </p>
        </section>
        <section className="mt-10 rounded-2xl bg-secondary p-6">
          <h2 className="text-xl font-semibold">Звернення щодо прав</h2>
          <p className="my-3 text-muted-foreground">
            Правовласники та ОКУ можуть звернутися до команди через публічний репозиторій проєкту.
            Зазначте назву запису, джерело й суть питання. Там само можна запросити доступне
            архівоване підтвердження. Не додавайте приватні документи до публічного звернення.
          </p>
          <a
            className="underline"
            href="https://github.com/Kushchinskyi/smilestream/issues/new?title=Music%20rights%20inquiry"
          >
            Створити звернення щодо авторських та суміжних прав
          </a>
        </section>
      </main>
    </div>
  );
}
