import type { ReactNode } from 'react';
import { buildHashUrl, type AppRoute } from '../services/router.ts';

interface LayoutProps {
  route: AppRoute;
  hasActiveSession: boolean;
  onNavigate: (route: AppRoute) => void;
  children: ReactNode;
}

export function Layout({ route, hasActiveSession, onNavigate, children }: LayoutProps) {
  const isStudy = route.page === 'catalog';
  const isTraining = !isStudy;

  const trainingTarget: AppRoute = hasActiveSession
    ? { page: 'quiz' }
    : { page: 'setup' };

  return (
    <div className="min-h-screen flex flex-col bg-canvas text-ink">
      <header className="bg-surface border-b border-border">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3 sm:gap-8">
          <a
            href={buildHashUrl(trainingTarget)}
            onClick={(e) => {
              e.preventDefault();
              onNavigate(trainingTarget);
            }}
            className="font-serif text-lg sm:text-2xl font-bold tracking-tight text-ink whitespace-nowrap shrink-0 hover:text-rubric transition-colors truncate"
          >
            Обиходный тренажёр
          </a>

          <div
            role="tablist"
            aria-label="Переключение режима приложения"
            className="inline-flex items-center p-1 bg-subtle border border-border rounded-lg gap-1 shrink-0"
          >
            <button
              type="button"
              role="tab"
              aria-selected={isTraining}
              onClick={() => onNavigate(trainingTarget)}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 min-h-[36px] sm:min-h-[40px] rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isTraining
                  ? 'bg-rubric text-white font-semibold'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              Тренировка
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={isStudy}
              onClick={() => onNavigate({ page: 'catalog' })}
              className={`px-3 sm:px-4 py-1.5 sm:py-2 min-h-[36px] sm:min-h-[40px] rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                isStudy
                  ? 'bg-rubric text-white font-semibold'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              Обучение
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
        {children}
      </main>

      <footer className="border-t border-border bg-surface mt-12">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-5 text-center text-xs text-ink-faint">
          by Dima Skulanov 2026
        </div>
      </footer>
    </div>
  );
}
