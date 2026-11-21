import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Eye,
  Flag,
  HelpCircle,
  SkipForward,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { AudioPlayerPanel } from '../components/AudioPlayerPanel.tsx';
import { ConfirmModal } from '../components/ConfirmModal.tsx';
import {
  getRemainingCount,
  getVerdictLabel,
} from '../domain/quizEngine.ts';
import {
  ALL_GLASES,
  ALL_KNEES,
  formatKneeLabel,
  type ActiveQuizSession,
  type CatalogItem,
  type GlasNumber,
  type KneeCode,
} from '../domain/types.ts';
import { useAudioPlayer } from '../services/audioPlayer.ts';
import { resolveStaticUrl } from '../services/urlResolver.ts';

interface QuizPageProps {
  session: ActiveQuizSession | null;
  catalogItems: readonly CatalogItem[];
  onSubmitAttempt: (
    glas: GlasNumber | null,
    kneeRaw: string | null
  ) => { ok: true } | { ok: false; message: string };
  onRevealAnswer: () => void;
  onSkipTurn: () => void;
  onNextTurn: () => void;
  onRecordReplay: () => void;
  onAudioUnavailable: (message: string) => void;
  onFinishSession: () => void;
  onGoToSetup: () => void;
}

export function QuizPage({
  session,
  catalogItems,
  onSubmitAttempt,
  onRevealAnswer,
  onSkipTurn,
  onNextTurn,
  onRecordReplay,
  onAudioUnavailable,
  onFinishSession,
  onGoToSetup,
}: QuizPageProps) {
  const player = useAudioPlayer();

  const [selectedGlas, setSelectedGlas] = useState<GlasNumber | null>(null);
  const [selectedKnee, setSelectedKnee] = useState<KneeCode | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [confirmFinishOpen, setConfirmFinishOpen] = useState(false);

  const turn = session?.currentTurn ?? null;

  const catalogItem = useMemo(() => {
    if (!turn) return null;
    return catalogItems.find((item) => item.id === turn.exerciseId) ?? null;
  }, [catalogItems, turn]);

  const targetUrl = catalogItem ? resolveStaticUrl(catalogItem.file) : null;

  // Reset input selections whenever the active turn changes
  useEffect(() => {
    setSelectedGlas(null);
    setSelectedKnee(null);
    setValidationError(null);
    player.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turn?.turnId]);

  // If a restored session points to a recording removed from the catalog, mark unavailable
  useEffect(() => {
    if (turn && !catalogItem && !turn.audioError) {
      onAudioUnavailable('Запись более недоступна в текущей версии аудиотеки.');
    }
  }, [turn, catalogItem, onAudioUnavailable]);

  // Propagate audio element errors into session state (АУД-01)
  useEffect(() => {
    if (
      turn &&
      targetUrl &&
      player.url === targetUrl &&
      player.status === 'error' &&
      !turn.audioError
    ) {
      onAudioUnavailable(
        player.errorMessage || 'Не удалось воспроизвести аудиофайл.'
      );
    }
  }, [turn, targetUrl, player.url, player.status, player.errorMessage, onAudioUnavailable]);

  const handlePlay = () => {
    if (!targetUrl || turn?.audioError) return;
    const isRestartingEnded =
      player.url === targetUrl && player.status === 'ended';
    if (isRestartingEnded) {
      onRecordReplay();
    }
    void player.play(targetUrl, isRestartingEnded);
  };

  const handleReplay = () => {
    if (!targetUrl || turn?.audioError) return;
    if (player.url === targetUrl && player.status !== 'idle') {
      onRecordReplay();
    }
    void player.play(targetUrl, true);
  };

  const handleKneeButtonClick = (knee: KneeCode) => {
    setSelectedKnee(knee);
    setValidationError(null);
  };

  const handleCheck = () => {
    if (!turn) return;
    const res = onSubmitAttempt(selectedGlas, selectedKnee);
    if (!res.ok) {
      setValidationError(res.message);
    } else {
      setValidationError(null);
    }
  };

  const remaining = session ? getRemainingCount(session) : null;
  const isTurnFinished = Boolean(
    turn && (turn.solved || turn.revealedAnswer || turn.audioError)
  );
  const isLastFiniteResolved = Boolean(
    session &&
      session.config.mode === 'finite' &&
      remaining === 0 &&
      turn?.solved
  );

  // Keyboard shortcuts for smooth desktop training
  useEffect(() => {
    if (!session || !turn || confirmFinishOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;

      if (e.key === 'Enter') {
        if (isTurnFinished) {
          e.preventDefault();
          onNextTurn();
        } else {
          e.preventDefault();
          handleCheck();
        }
        return;
      }

      if (e.code === 'Space' && target?.tagName !== 'BUTTON') {
        e.preventDefault();
        if (player.status === 'playing') {
          player.pause();
        } else {
          handlePlay();
        }
        return;
      }

      if ((e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К') && e.altKey) {
        e.preventDefault();
        handleReplay();
        return;
      }

      if (!isTurnFinished && /^[1-8]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        setSelectedGlas(Number(e.key) as GlasNumber);
        setValidationError(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, turn, confirmFinishOpen, isTurnFinished, selectedGlas, selectedKnee, player.status]);

  if (!session || !turn) {
    return (
      <div className="max-w-xl mx-auto bg-surface border border-border rounded-lg p-8 text-center space-y-4">
        <h1 className="font-serif text-3xl font-semibold text-ink">
          Нет активной тренировки
        </h1>
        <p className="text-sm text-ink-muted">
          Настройте параметры выборки, чтобы начать новое занятие.
        </p>
        <button
          type="button"
          onClick={onGoToSetup}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[44px] rounded-md bg-rubric text-white font-semibold text-sm hover:bg-rubric-hover transition-colors cursor-pointer"
        >
          <span>Перейти к настройке</span>
        </button>
      </div>
    );
  }

  const lastAttempt =
    turn.attempts.length > 0 ? turn.attempts[turn.attempts.length - 1] : null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Instruction */}
      <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-ink">
        Послушайте запись и определите глас и колено
      </h1>

      {/* Blind Audio Player */}
      <AudioPlayerPanel
        mode="blind"
        targetUrl={targetUrl}
        player={player}
        onPlay={handlePlay}
        onPause={player.pause}
        onReplay={handleReplay}
        onSeek={player.seek}
        externalError={turn.audioError}
      />

      {/* Audio unavailable recovery bar (АУД-01) */}
      {turn.audioError && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-surface border border-border rounded-lg p-4">
          <p className="text-sm text-ink-muted">
            Эта ошибка не засчитывается как ошибка ученика. Запись временно исключена из
            текущей сессии.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onNextTurn}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-md bg-rubric text-white font-semibold text-sm hover:bg-rubric-hover transition-colors whitespace-nowrap cursor-pointer"
            >
              <span>Следующее задание</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setConfirmFinishOpen(true)}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-md bg-surface border border-border text-ink-muted font-medium text-sm hover:text-rubric hover:border-rubric/40 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Flag className="w-4 h-4" aria-hidden="true" />
              <span>Завершить занятие</span>
            </button>
          </div>
        </div>
      )}

      {/* Answer controls (Glas 1-8 and constant 8 Knees) */}
      <div className="bg-surface border border-border rounded-lg p-5 sm:p-6 space-y-6">
        {/* Glas 1-8 */}
        <fieldset disabled={isTurnFinished} className="space-y-3">
          <legend className="text-sm font-semibold text-ink">Глас</legend>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {ALL_GLASES.map((g) => {
              const active = selectedGlas === g;
              return (
                <button
                  key={g}
                  type="button"
                  aria-pressed={active}
                  aria-label={`Глас ${g}`}
                  onClick={() => {
                    setSelectedGlas(g);
                    setValidationError(null);
                  }}
                  className={`min-h-[48px] rounded-md border font-mono text-base font-semibold tabular-nums transition-colors ${
                    active
                      ? 'bg-rubric text-white border-rubric'
                      : 'bg-canvas text-ink border-border hover:border-border-strong'
                  } disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer`}
                >
                  {g}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Knee constant full list (ВИК-08: never narrowed!) */}
        <fieldset disabled={isTurnFinished} className="space-y-3">
          <legend className="text-sm font-semibold text-ink">Колено</legend>

          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {ALL_KNEES.map((k) => {
              const active = selectedKnee === k;
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={active}
                  aria-label={`Колено ${formatKneeLabel(k)}`}
                  onClick={() => handleKneeButtonClick(k)}
                  className={`min-h-[48px] px-1 rounded-md border flex flex-col items-center justify-center transition-colors ${
                    active
                      ? 'bg-rubric text-white border-rubric'
                      : 'bg-canvas text-ink border-border hover:border-border-strong'
                  } disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer`}
                >
                  <span className="font-mono text-base font-semibold leading-none">
                    {k}
                  </span>
                  {k === 'К' && (
                    <span
                      className={`text-[10px] mt-0.5 leading-none ${
                        active ? 'text-white/85' : 'text-ink-faint'
                      }`}
                    >
                      конечн.
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Incomplete input hint */}
        {validationError && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2 text-sm text-warn bg-warn-soft border border-warn/25 rounded-md px-3.5 py-2.5"
          >
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Result feedback panel (inline, dual-coded icon + text) */}
        <div aria-live="polite" className="space-y-3">
          {lastAttempt && !turn.revealedAnswer && (
            <div
              className={`rounded-md border p-4 space-y-2.5 ${
                lastAttempt.isCorrect
                  ? 'bg-correct-soft border-correct/25'
                  : 'bg-rubric-soft border-rubric/20'
              }`}
            >
              <div className="flex items-center gap-2 font-semibold text-sm">
                {lastAttempt.isCorrect ? (
                  <CheckCircle2
                    className="w-5 h-5 text-correct shrink-0"
                    aria-hidden="true"
                  />
                ) : (
                  <XCircle
                    className="w-5 h-5 text-rubric shrink-0"
                    aria-hidden="true"
                  />
                )}
                <span className={lastAttempt.isCorrect ? 'text-correct' : 'text-rubric'}>
                  {getVerdictLabel(lastAttempt.verdict)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-2 text-ink">
                  {lastAttempt.glasCorrect ? (
                    <CheckCircle2
                      className="w-4 h-4 text-correct shrink-0"
                      aria-hidden="true"
                    />
                  ) : (
                    <XCircle
                      className="w-4 h-4 text-rubric shrink-0"
                      aria-hidden="true"
                    />
                  )}
                  <span>
                    Глас{' '}
                    <span className="font-mono font-semibold">{lastAttempt.glas}</span>:{' '}
                    {lastAttempt.glasCorrect ? 'верно' : 'неверно'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-ink">
                  {lastAttempt.kneeCorrect ? (
                    <CheckCircle2
                      className="w-4 h-4 text-correct shrink-0"
                      aria-hidden="true"
                    />
                  ) : (
                    <XCircle
                      className="w-4 h-4 text-rubric shrink-0"
                      aria-hidden="true"
                    />
                  )}
                  <span>
                    Колено{' '}
                    <span className="font-mono font-semibold">
                      {formatKneeLabel(lastAttempt.knee)}
                    </span>
                    : {lastAttempt.kneeCorrect ? 'верно' : 'неверно'}
                  </span>
                </div>
              </div>

              {lastAttempt.isCorrect ? (
                <p className="text-xs text-ink-muted">
                  {turn.attempts.length === 1
                    ? 'Засчитано с первой попытки.'
                    : `Верный ответ найден с ${turn.attempts.length}-й попытки.`}
                </p>
              ) : (
                <p className="text-xs text-ink-muted">
                  Прослушайте запись ещё раз и попробуйте уточнить ответ или откройте
                  подсказку.
                </p>
              )}
            </div>
          )}

          {turn.revealedAnswer && (
            <div className="rounded-md border border-warn/30 bg-warn-soft p-4 space-y-1.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-warn">
                <Eye className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>
                  Правильный ответ: Глас {turn.glas} · Колено{' '}
                  {formatKneeLabel(turn.knee)}
                </span>
              </div>
              <p className="text-xs text-ink-muted">
                Просмотр ответа зафиксирован.{' '}
                {session.config.mode === 'finite'
                  ? 'В конечном режиме это колено остаётся в наборе и встретится снова.'
                  : 'Задание отмечено как неосвоенное.'}
              </p>
            </div>
          )}
        </div>

        {/* Action buttons */}
        {!turn.audioError && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border">
            {isTurnFinished ? (
              <button
                type="button"
                onClick={onNextTurn}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[46px] rounded-md bg-rubric text-white font-semibold text-sm hover:bg-rubric-hover transition-colors whitespace-nowrap cursor-pointer"
              >
                <span>
                  {isLastFiniteResolved ? 'Перейти к итогам' : 'Следующее задание'}
                </span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleCheck}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 min-h-[46px] rounded-md bg-rubric text-white font-semibold text-sm hover:bg-rubric-hover transition-colors whitespace-nowrap cursor-pointer"
                >
                  <span>Проверить</span>
                </button>

                <button
                  type="button"
                  onClick={onSkipTurn}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[46px] rounded-md bg-subtle border border-border text-ink font-medium text-sm hover:border-border-strong transition-colors whitespace-nowrap cursor-pointer"
                >
                  <SkipForward className="w-4 h-4 text-ink-muted" aria-hidden="true" />
                  <span>Другое колено</span>
                </button>

                <button
                  type="button"
                  onClick={onRevealAnswer}
                  className="inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[46px] rounded-md bg-surface border border-border text-ink-muted font-medium text-sm hover:text-ink hover:border-border-strong transition-colors whitespace-nowrap cursor-pointer"
                >
                  <HelpCircle className="w-4 h-4" aria-hidden="true" />
                  <span>Не знаю / Показать ответ</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => setConfirmFinishOpen(true)}
              className="sm:ml-auto inline-flex items-center justify-center gap-2 px-4 py-3 min-h-[46px] rounded-md bg-surface border border-border text-ink-muted font-medium text-sm hover:text-rubric hover:border-rubric/40 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Flag className="w-4 h-4" aria-hidden="true" />
              <span>Завершить занятие</span>
            </button>
          </div>
        )}
      </div>

      <ConfirmModal
        open={confirmFinishOpen}
        title="Завершить занятие?"
        description="Текущие результаты будут сохранены в истории со статусом «Остановлена пользователем», и откроется экран итогов."
        confirmLabel="Завершить и показать итоги"
        cancelLabel="Продолжить тренировку"
        onConfirm={() => {
          setConfirmFinishOpen(false);
          onFinishSession();
        }}
        onCancel={() => setConfirmFinishOpen(false)}
      />
    </div>
  );
}
