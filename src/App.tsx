import { AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Layout } from './components/Layout.tsx';
import {
  advanceSessionTurn,
  createActiveQuizSession,
  finishActiveSession,
  markCurrentAudioUnavailable,
  recordReplayOnSession,
  revealAnswerOnSession,
  submitAttemptOnSession,
} from './domain/quizEngine.ts';
import type {
  ActiveQuizSession,
  CatalogData,
  GlasNumber,
  QuizConfig,
  TrainingSessionRecord,
  UserPreferences,
} from './domain/types.ts';
import { CatalogPage } from './pages/CatalogPage.tsx';
import { QuizPage } from './pages/QuizPage.tsx';
import { SetupPage } from './pages/SetupPage.tsx';
import { SummaryPage } from './pages/SummaryPage.tsx';
import { loadAudioCatalog } from './services/catalogService.ts';
import { useHashRoute } from './services/router.ts';
import {
  DEFAULT_PREFERENCES,
  loadActiveSession,
  loadPreferences,
  loadSessionHistory,
  saveActiveSession,
  savePreferences,
  saveSessionRecord,
} from './storage/db.ts';

export default function App() {
  const { route, navigate } = useHashRoute();

  const [catalog, setCatalog] = useState<CatalogData | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  const [storageReady, setStorageReady] = useState(false);
  const [activeSession, setActiveSession] = useState<ActiveQuizSession | null>(null);
  const [history, setHistory] = useState<TrainingSessionRecord[]>([]);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);

  const fetchCatalog = useCallback(async (signal?: AbortSignal) => {
    setCatalogLoading(true);
    setCatalogError(null);
    const res = await loadAudioCatalog(signal);
    if (signal?.aborted) return;
    if (res.ok) {
      setCatalog(res.data);
    } else {
      setCatalogError(res.error);
    }
    setCatalogLoading(false);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void fetchCatalog(controller.signal);
    return () => controller.abort();
  }, [fetchCatalog]);

  useEffect(() => {
    let cancelled = false;
    async function hydrateStorage() {
      const [savedSession, savedHistory, savedPrefs] = await Promise.all([
        loadActiveSession(),
        loadSessionHistory(),
        loadPreferences(),
      ]);
      if (cancelled) return;
      setActiveSession(savedSession);
      setHistory(savedHistory);
      setPreferences(savedPrefs);
      setStorageReady(true);
    }
    void hydrateStorage();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateActiveSession = useCallback((next: ActiveQuizSession | null) => {
    setActiveSession(next);
    void saveActiveSession(next);
  }, []);

  const archiveSessionRecord = useCallback((record: TrainingSessionRecord) => {
    setHistory((prev) => [record, ...prev.filter((item) => item.id !== record.id)]);
    void saveSessionRecord(record);
  }, []);

  const handleSavePreferences = useCallback((next: UserPreferences) => {
    setPreferences(next);
    void savePreferences(next);
  }, []);

  const handleStartQuiz = useCallback(
    (config: QuizConfig) => {
      if (!catalog) return;

      if (activeSession) {
        const archived = finishActiveSession(activeSession, 'interrupted');
        archiveSessionRecord(archived);
      }

      const nextSession = createActiveQuizSession(config, catalog.items);
      if (!nextSession) return;

      updateActiveSession(nextSession);
      navigate({ page: 'quiz' });
    },
    [catalog, activeSession, archiveSessionRecord, updateActiveSession, navigate]
  );

  const handleSubmitAttempt = useCallback(
    (glas: GlasNumber | null, kneeRaw: string | null) => {
      if (!activeSession) {
        return { ok: false as const, message: 'Нет активного занятия.' };
      }
      const res = submitAttemptOnSession(activeSession, glas, kneeRaw);
      if (!res.ok) {
        return { ok: false as const, message: res.message };
      }
      updateActiveSession(res.session);
      return { ok: true as const };
    },
    [activeSession, updateActiveSession]
  );

  const handleRevealAnswer = useCallback(() => {
    if (!activeSession) return;
    updateActiveSession(revealAnswerOnSession(activeSession));
  }, [activeSession, updateActiveSession]);

  const handleRecordReplay = useCallback(() => {
    if (!activeSession) return;
    updateActiveSession(recordReplayOnSession(activeSession));
  }, [activeSession, updateActiveSession]);

  const handleAudioUnavailable = useCallback(
    (message: string) => {
      if (!activeSession) return;
      updateActiveSession(markCurrentAudioUnavailable(activeSession, message));
    },
    [activeSession, updateActiveSession]
  );

  const handleAdvanceTurn = useCallback(
    (action: 'next' | 'skip') => {
      if (!activeSession || !catalog) return;
      const result = advanceSessionTurn(activeSession, catalog.items, action);
      if (result.completed) {
        const record = finishActiveSession(result.session, 'completed');
        archiveSessionRecord(record);
        updateActiveSession(null);
        navigate({ page: 'summary', sessionId: record.id });
      } else {
        updateActiveSession(result.session);
      }
    },
    [activeSession, catalog, archiveSessionRecord, updateActiveSession, navigate]
  );

  const handleFinishSession = useCallback(() => {
    if (!activeSession) return;
    const record = finishActiveSession(activeSession, 'stopped');
    archiveSessionRecord(record);
    updateActiveSession(null);
    navigate({ page: 'summary', sessionId: record.id });
  }, [activeSession, archiveSessionRecord, updateActiveSession, navigate]);

  const catalogItems = catalog?.items ?? [];

  const summarySession =
    route.page === 'summary'
      ? route.sessionId
        ? history.find((s) => s.id === route.sessionId) ?? null
        : history[0] ?? null
      : null;

  return (
    <Layout
      route={route}
      hasActiveSession={Boolean(activeSession)}
      onNavigate={navigate}
    >
      {catalogLoading || !storageReady ? (
        <div
          className="py-16 flex flex-col items-center justify-center gap-3 text-ink-muted"
          role="status"
        >
          <Loader2 className="w-6 h-6 animate-spin text-rubric" aria-hidden="true" />
          <span className="text-sm">Загрузка каталога аудиозаписей…</span>
        </div>
      ) : catalogError ? (
        <div
          role="alert"
          className="max-w-xl mx-auto bg-surface border border-rubric/30 rounded-lg p-6 space-y-4"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="w-5 h-5 text-rubric shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div className="space-y-1">
              <h1 className="font-serif text-2xl font-semibold text-ink">
                Не удалось загрузить каталог
              </h1>
              <p className="text-sm text-ink-muted leading-relaxed">{catalogError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void fetchCatalog()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-md bg-rubric text-white text-sm font-semibold hover:bg-rubric-hover transition-colors cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            <span>Повторить загрузку</span>
          </button>
        </div>
      ) : (
        <>
          {route.page === 'setup' && (
            <SetupPage
              catalogItems={catalogItems}
              preferences={preferences}
              activeSession={activeSession}
              onStartQuiz={handleStartQuiz}
              onResumeActive={() => navigate({ page: 'quiz' })}
              onSavePreferences={handleSavePreferences}
            />
          )}

          {route.page === 'quiz' && (
            <QuizPage
              session={activeSession}
              catalogItems={catalogItems}
              onSubmitAttempt={handleSubmitAttempt}
              onRevealAnswer={handleRevealAnswer}
              onSkipTurn={() => handleAdvanceTurn('skip')}
              onNextTurn={() => handleAdvanceTurn('next')}
              onRecordReplay={handleRecordReplay}
              onAudioUnavailable={handleAudioUnavailable}
              onFinishSession={handleFinishSession}
              onGoToSetup={() => navigate({ page: 'setup' })}
            />
          )}

          {route.page === 'summary' && (
            <SummaryPage
              session={summarySession}
              catalogItems={catalogItems}
              onRestartWithConfig={handleStartQuiz}
              onNavigate={navigate}
            />
          )}

          {route.page === 'catalog' && (
            <CatalogPage catalogItems={catalogItems} focusId={route.focusId} />
          )}
        </>
      )}
    </Layout>
  );
}
