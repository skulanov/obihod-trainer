import { AlertCircle, ChevronLeft, ChevronRight, Volume2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AudioPlayerPanel } from '../components/AudioPlayerPanel.tsx';
import {
  getAvailableGlasesForCategory,
  getKneesForCategoryAndGlas,
} from '../domain/parser.ts';
import {
  ALL_CATEGORIES,
  ALL_GLASES,
  CATEGORY_LABELS,
  formatExerciseTitle,
  formatKneeLabel,
  type CatalogItem,
  type CategoryCode,
  type GlasNumber,
} from '../domain/types.ts';
import { useAudioPlayer } from '../services/audioPlayer.ts';
import { resolveStaticUrl } from '../services/urlResolver.ts';

interface CatalogPageProps {
  catalogItems: readonly CatalogItem[];
  focusId?: string;
}

export function CatalogPage({ catalogItems, focusId }: CatalogPageProps) {
  const player = useAudioPlayer();

  const initialSelection = useMemo(() => {
    if (focusId) {
      const exact = catalogItems.find((item) => item.id === focusId);
      if (exact) {
        return {
          category: exact.category,
          glas: exact.glas,
          selectedId: exact.id,
          missingFocusedId: null as string | null,
        };
      }
    }
    const first = catalogItems[0];
    return {
      category: first?.category ?? ('trop' as CategoryCode),
      glas: first?.glas ?? (1 as GlasNumber),
      selectedId: first?.id ?? null,
      missingFocusedId: focusId ?? null,
    };
  }, [catalogItems, focusId]);

  const [category, setCategory] = useState<CategoryCode>(initialSelection.category);
  const [glas, setGlas] = useState<GlasNumber>(initialSelection.glas);
  const [selectedId, setSelectedId] = useState<string | null>(initialSelection.selectedId);

  useEffect(() => {
    if (focusId) {
      const exact = catalogItems.find((item) => item.id === focusId);
      if (exact) {
        setCategory(exact.category);
        setGlas(exact.glas);
        setSelectedId(exact.id);
      }
    }
  }, [focusId, catalogItems]);

  const availableGlases = useMemo(
    () => getAvailableGlasesForCategory(catalogItems, category),
    [catalogItems, category]
  );

  const kneesInGlas = useMemo(
    () => getKneesForCategoryAndGlas(catalogItems, category, glas),
    [catalogItems, category, glas]
  );

  const selectedItem = useMemo(
    () => kneesInGlas.find((i) => i.id === selectedId) ?? kneesInGlas[0] ?? null,
    [kneesInGlas, selectedId]
  );

  const selectedIndex = selectedItem
    ? kneesInGlas.findIndex((i) => i.id === selectedItem.id)
    : -1;

  const targetUrl = selectedItem ? resolveStaticUrl(selectedItem.file) : null;

  const totalTrop = useMemo(
    () => catalogItems.filter((i) => i.category === 'trop').length,
    [catalogItems]
  );
  const totalStih = useMemo(
    () => catalogItems.filter((i) => i.category === 'stih').length,
    [catalogItems]
  );

  const handleSelectCategory = (nextCat: CategoryCode) => {
    player.stop();
    setCategory(nextCat);
    const glases = getAvailableGlasesForCategory(catalogItems, nextCat);
    const nextGlas = glases[0] ?? 1;
    setGlas(nextGlas);
    const nextKnees = getKneesForCategoryAndGlas(catalogItems, nextCat, nextGlas);
    setSelectedId(nextKnees[0]?.id ?? null);
  };

  const handleSelectGlas = (nextGlas: GlasNumber) => {
    player.stop();
    setGlas(nextGlas);
    const nextKnees = getKneesForCategoryAndGlas(catalogItems, category, nextGlas);
    setSelectedId(nextKnees[0]?.id ?? null);
  };

  const handleSelectKnee = (item: CatalogItem, autoPlay = false) => {
    setSelectedId(item.id);
    const url = resolveStaticUrl(item.file);
    if (autoPlay) {
      void player.play(url, true);
    } else if (player.url !== url) {
      player.stop();
    }
  };

  const handleStepKnee = (delta: -1 | 1) => {
    if (selectedIndex < 0) return;
    const nextIdx = selectedIndex + delta;
    if (nextIdx < 0 || nextIdx >= kneesInGlas.length) return;
    handleSelectKnee(kneesInGlas[nextIdx], true);
  };

  const missingFocused =
    focusId && !catalogItems.some((item) => item.id === focusId);

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="font-serif text-3xl sm:text-4xl font-semibold text-ink">
        Обучение и прослушивание записей
      </h1>

      {missingFocused && (
        <div
          role="status"
          className="flex items-start gap-3 p-4 rounded-lg bg-warn-soft border border-warn/25 text-sm text-warn"
        >
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            Запрошенное упражнение (<span className="font-mono">{focusId}</span>) более
            недоступно в текущей версии аудиотеки. Вы можете прослушать другие доступные
            записи ниже.
          </div>
        </div>
      )}

      {/* Category segmented selector */}
      <div
        role="tablist"
        aria-label="Выбор категории песнопений"
        className="inline-flex p-1 bg-subtle border border-border rounded-lg gap-1"
      >
        {ALL_CATEGORIES.map((cat) => {
          const count = cat === 'trop' ? totalTrop : totalStih;
          const active = category === cat;
          return (
            <button
              key={cat}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => handleSelectCategory(cat)}
              className={`px-4 py-2 min-h-[40px] rounded-md text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                active
                  ? 'bg-surface text-ink font-semibold shadow-xs'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              {CATEGORY_LABELS[cat]}{' '}
              <span className="font-mono tabular-nums text-xs text-ink-faint ml-1">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {availableGlases.length === 0 ? (
        <div className="bg-surface border border-border rounded-lg p-8 text-center space-y-2">
          <h2 className="font-serif text-2xl font-semibold text-ink">
            В категории «{CATEGORY_LABELS[category]}» пока нет записей
          </h2>
          <p className="text-sm text-ink-muted max-w-md mx-auto">
            Добавьте MP3-файлы вида{' '}
            <span className="font-mono text-ink">{category}_1_1.mp3</span> в папку{' '}
            <span className="font-mono text-ink">public/audio/</span> и обновите каталог.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Glas grid */}
          <section aria-label="Выбор гласа">
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5">
              {ALL_GLASES.map((g) => {
                  const kneesCount = getKneesForCategoryAndGlas(
                    catalogItems,
                    category,
                    g
                  ).length;
                  const isAvailable = kneesCount > 0;
                  const isSelected = glas === g;

                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => handleSelectGlas(g)}
                      aria-pressed={isSelected}
                      className={`p-3 min-h-[60px] rounded-lg border text-left transition-colors cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-rubric text-white border-rubric'
                          : isAvailable
                            ? 'bg-surface text-ink border-border hover:border-border-strong'
                            : 'bg-subtle/60 text-ink-faint border-border/70 hover:border-border'
                      }`}
                    >
                      <span className="font-mono text-lg font-semibold tabular-nums leading-none">
                        {g}
                      </span>
                      <span
                        className={`text-[11px] mt-1.5 ${
                          isSelected
                            ? 'text-white/85'
                            : isAvailable
                              ? 'text-ink-muted'
                              : 'text-ink-faint'
                        }`}
                      >
                        {isAvailable ? `колен: ${kneesCount}` : 'нет записей'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Knees in selected glas */}
            <section className="space-y-3" aria-label="Доступные колена выбранного гласа">
              <h2 className="text-sm font-semibold text-ink">
                Колена — {CATEGORY_LABELS[category]}, глас {glas}
              </h2>

              {kneesInGlas.length === 0 ? (
                <div className="bg-surface border border-border rounded-lg p-5 text-sm text-ink-muted">
                  Для гласа {glas} в категории «{CATEGORY_LABELS[category]}» пока нет
                  загруженных записей. Выберите другой глас из отмеченных выше.
                </div>
              ) : (
                <div className="divide-y divide-border bg-surface border border-border rounded-lg overflow-hidden">
                  {kneesInGlas.map((item) => {
                    const isSelected = selectedItem?.id === item.id;
                    const itemUrl = resolveStaticUrl(item.file);
                    const isPlayingThis =
                      player.url === itemUrl && player.status === 'playing';

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelectKnee(item, true)}
                        aria-current={isSelected ? 'true' : undefined}
                        className={`w-full px-4 py-3.5 min-h-[48px] flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-rubric-soft text-ink font-semibold'
                            : 'bg-surface text-ink hover:bg-subtle/70'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-mono text-sm font-semibold w-8 text-center py-0.5 rounded bg-subtle text-ink shrink-0">
                            {item.knee}
                          </span>
                          <span className="text-sm truncate">
                            Колено {formatKneeLabel(item.knee)}
                          </span>
                        </div>
                        <span className="text-xs text-ink-muted flex items-center gap-1.5 whitespace-nowrap shrink-0">
                          {isPlayingThis ? (
                            <>
                              <Volume2
                                className="w-4 h-4 text-rubric"
                                aria-hidden="true"
                              />
                              <span className="text-rubric font-medium">Звучит</span>
                            </>
                          ) : (
                            <span>Слушать</span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>

          {/* Study Player below knees list */}
          <div className="space-y-4">
            {selectedItem && targetUrl ? (
              <>
                <AudioPlayerPanel
                  mode="study"
                  title={formatExerciseTitle(
                    selectedItem.category,
                    selectedItem.glas,
                    selectedItem.knee
                  )}
                  subtitle={`Запись ${selectedIndex + 1} из ${kneesInGlas.length} в гласе ${selectedItem.glas}`}
                  targetUrl={targetUrl}
                  player={player}
                  onPlay={() => void player.play(targetUrl, false)}
                  onPause={player.pause}
                  onReplay={() => void player.play(targetUrl, true)}
                  onStop={player.stop}
                  onSeek={player.seek}
                />

                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    disabled={selectedIndex <= 0}
                    onClick={() => handleStepKnee(-1)}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-md bg-surface border border-border text-sm font-medium text-ink hover:bg-subtle disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                    <span>Предыдущее колено</span>
                  </button>

                  <button
                    type="button"
                    disabled={selectedIndex < 0 || selectedIndex >= kneesInGlas.length - 1}
                    onClick={() => handleStepKnee(1)}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-md bg-surface border border-border text-sm font-medium text-ink hover:bg-subtle disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <span>Следующее колено</span>
                    <ChevronRight className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </>
            ) : (
              <div className="bg-surface border border-border rounded-lg p-6 text-sm text-ink-muted">
                Выберите глас с доступными записями, чтобы открыть проигрыватель изучения.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
