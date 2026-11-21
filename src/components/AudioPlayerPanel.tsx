import { AlertTriangle, Loader2, Pause, Play, RotateCcw, Square, Volume2 } from 'lucide-react';
import { formatAudioTime, type AudioPlayerSnapshot } from '../services/audioPlayer.ts';

interface AudioPlayerPanelProps {
  mode: 'blind' | 'study';
  title?: string;
  subtitle?: string;
  targetUrl: string | null;
  player: AudioPlayerSnapshot;
  onPlay: () => void;
  onPause: () => void;
  onReplay: () => void;
  onStop?: () => void;
  onSeek: (time: number) => void;
  disabled?: boolean;
  externalError?: string | null;
}

export function AudioPlayerPanel({
  mode,
  title,
  subtitle,
  targetUrl,
  player,
  onPlay,
  onPause,
  onReplay,
  onStop,
  onSeek,
  disabled = false,
  externalError = null,
}: AudioPlayerPanelProps) {
  const isCurrentTrack = Boolean(targetUrl && player.url === targetUrl);
  const status = isCurrentTrack ? player.status : 'idle';
  const currentTime = isCurrentTrack ? player.currentTime : 0;
  const duration = isCurrentTrack ? player.duration : 0;
  const errorMessage = externalError ?? (isCurrentTrack ? player.errorMessage : null);
  const autoplayBlocked = isCurrentTrack && player.autoplayBlocked;

  const isPlaying = status === 'playing';
  const isLoading = status === 'loading';
  const hasError = Boolean(errorMessage) || status === 'error';

  const progressPercent = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;

  return (
    <div
      className="bg-surface border border-border rounded-lg p-5 sm:p-6"
      aria-label={mode === 'blind' ? 'Плеер задания' : 'Плеер изучения'}
    >
      {mode === 'study' && title && (
        <div className="mb-4">
          <div className="font-serif text-2xl font-semibold text-ink">{title}</div>
          {subtitle && <div className="text-xs text-ink-muted mt-1">{subtitle}</div>}
        </div>
      )}

      {hasError ? (
        <div
          role="alert"
          className="flex items-start gap-3 p-4 rounded-md bg-rubric-soft border border-rubric/20 text-rubric"
        >
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-sm">
            <div className="font-semibold">Запись недоступна</div>
            <p className="mt-1 text-ink-muted">
              {errorMessage || 'Не удалось загрузить или воспроизвести аудиозапись.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={disabled || !targetUrl}
              onClick={isPlaying ? onPause : onPlay}
              aria-label={isPlaying ? 'Пауза' : 'Воспроизвести запись'}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] rounded-md bg-rubric text-white font-semibold text-sm hover:bg-rubric-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              ) : isPlaying ? (
                <Pause className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Play className="w-4 h-4" aria-hidden="true" />
              )}
              <span>
                {isLoading ? 'Загрузка…' : isPlaying ? 'Пауза' : 'Воспроизвести'}
              </span>
            </button>

            <button
              type="button"
              disabled={disabled || !targetUrl}
              onClick={onReplay}
              aria-label="Повторить запись с начала"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-md bg-subtle text-ink font-medium text-sm border border-border hover:border-border-strong disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
              <span>Повторить</span>
            </button>

            {mode === 'study' && onStop && (
              <button
                type="button"
                disabled={disabled || !isCurrentTrack || status === 'idle'}
                onClick={onStop}
                aria-label="Остановить воспроизведение"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] rounded-md bg-surface text-ink-muted font-medium text-sm border border-border hover:text-ink hover:border-border-strong disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Square className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Стоп</span>
              </button>
            )}

            <div className="ml-auto flex items-center gap-2 text-xs text-ink-muted font-mono tabular-nums">
              <Volume2 className="w-4 h-4 text-ink-faint" aria-hidden="true" />
              <span>
                {formatAudioTime(currentTime)} / {formatAudioTime(duration)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="range"
              min={0}
              max={duration > 0 ? duration : 1}
              step={0.05}
              value={Math.min(currentTime, duration > 0 ? duration : 1)}
              disabled={disabled || duration <= 0}
              onChange={(e) => onSeek(Number(e.target.value))}
              aria-label="Позиция воспроизведения"
              className="w-full h-2 accent-rubric cursor-pointer disabled:cursor-default"
            />
            <span className="sr-only">{Math.round(progressPercent)}%</span>
          </div>

          {autoplayBlocked && (
            <p className="text-xs text-warn" role="status">
              Браузер ограничил автоматический запуск звука. Нажмите «Воспроизвести», чтобы прослушать фрагмент.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
