import {
  ALL_CATEGORIES,
  ALL_GLASES,
  ALL_KNEES,
  type CategoryCode,
  type ExerciseTurnRecord,
  type GlasNumber,
  type KneeCode,
  type TrainingSessionRecord,
} from './types.ts';

export interface DifficultExerciseItem {
  exerciseId: string;
  category: CategoryCode;
  glas: GlasNumber;
  knee: KneeCode;
  wrongAttempts: number;
  hintsUsed: number;
  skips: number;
  solvedEventually: boolean;
}

export interface SessionSummaryStats {
  totalUniqueInPool: number;
  heardUniqueCount: number;
  solvedUniqueCount: number;
  unsolvedUniqueCount: number;
  solvedFirstTryCount: number;
  solvedLaterTryCount: number;
  totalCheckedAttempts: number;
  wrongCheckedAttempts: number;
  firstAttemptCount: number;
  firstAttemptGlasCorrect: number;
  firstAttemptKneeCorrect: number;
  firstAttemptGlasAccuracy: number | null;
  firstAttemptKneeAccuracy: number | null;
  skipsCount: number;
  hintsCount: number;
  replaysCount: number;
  audioErrorsCount: number;
  difficultExercises: DifficultExerciseItem[];
}

export function computeSessionSummary(session: TrainingSessionRecord): SessionSummaryStats {
  const unavailableSet = new Set(session.unavailableIds);
  const validPoolIds = session.poolIds.filter((id) => !unavailableSet.has(id));
  const totalUniqueInPool = validPoolIds.length;

  const heardSet = new Set<string>();
  const solvedSet = new Set<string>(session.solvedIds);

  let solvedFirstTryCount = 0;
  let solvedLaterTryCount = 0;
  let totalCheckedAttempts = 0;
  let wrongCheckedAttempts = 0;
  let firstAttemptCount = 0;
  let firstAttemptGlasCorrect = 0;
  let firstAttemptKneeCorrect = 0;
  let skipsCount = 0;
  let hintsCount = 0;
  let replaysCount = 0;
  let audioErrorsCount = 0;

  const difficultMap = new Map<string, DifficultExerciseItem>();

  const ensureDifficult = (turn: ExerciseTurnRecord): DifficultExerciseItem => {
    const existing = difficultMap.get(turn.exerciseId);
    if (existing) return existing;
    const created: DifficultExerciseItem = {
      exerciseId: turn.exerciseId,
      category: turn.category,
      glas: turn.glas,
      knee: turn.knee,
      wrongAttempts: 0,
      hintsUsed: 0,
      skips: 0,
      solvedEventually: solvedSet.has(turn.exerciseId),
    };
    difficultMap.set(turn.exerciseId, created);
    return created;
  };

  for (const turn of session.turns) {
    replaysCount += turn.replayCount;

    if (turn.outcome === 'audio_error') {
      audioErrorsCount += 1;
      continue;
    }

    heardSet.add(turn.exerciseId);

    if (turn.outcome === 'skipped') {
      skipsCount += 1;
    }
    if (turn.usedHint || turn.outcome === 'revealed') {
      hintsCount += 1;
    }

    if (turn.outcome === 'solved') {
      solvedSet.add(turn.exerciseId);
      if (turn.solvedOnFirstTry) {
        solvedFirstTryCount += 1;
      } else {
        solvedLaterTryCount += 1;
      }
    }

    if (turn.attempts.length > 0) {
      firstAttemptCount += 1;
      const first = turn.attempts[0];
      if (first.glasCorrect) firstAttemptGlasCorrect += 1;
      if (first.kneeCorrect) firstAttemptKneeCorrect += 1;
    }

    let turnWrongAttempts = 0;
    for (const attempt of turn.attempts) {
      totalCheckedAttempts += 1;
      if (!attempt.isCorrect) {
        wrongCheckedAttempts += 1;
        turnWrongAttempts += 1;
      }
    }

    if (turnWrongAttempts > 0 || turn.usedHint || turn.outcome === 'skipped') {
      const entry = ensureDifficult(turn);
      entry.wrongAttempts += turnWrongAttempts;
      if (turn.usedHint) entry.hintsUsed += 1;
      if (turn.outcome === 'skipped') entry.skips += 1;
      entry.solvedEventually = solvedSet.has(turn.exerciseId);
    }
  }

  const solvedUniqueCount = Array.from(solvedSet).filter((id) => !unavailableSet.has(id)).length;
  const unsolvedUniqueCount = Math.max(0, totalUniqueInPool - solvedUniqueCount);

  const difficultExercises = Array.from(difficultMap.values()).sort((a, b) => {
    const scoreA = a.wrongAttempts * 3 + a.hintsUsed * 4 + a.skips;
    const scoreB = b.wrongAttempts * 3 + b.hintsUsed * 4 + b.skips;
    return scoreB - scoreA;
  });

  return {
    totalUniqueInPool,
    heardUniqueCount: heardSet.size,
    solvedUniqueCount,
    unsolvedUniqueCount,
    solvedFirstTryCount,
    solvedLaterTryCount,
    totalCheckedAttempts,
    wrongCheckedAttempts,
    firstAttemptCount,
    firstAttemptGlasCorrect,
    firstAttemptKneeCorrect,
    firstAttemptGlasAccuracy:
      firstAttemptCount > 0
        ? Math.round((firstAttemptGlasCorrect / firstAttemptCount) * 100)
        : null,
    firstAttemptKneeAccuracy:
      firstAttemptCount > 0
        ? Math.round((firstAttemptKneeCorrect / firstAttemptCount) * 100)
        : null,
    skipsCount,
    hintsCount,
    replaysCount,
    audioErrorsCount,
    difficultExercises,
  };
}

