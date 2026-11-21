import { ArrowRight, Play } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  getAvailableGlasesForCategory,
  getKneesForCategoryAndGlas,
} from '../domain/parser.ts';
import { filterPoolByConfig } from '../domain/quizEngine.ts';
import {
  ALL_CATEGORIES,
  ALL_GLASES,
  CATEGORY_LABELS,
  type ActiveQuizSession,
  type CatalogItem,
  type CategoryCode,
  type GlasNumber,
  type QuizConfig,
  type QuizMode,
  type UserPreferences,
} from '../domain/types.ts';

interface SetupPageProps {
  catalogItems: readonly CatalogItem[];
  preferences: UserPreferences;
  activeSession: ActiveQuizSession | null;
  onStartQuiz: (config: QuizConfig) => void;
  onResumeActive: () => void;
  onSavePreferences: (prefs: UserPreferences) => void;
}

export function SetupPage({
  catalogItems,
  preferences,
  activeSession,
  onStartQuiz,
  onResumeActive,
  onSavePreferences,
}: SetupPageProps) {
  const [category, setCategory] = useState<CategoryCode>(preferences.lastCategory);
  const [mode, setMode] = useState<QuizMode>(preferences.lastMode);

  const availableGlases = useMemo(
    () => getAvailableGlasesForCategory(catalogItems, category),
    [catalogItems, category]
  );

  const [selectedGlases, setSelectedGlases] = useState<GlasNumber[]>(() => {
    const saved = preferences.lastGlasesByCategory[preferences.lastCategory] ?? [];
    const validSaved = saved.filter((g) => availableGlases.includes(g));
    return validSaved.length > 0 ? validSaved : availableGlases;
  });

  useEffect(() => {
    const valid = preferences.lastGlasesByCategory[category]?.filter((g) =>
      availableGlases.includes(g)
    );
    if (valid && valid.length > 0) {
      setSelectedGlases(valid);
    } else {
      setSelectedGlases(availableGlases);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, catalogItems]);

  const pool = useMemo(
    () =>
      filterPoolByConfig(catalogItems, {
        category,
        glases: selectedGlases,
        mode,
      }),
    [catalogItems, category, selectedGlases, mode]
  );

  const persistPrefs = (
    nextCategory: CategoryCode,
    nextGlases: GlasNumber[],
    nextMode: QuizMode
  ) => {
    onSavePreferences({
      lastCategory: nextCategory,
      lastMode: nextMode,
      lastGlasesByCategory: {
        ...preferences.lastGlasesByCategory,
        [nextCategory]: nextGlases,
      },
    });
  };

  const handleCategoryChange = (nextCategory: CategoryCode) => {
    setCategory(nextCategory);
    const nextAvail = getAvailableGlasesForCategory(catalogItems, nextCategory);
    const saved = preferences.lastGlasesByCategory[nextCategory]?.filter((g) =>
      nextAvail.includes(g)
    );
    const nextGlases = saved && saved.length > 0 ? saved : nextAvail;
    setSelectedGlases(nextGlases);
    persistPrefs(nextCategory, nextGlases, mode);
  };

  const handleToggleGlas = (glas: GlasNumber) => {
    const exists = selectedGlases.includes(glas);
    const next = exists
      ? selectedGlases.filter((g) => g !== glas)
      : [...selectedGlases, glas].sort((a, b) => a - b);
    setSelectedGlases(next);
    persistPrefs(category, next, mode);
  };

  const handleSelectAll = () => {
    setSelectedGlases(availableGlases);
    persistPrefs(category, availableGlases, mode);
  };

  const handleResetGlases = () => {
    setSelectedGlases([]);
    persistPrefs(category, [], mode);
  };

  const handleModeChange = (nextMode: QuizMode) => {
    setMode(nextMode);
    persistPrefs(category, selectedGlases, nextMode);
  };

  const handleLaunch = () => {
    if (pool.length === 0) return;
    onStartQuiz({
      category,
      glases: selectedGlases,
      mode,
    });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="space-y-2">
        <div className="text-xs text-ink-muted">Параметры упражнения</div>
        <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-ink">
          Настройка викторины
        </h1>
        <p className="text-sm text-ink-muted">
          Выберите категорию, нужные гласы и режим. Выборка формируется только по
          фактически доступным аудиозаписям.
        </p>
      </div>

      {activeSession && (
        <div className="bg-surface border border-border rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-sm">
            <div className="font-semibold text-ink">Есть незавершённое занятие</div>
            <p className="text-ink-muted mt-0.5">
              Запуск новой тренировки сохранит текущую сессию в истории со статусом
              «Прервана».
            </p>
          </div>
          <button
            type="button"
            onClick={onResumeActive}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-md bg-subtle border border-border text-sm font-medium text-ink hover:border-border-strong transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Play className="w-4 h-4" aria-hidden="true" />
            <span>Продолжить текущее</span>
          </button>
        </div>
      )}

      {/* Step 1: Category */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink">1. Категория песнопений</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ALL_CATEGORIES.map((cat) => {
            const count = catalogItems.filter((i) => i.category === cat).length;
            const glasesCount = getAvailableGlasesForCategory(catalogItems, cat).length;
            const active = category === cat;

            return (
              <button
                key={cat}
                type="button"
                aria-pressed={active}
                onClick={() => handleCategoryChange(cat)}
                className={`p-4 rounded-lg border text-left transition-colors cursor-pointer ${
                  active
                    ? 'bg-surface border-rubric ring-1 ring-rubric'
                    : 'bg-surface border-border hover:border-border-strong'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-serif text-xl font-semibold text-ink">
                    {CATEGORY_LABELS[cat]}
                  </span>
                  <span className="font-mono text-xs text-ink-muted tabular-nums">
                    {count} зап.
                  </span>
                </div>
                <div className="mt-1 text-xs text-ink-muted">
                  {glasesCount > 0
                    ? `Доступно гласов: ${glasesCount} из 8`
                    : 'Записей пока нет'}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Step 2: Glases */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-ink">2. Гласы (от 1 до 8)</h2>
          <div className="flex items-center gap-3 text-xs">
            <button
              type="button"
              disabled={availableGlases.length === 0}
              onClick={handleSelectAll}
              className="text-rubric font-medium hover:underline disabled:opacity-40 cursor-pointer"
            >
              Выбрать все доступные
            </button>
            <span aria-hidden="true" className="text-border-strong">
              ·
            </span>
            <button
              type="button"
              disabled={selectedGlases.length === 0}
              onClick={handleResetGlases}
              className="text-ink-muted hover:text-ink hover:underline disabled:opacity-40 cursor-pointer"
            >
              Сбросить
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5">
          {ALL_GLASES.map((g) => {
            const kneesCount = getKneesForCategoryAndGlas(
              catalogItems,
              category,
              g
            ).length;
            const available = kneesCount > 0;
            const checked = selectedGlases.includes(g);

            return (
              <button
                key={g}
                type="button"
                disabled={!available}
                aria-pressed={checked}
                aria-label={
                  available
                    ? `Глас ${g}, доступно колен: ${kneesCount}`
                    : `Глас ${g}, нет записей`
                }
                onClick={() => handleToggleGlas(g)}
                className={`p-3 min-h-[68px] rounded-lg border flex flex-col items-center justify-center gap-1 transition-colors ${
                  !available
                    ? 'bg-subtle/60 border-border/60 text-ink-faint cursor-not-allowed opacity-65'
                    : checked
                      ? 'bg-rubric text-white border-rubric cursor-pointer'
                      : 'bg-surface text-ink border-border hover:border-border-strong cursor-pointer'
                }`}
              >
                <span className="font-mono text-lg font-semibold tabular-nums leading-none">
                  {g}
                </span>
                <span
                  className={`text-[11px] leading-tight text-center ${
                    checked ? 'text-white/85' : 'text-ink-faint'
                  }`}
                >
                  {available ? `${kneesCount} кол.` : 'нет'}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Step 3: Mode */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-ink">3. Режим тренировки</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            aria-pressed={mode === 'finite'}
            onClick={() => handleModeChange('finite')}
            className={`p-4 rounded-lg border text-left transition-colors cursor-pointer ${
              mode === 'finite'
                ? 'bg-surface border-rubric ring-1 ring-rubric'
                : 'bg-surface border-border hover:border-border-strong'
            }`}
          >
            <div className="font-semibold text-sm text-ink">Конечный</div>
            <p className="mt-1 text-xs text-ink-muted leading-relaxed">
              Распознать каждое уникальное колено из выбранной выборки. Освоенные колена
              исключаются до конца занятия.
            </p>
          </button>

          <button
            type="button"
            aria-pressed={mode === 'infinite'}
            onClick={() => handleModeChange('infinite')}
            className={`p-4 rounded-lg border text-left transition-colors cursor-pointer ${
              mode === 'infinite'
                ? 'bg-surface border-rubric ring-1 ring-rubric'
                : 'bg-surface border-border hover:border-border-strong'
            }`}
          >
            <div className="font-semibold text-sm text-ink">Бесконечный</div>
            <p className="mt-1 text-xs text-ink-muted leading-relaxed">
              Непрерывная практика: отгаданные колена могут повторяться снова, занятие
              завершается по вашей команде.
            </p>
          </button>
        </div>
      </section>

      {/* Summary & Launch */}
      <section className="bg-surface border border-border rounded-lg p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-sm font-medium text-ink">
            Выбрано гласов:{' '}
            <span className="font-mono tabular-nums font-semibold">
              {selectedGlases.length}
            </span>{' '}
            <span aria-hidden="true" className="text-ink-faint mx-1">
              ·
            </span>{' '}
            Уникальных колен:{' '}
            <span className="font-mono tabular-nums font-semibold">{pool.length}</span>
          </div>
          {pool.length === 0 && (
            <p className="text-xs text-rubric">
              Выберите хотя бы один доступный глас, чтобы начать тренировку.
            </p>
          )}
        </div>

        <button
          type="button"
          disabled={pool.length === 0}
          onClick={handleLaunch}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[46px] rounded-md bg-rubric text-white font-semibold text-sm hover:bg-rubric-hover disabled:opacity-45 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <span>Начать</span>
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </section>
    </div>
  );
}
