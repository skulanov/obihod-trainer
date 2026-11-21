import { useCallback, useEffect, useState } from 'react';

export type AudioPlaybackStatus =
  | 'idle'
  | 'loading'
  | 'playing'
  | 'paused'
  | 'ended'
  | 'error';

export interface AudioPlayerSnapshot {
  url: string | null;
  status: AudioPlaybackStatus;
  currentTime: number;
  duration: number;
  errorMessage: string | null;
  autoplayBlocked: boolean;
}

type Listener = (snapshot: AudioPlayerSnapshot) => void;

class SharedAudioController {
  private audio: HTMLAudioElement | null = null;
  private listeners = new Set<Listener>();
  private state: AudioPlayerSnapshot = {
    url: null,
    status: 'idle',
    currentTime: 0,
    duration: 0,
    errorMessage: null,
    autoplayBlocked: false,
  };
  private playToken = 0;

  private ensureAudio(): HTMLAudioElement {
    if (this.audio) return this.audio;
    const el = new Audio();
    el.preload = 'none';

    el.addEventListener('loadstart', () => {
      if (!this.state.url) return;
      this.patch({ status: 'loading', errorMessage: null });
    });

    el.addEventListener('loadedmetadata', () => {
      this.patch({
        duration: Number.isFinite(el.duration) ? el.duration : 0,
      });
    });

    el.addEventListener('playing', () => {
      this.patch({
        status: 'playing',
        errorMessage: null,
        autoplayBlocked: false,
      });
    });

    el.addEventListener('pause', () => {
      if (this.state.status === 'playing' && !el.ended) {
        this.patch({ status: 'paused' });
      }
    });

    el.addEventListener('timeupdate', () => {
      this.patch({
        currentTime: Number.isFinite(el.currentTime) ? el.currentTime : 0,
        duration: Number.isFinite(el.duration) ? el.duration : this.state.duration,
      });
    });

    el.addEventListener('ended', () => {
      this.patch({
        status: 'ended',
        currentTime: Number.isFinite(el.duration) ? el.duration : this.state.currentTime,
      });
    });

    el.addEventListener('error', () => {
      if (!this.state.url) return;
      const code = el.error?.code;
      let msg = 'Запись недоступна или повреждена.';
      if (code === MediaError.MEDIA_ERR_NETWORK) {
        msg = 'Ошибка сети при загрузке аудиозаписи. Проверьте подключение.';
      } else if (code === MediaError.MEDIA_ERR_DECODE) {
        msg = 'Не удалось декодировать аудиофайл.';
      } else if (code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
        msg = 'Аудиофайл не найден или формат не поддерживается браузером.';
      }
      this.patch({
        status: 'error',
        errorMessage: msg,
        autoplayBlocked: false,
      });
    });

    this.audio = el;
    return el;
  }

  private patch(partial: Partial<AudioPlayerSnapshot>): void {
    this.state = { ...this.state, ...partial };
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  getSnapshot(): AudioPlayerSnapshot {
    return this.state;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async play(url: string, fromStart = false): Promise<boolean> {
    const el = this.ensureAudio();
    const token = ++this.playToken;

    const isSameUrl = this.state.url === url;
    if (!isSameUrl) {
      el.pause();
      el.src = url;
      el.load();
      this.patch({
        url,
        status: 'loading',
        currentTime: 0,
        duration: 0,
        errorMessage: null,
        autoplayBlocked: false,
      });
    } else if (fromStart || el.ended) {
      try {
        el.currentTime = 0;
      } catch {
        // Ignore seek errors before metadata is ready
      }
      this.patch({
        currentTime: 0,
        errorMessage: null,
        autoplayBlocked: false,
      });
    }

    try {
      await el.play();
      if (token !== this.playToken) return false;
      return true;
    } catch (err) {
      if (token !== this.playToken) return false;
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        this.patch({
          status: 'paused',
          autoplayBlocked: true,
          errorMessage: null,
        });
        return false;
      }
      if (err instanceof DOMException && err.name === 'AbortError') {
        return false;
      }
      this.patch({
        status: 'error',
        errorMessage: 'Запись недоступна: не удалось воспроизвести аудиофайл.',
        autoplayBlocked: false,
      });
      return false;
    }
  }

  pause(): void {
    if (!this.audio) return;
    this.audio.pause();
    if (this.state.status === 'playing' || this.state.status === 'loading') {
      this.patch({ status: 'paused' });
    }
  }

  stop(): void {
    this.playToken += 1;
    if (this.audio) {
      this.audio.pause();
      this.audio.removeAttribute('src');
      this.audio.load();
    }
    this.patch({
      url: null,
      status: 'idle',
      currentTime: 0,
      duration: 0,
      errorMessage: null,
      autoplayBlocked: false,
    });
  }

  seek(timeSeconds: number): void {
    if (!this.audio || !this.state.url) return;
    const clamped = Math.max(0, Math.min(this.state.duration || 0, timeSeconds));
    try {
      this.audio.currentTime = clamped;
      this.patch({ currentTime: clamped });
    } catch {
      // Ignore if media not yet seekable
    }
  }
}

export const sharedAudioController = new SharedAudioController();

export function useAudioPlayer() {
  const [snapshot, setSnapshot] = useState<AudioPlayerSnapshot>(() =>
    sharedAudioController.getSnapshot()
  );

  useEffect(() => {
    return sharedAudioController.subscribe(setSnapshot);
  }, []);

  const play = useCallback((url: string, fromStart = false) => {
    return sharedAudioController.play(url, fromStart);
  }, []);

  const pause = useCallback(() => {
    sharedAudioController.pause();
  }, []);

  const stop = useCallback(() => {
    sharedAudioController.stop();
  }, []);

  const seek = useCallback((sec: number) => {
    sharedAudioController.seek(sec);
  }, []);

  return {
    ...snapshot,
    play,
    pause,
    stop,
    seek,
  };
}

export function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
