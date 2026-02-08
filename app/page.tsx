'use client';

import { useThemeStore } from "@/lib/theme-store";

export default function Home() {
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary transition-colors duration-200">
      <header className="border-b border-border-color bg-bg-secondary px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">
            Notion-inspired Theme Preview
          </h1>
          <p className="text-sm text-text-secondary">
            Light and dark tokens powered by CSS variables and Tailwind @theme.
          </p>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          className="flex items-center gap-2 text-sm text-text-secondary"
        >
          <span>{theme === "light" ? "Light" : "Dark"} mode</span>
          <span className="relative inline-flex h-6 w-11 items-center rounded-full border border-border-color bg-bg-primary">
            <span
              className={`inline-block h-4 w-4 rounded-full bg-accent transition-transform ${
                theme === "dark" ? "translate-x-5" : "translate-x-1"
              }`}
            />
          </span>
        </button>
      </header>

      <main className="px-8 py-10">
        <section className="max-w-4xl mx-auto space-y-4">
          <h2 className="text-3xl font-semibold text-text-primary">
            Theme tokens in action
          </h2>
          <p className="text-base text-text-secondary">
            This page uses the shared color tokens for background, text,
            borders, cards, and accents so you can quickly verify the palette in
            both light and dark modes.
          </p>
        </section>

        <section className="mt-10 max-w-5xl mx-auto grid gap-6 md:grid-cols-3">
          <div className="rounded-xl border border-border-color bg-card-bg p-6 shadow-sm">
            <div className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
              Accent badge
            </div>
            <h3 className="mt-4 text-lg font-semibold text-text-primary">
              Card background & border
            </h3>
            <p className="mt-2 text-sm text-text-secondary">
              This card uses <code>card-bg</code> and <code>border-color</code>{" "}
              tokens, plus an accent badge for quick emphasis.
            </p>
          </div>

          <div className="rounded-xl border border-border-color bg-card-bg p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-text-primary">
              Primary vs secondary text
            </h3>
            <p className="mt-2 text-sm text-text-primary">
              Primary text uses the <code>text-primary</code> token.
            </p>
            <p className="mt-1 text-sm text-text-secondary">
              Secondary text uses the <code>text-secondary</code> token for
              softer descriptions.
            </p>
          </div>

          <div className="rounded-xl border border-border-color bg-card-bg p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-text-primary">
              Accent usage
            </h3>
            <p className="mt-2 text-sm text-text-secondary">
              Use <code>accent</code> for interactive elements and{" "}
              <code>accent-soft</code> for subtle backgrounds.
            </p>
            <button className="mt-4 inline-flex items-center rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-white">
              Accent button
            </button>
          </div>
        </section>

        <section className="mt-12 max-w-5xl mx-auto space-y-6">
          <h2 className="text-lg font-semibold text-text-primary">
            Color tokens overview
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            <div className="rounded-lg border border-border-color bg-bg-secondary p-3">
              <div className="h-10 rounded-md bg-bg-primary border border-border-color" />
              <p className="mt-2 text-xs font-medium text-text-primary">
                bg-primary
              </p>
            </div>
            <div className="rounded-lg border border-border-color bg-bg-secondary p-3">
              <div className="h-10 rounded-md bg-bg-secondary border border-border-color" />
              <p className="mt-2 text-xs font-medium text-text-primary">
                bg-secondary
              </p>
            </div>
            <div className="rounded-lg border border-border-color bg-bg-secondary p-3">
              <div className="flex h-10 items-center justify-center rounded-md bg-card-bg">
                <span className="text-xs text-text-primary">Aa</span>
              </div>
              <p className="mt-2 text-xs font-medium text-text-primary">
                text-primary
              </p>
            </div>
            <div className="rounded-lg border border-border-color bg-bg-secondary p-3">
              <div className="flex h-10 items-center justify-center rounded-md bg-card-bg">
                <span className="text-xs text-text-secondary">Aa</span>
              </div>
              <p className="mt-2 text-xs font-medium text-text-primary">
                text-secondary
              </p>
            </div>
            <div className="rounded-lg border border-border-color bg-bg-secondary p-3">
              <div className="h-10 rounded-md border-2 border-border-color bg-bg-primary" />
              <p className="mt-2 text-xs font-medium text-text-primary">
                border-color
              </p>
            </div>
            <div className="rounded-lg border border-border-color bg-bg-secondary p-3">
              <div className="h-10 rounded-md bg-accent" />
              <p className="mt-2 text-xs font-medium text-text-primary">
                accent
              </p>
            </div>
            <div className="rounded-lg border border-border-color bg-bg-secondary p-3">
              <div className="h-10 rounded-md bg-accent-soft" />
              <p className="mt-2 text-xs font-medium text-text-primary">
                accent-soft
              </p>
            </div>
            <div className="rounded-lg border border-border-color bg-bg-secondary p-3">
              <div className="h-10 rounded-md bg-card-bg" />
              <p className="mt-2 text-xs font-medium text-text-primary">
                card-bg
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}