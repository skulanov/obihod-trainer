export type CategoryCode = 'trop' | 'stih';

export type GlasNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type KneeCode = '1' | '1a' | '2' | '2a' | '3' | '4' | '5' | 'К';

export const ALL_CATEGORIES: readonly CategoryCode[] = ['trop', 'stih'] as const;

export const ALL_GLASES: readonly GlasNumber[] = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export const ALL_KNEES: readonly KneeCode[] = ['1', '1a', '2', '2a', '3', '4', '5', 'К'] as const;

export const CATEGORY_LABELS: Record<CategoryCode, string> = {
  trop: 'Тропари',
  stih: 'Стихиры',
};

export const CATEGORY_SINGULAR: Record<CategoryCode, string> = {
  trop: 'Тропарь',
  stih: 'Стихира',
};

export function formatKneeLabel(knee: KneeCode, verbose = true): string {
  if (knee === 'К' && verbose) {
    return 'К (конечное)';
  }
  return knee;
}

export function formatExerciseTitle(
  category: CategoryCode,
  glas: GlasNumber,
  knee: KneeCode
): string {
  return `${CATEGORY_LABELS[category]} · Глас ${glas} · Колено ${formatKneeLabel(knee)}`;
}

export interface CatalogItem {
  id: string;
  category: CategoryCode;
  glas: GlasNumber;
  knee: KneeCode;
  file: string;
  originalFilename?: string;
}

export interface CatalogData {
  schemaVersion: 1;
  generatedAt: string;
  items: CatalogItem[];
}

export type QuizMode = 'finite' | 'infinite';

export interface QuizConfig {
  category: CategoryCode;
  glases: GlasNumber[];
  mode: QuizMode;
}

export type AnswerVerdict = 'both_correct' | 'glas_only' | 'knee_only' | 'both_wrong';

export interface CheckedAttempt {
  glas: GlasNumber;
  knee: KneeCode;
  glasCorrect: boolean;
  kneeCorrect: boolean;
  isCorrect: boolean;
  verdict: AnswerVerdict;
  timestamp: number;
}

export type TurnOutcome = 'solved' | 'skipped' | 'revealed' | 'audio_error';

export interface ExerciseSnapshot {
  category: CategoryCode;
  glas: GlasNumber;
  knee: KneeCode;
}

export interface ExerciseTurnRecord {
  turnId: string;
  exerciseId: string;
  category: CategoryCode;
  glas: GlasNumber;
  knee: KneeCode;
  startedAt: number;
  finishedAt: number;
  attempts: CheckedAttempt[];
  replayCount: number;
  outcome: TurnOutcome;
  solvedOnFirstTry: boolean;
  usedHint: boolean;
}

export interface CurrentTurnState {
  turnId: string;
  exerciseId: string;
  category: CategoryCode;
  glas: GlasNumber;
  knee: KneeCode;
  startedAt: number;
  attempts: CheckedAttempt[];
  replayCount: number;
  revealedAnswer: boolean;
  solved: boolean;
  audioError: string | null;
}

export type FinalSessionStatus = 'completed' | 'stopped' | 'interrupted';

export interface ActiveQuizSession {
  id: string;
  config: QuizConfig;
  poolIds: string[];
  poolSnapshots: Record<string, ExerciseSnapshot>;
  solvedIds: string[];
  unavailableIds: string[];
  lastExerciseId: string | null;
  startedAt: number;
  updatedAt: number;
  turns: ExerciseTurnRecord[];
  currentTurn: CurrentTurnState | null;
}

export interface TrainingSessionRecord {
  id: string;
  config: QuizConfig;
  poolIds: string[];
  poolSnapshots: Record<string, ExerciseSnapshot>;
  solvedIds: string[];
  unavailableIds: string[];
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  status: FinalSessionStatus;
  turns: ExerciseTurnRecord[];
}

export interface UserPreferences {
  lastCategory: CategoryCode;
  lastGlasesByCategory: Record<CategoryCode, GlasNumber[]>;
  lastMode: QuizMode;
}

export const SESSION_STATUS_LABELS: Record<FinalSessionStatus, string> = {
  completed: 'Завершена',
  stopped: 'Остановлена пользователем',
  interrupted: 'Прервана',
};

export const QUIZ_MODE_LABELS: Record<QuizMode, string> = {
  finite: 'Конечный',
  infinite: 'Бесконечный',
};
