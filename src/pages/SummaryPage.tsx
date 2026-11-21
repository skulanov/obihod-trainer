import { ArrowRight, BookOpen, RotateCcw, Settings2, Volume2 } from 'lucide-react';
import {
  computeSessionSummary,
  formatDurationRu,
  formatPercentOrNoData,
} from '../domain/stats.ts';
import {
  CATEGORY_LABELS,
  QUIZ_MODE_LABELS,
  SESSION_STATUS_LABELS,
  formatKneeLabel,
  type CatalogItem,
  type QuizConfig,
  type TrainingSessionRecord,
} from '../domain/types.ts';
import type { AppRoute } from '../services/router.ts';

interface SummaryPageProps {
  session: TrainingSessionRecord | null;
  catalogItems: readonly CatalogItem[];
  onRestartWithConfig: (config: QuizConfig) => void;
  onNavigate: (route: AppRoute) => void;
}

export function SummaryPage({
  session,
  catalogItems,
  onRestartWithConfig,
  onNavigate,
}: SummaryPageProps) {
  if (!session) {
    return (
      <div className="max-w-xl mx-auto bg-surface border border-border rounded-lg p-8 text-center space-y-4">
        <h1 className="font-serif text-3xl font-semibold text-ink">
          Итоги занятия не найдены
        </h1>
        <p className="text-sm text-ink-muted">
          Пройдите тренировку, чтобы увидеть итоги занятия и список сложных колен.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => onNavigate({ page: 'setup' })}
            className="px-5 py-2.5 min-h-[44px] rounded-md bg-rubric text-white font-semibold text-sm hover:bg-rubric-hover transition-colors cursor-pointer"
          >
            Начать тренировку
          </button>
          <button
            type="button"
            onClick={() => onNavigate({ page: 'catalog' })}
            className="px-5 py-2.5 min-h-[44px] rounded-md bg-surface border border-border text-ink font-medium text-sm hover:bg-subtle transition-colors cursor-pointer"
          >
            Перейти к обучению
          </button>
        </div>
      </div>
    );
  }

  const stats = computeSessionSummary(session);
  const catalogIds = new Set(catalogItems.map((i) => i.id));
  const finishedDate = new Date(session.finishedAt).toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header & metadata */}
      <div className="space-y-2 pb-6 border-b border-border">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-muted">
          <span className="font-semibold text-ink">
            {SESSION_STATUS_LABELS[session.status]}
          </span>
          <span aria-hidden="true">·</span>
          <span>{finishedDate}</span>
          <span aria-hidden="true">·</span>
          <span>Длительность: {formatDurationRu(session.durationMs)}</span>
        </div>

        <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-ink">
          Итоги занятия
        </h1>

        <div className="text-sm text-ink-muted flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>
            Категория:{' '}
            <span className="text-ink font-medium">
              {CATEGORY_LABELS[session.config.category]}
            </span>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Гласы:{' '}
            <span className="font-mono tabular-nums text-ink">
              {session.config.glases.join(', ')}
            </span>
          </span>
          <span aria-hidden="true">·</span>
          <span>
            Режим:{' '}
            <span className="text-ink font-medium">
              {QUIZ_MODE_LABELS[session.config.mode]}
            </span>
          </span>
        </div>
      </div>

      {/* Primary metrics */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="text-xs text-ink-muted">Уникальных колен в наборе</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-ink tabular-nums">
            {stats.totalUniqueInPool}
          </div>
          <div className="mt-1 text-xs text-ink-faint">
            Услышано: <span className="font-mono tabular-nums">{stats.heardUniqueCount}</span>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="text-xs text-ink-muted">Полностью разгадано</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-correct tabular-nums">
            {stats.solvedUniqueCount}
          </div>
          <div className="mt-1 text-xs text-ink-faint">
            Неразгадано:{' '}
            <span className="font-mono tabular-nums">{stats.unsolvedUniqueCount}</span>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="text-xs text-ink-muted">С первой попытки</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-ink tabular-nums">
            {stats.solvedFirstTryCount}
          </div>
          <div className="mt-1 text-xs text-ink-faint">
            Со 2-й и далее:{' '}
            <span className="font-mono tabular-nums">{stats.solvedLaterTryCount}</span>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="text-xs text-ink-muted">Проверенных попыток</div>
          <div className="mt-1 font-mono text-2xl font-semibold text-ink tabular-nums">
            {stats.totalCheckedAttempts}
          </div>
          <div className="mt-1 text-xs text-ink-faint">
            Ошибок:{' '}
            <span className="font-mono tabular-nums">{stats.wrongCheckedAttempts}</span>
          </div>
        </div>
      </section>

      {/* Separate accuracy by first checked attempt + secondary counters */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-surface border border-border rounded-lg p-5 space-y-4">
          <h2 className="text-sm font-semibold text-ink">
            Точность по первым проверенным попыткам
          </h2>

          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-muted">Определение гласа</span>
                <span className="font-mono font-semibold text-ink tabular-nums">
                  {formatPercentOrNoData(stats.firstAttemptGlasAccuracy)}
                </span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-subtle overflow-hidden">
                <div
                  className="h-full bg-rubric transition-all"
                  style={{ width: `${stats.firstAttemptGlasAccuracy ?? 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-muted">Определение колена</span>
                <span className="font-mono font-semibold text-ink tabular-nums">
                  {formatPercentOrNoData(stats.firstAttemptKneeAccuracy)}
                </span>
              </div>
              <div className="mt-1.5 h-2 rounded-full bg-subtle overflow-hidden">
                <div
                  className="h-full bg-ink transition-all"
                  style={{ width: `${stats.firstAttemptKneeAccuracy ?? 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-surface border border-border rounded-lg p-5 space-y-3">
          <h2 className="text-sm font-semibold text-ink">Дополнительные показатели</h2>
          <dl className="divide-y divide-border text-sm">
            <div className="py-2 flex items-center justify-between">
              <dt className="text-ink-muted">Пропуски («Другое колено»)</dt>
              <dd className="font-mono tabular-nums font-medium text-ink">
                {stats.skipsCount}
              </dd>
            </div>
            <div className="py-2 flex items-center justify-between">
              <dt className="text-ink-muted">Просмотры ответа (подсказки)</dt>
              <dd className="font-mono tabular-nums font-medium text-ink">
                {stats.hintsCount}
              </dd>
            </div>
            <div className="py-2 flex items-center justify-between">
              <dt className="text-ink-muted">Повторные воспроизведения</dt>
              <dd className="font-mono tabular-nums font-medium text-ink">
                {stats.replaysCount}
              </dd>
            </div>
            {stats.audioErrorsCount > 0 && (
              <div className="py-2 flex items-center justify-between">
                <dt className="text-ink-muted">Недоступные записи (не ошибка)</dt>
                <dd className="font-mono tabular-nums font-medium text-warn">
                  {stats.audioErrorsCount}
                </dd>
              </div>
            )}
          </dl>
        </div>
      </section>

      {/* Difficult exercises list */}
      <section className="space-y-3">
        <h2 className="font-serif text-2xl font-semibold text-ink">
          Колена, вызвавшие сложности
        </h2>

        {stats.difficultExercises.length === 0 ? (
          <div className="bg-surface border border-border rounded-lg p-5 text-sm text-ink-muted">
            Сложных колен в этом занятии не зафиксировано.
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-lg divide-y divide-border">
            {stats.difficultExercises.map((item) => {
              const availableInCatalog = catalogIds.has(item.exerciseId);
              const details: string[] = [];
              if (item.wrongAttempts > 0) details.push(`ошибок: ${item.wrongAttempts}`);
              if (item.hintsUsed > 0) details.push(`подсказок: ${item.hintsUsed}`);
              if (item.skips > 0) details.push(`пропусков: ${item.skips}`);

              return (
                <div
                  key={item.exerciseId}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div>
                    <div className="text-sm font-semibold text-ink">
                      {CATEGORY_LABELS[item.category]} · Глас {item.glas} · Колено{' '}
                      {formatKneeLabel(item.knee)}
                    </div>
                    <div className="text-xs text-ink-muted mt-0.5">
                      {details.join(' · ')}
                      {!availableInCatalog && (
                        <span className="text-warn"> · запись более недоступна</span>
                      )}
                    </div>
                  </div>

                  {availableInCatalog ? (
                    <button
                      type="button"
                      onClick={() =>
                        onNavigate({ page: 'catalog', focusId: item.exerciseId })
                      }
                      className="inline-flex items-center justify-center gap-2 px-3.5 py-2 min-h-[40px] rounded-md bg-subtle border border-border text-xs font-medium text-ink hover:border-border-strong transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Volume2 className="w-3.5 h-3.5 text-rubric" aria-hidden="true" />
                      <span>Прослушать в обучении</span>
                    </button>
                  ) : (
                    <span className="text-xs text-ink-faint whitespace-nowrap">
                      Запись более недоступна
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="button"
          onClick={() => onRestartWithConfig(session.config)}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[46px] rounded-md bg-rubric text-white font-semibold text-sm hover:bg-rubric-hover transition-colors whitespace-nowrap cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" aria-hidden="true" />
          <span>Начать снова</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate({ page: 'setup' })}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[46px] rounded-md bg-surface border border-border text-ink font-medium text-sm hover:bg-subtle transition-colors whitespace-nowrap cursor-pointer"
        >
          <Settings2 className="w-4 h-4 text-ink-muted" aria-hidden="true" />
          <span>Изменить выборку</span>
        </button>

        <button
          type="button"
          onClick={() => onNavigate({ page: 'catalog' })}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 min-h-[46px] rounded-md bg-surface border border-border text-ink font-medium text-sm hover:bg-subtle transition-colors whitespace-nowrap cursor-pointer"
        >
          <BookOpen className="w-4 h-4 text-ink-muted" aria-hidden="true" />
          <span>В обучение</span>
          <ArrowRight className="w-4 h-4 text-ink-muted" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