export interface SliceStats {
  key: string;
  turnsWithAttempts: number;
  solvedFirstTry: number;
  firstTryAccuracy: number | null;
  glasFirstAccuracy: number | null;
  kneeFirstAccuracy: number | null;
  wrongAttempts: number;
  skips: number;
  hints: number;
}

function aggregateTurnsToSlice(key: string, turns: readonly ExerciseTurnRecord[]): SliceStats {
  let turnsWithAttempts = 0;
  let solvedFirstTry = 0;
  let glasCorrectFirst = 0;
  let kneeCorrectFirst = 0;
  let wrongAttempts = 0;
  let skips = 0;
  let hints = 0;

  for (const turn of turns) {
    if (turn.outcome === 'audio_error') continue;
    if (turn.outcome === 'skipped') skips += 1;
    if (turn.usedHint) hints += 1;

    if (turn.attempts.length > 0) {
      turnsWithAttempts += 1;
      if (turn.solvedOnFirstTry) solvedFirstTry += 1;
      if (turn.attempts[0].glasCorrect) glasCorrectFirst += 1;
      if (turn.attempts[0].kneeCorrect) kneeCorrectFirst += 1;
    }

    for (const attempt of turn.attempts) {
      if (!attempt.isCorrect) wrongAttempts += 1;
    }
  }

  return {
    key,
    turnsWithAttempts,
    solvedFirstTry,
    firstTryAccuracy:
      turnsWithAttempts > 0 ? Math.round((solvedFirstTry / turnsWithAttempts) * 100) : null,
    glasFirstAccuracy:
      turnsWithAttempts > 0 ? Math.round((glasCorrectFirst / turnsWithAttempts) * 100) : null,
    kneeFirstAccuracy:
      turnsWithAttempts > 0 ? Math.round((kneeCorrectFirst / turnsWithAttempts) * 100) : null,
    wrongAttempts,
    skips,
    hints,
  };
}

export interface HistoricalBreakdowns {
  totalSessions: number;
  totalCheckedAttempts: number;
  overallFirstTryAccuracy: number | null;
  byCategory: Record<CategoryCode, SliceStats>;
  byGlas: Record<GlasNumber, SliceStats>;
  byKnee: Record<KneeCode, SliceStats>;
}

export function computeHistoricalBreakdowns(
  sessions: readonly TrainingSessionRecord[]
): HistoricalBreakdowns {
  const allTurns: ExerciseTurnRecord[] = [];
  for (const session of sessions) {
    for (const turn of session.turns) {
      if (turn.outcome !== 'audio_error') {
        allTurns.push(turn);
      }
    }
  }

  const overall = aggregateTurnsToSlice('all', allTurns);
  let totalCheckedAttempts = 0;
  for (const turn of allTurns) {
    totalCheckedAttempts += turn.attempts.length;
  }

  const byCategory = {} as Record<CategoryCode, SliceStats>;
  for (const category of ALL_CATEGORIES) {
    byCategory[category] = aggregateTurnsToSlice(
      category,
      allTurns.filter((t) => t.category === category)
    );
  }

  const byGlas = {} as Record<GlasNumber, SliceStats>;
  for (const glas of ALL_GLASES) {
    byGlas[glas] = aggregateTurnsToSlice(
      String(glas),
      allTurns.filter((t) => t.glas === glas)
    );
  }

  const byKnee = {} as Record<KneeCode, SliceStats>;
  for (const knee of ALL_KNEES) {
    byKnee[knee] = aggregateTurnsToSlice(
      knee,
      allTurns.filter((t) => t.knee === knee)
    );
  }

  return {
    totalSessions: sessions.length,
    totalCheckedAttempts,
    overallFirstTryAccuracy: overall.firstTryAccuracy,
    byCategory,
    byGlas,
    byKnee,
  };
}

export function formatDurationRu(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  if (hours > 0) {
    return `${hours} ч ${minutes} мин`;
  }
  if (minutes > 0) {
    return `${minutes} мин ${seconds} с`;
  }
  return `${seconds} с`;
}

export function formatPercentOrNoData(value: number | null): string {
  return value === null ? 'Нет данных' : `${value}%`;
}
