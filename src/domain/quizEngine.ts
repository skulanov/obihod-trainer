import { normalizeKnee } from './parser.ts';
import type {
  ActiveQuizSession,
  AnswerVerdict,
  CatalogItem,
  CheckedAttempt,
  CurrentTurnState,
  ExerciseSnapshot,
  ExerciseTurnRecord,
  FinalSessionStatus,
  GlasNumber,
  KneeCode,
  QuizConfig,
  QuizMode,
  TrainingSessionRecord,
} from './types.ts';

export type RandomFn = () => number;

export function createId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 9);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

/**
 * Filters the catalog strictly by configured category and selected glases.
 */
export function filterPoolByConfig(
  catalogItems: readonly CatalogItem[],
  config: QuizConfig
): CatalogItem[] {
  const glasSet = new Set<GlasNumber>(config.glases);
  return catalogItems.filter(
    (item) => item.category === config.category && glasSet.has(item.glas)
  );
}

/**
 * Selects the next exercise following MVP rules (§7):
 * 1. Exclude unavailable items; in finite mode also exclude already-solved items.
 * 2. Pick a glas uniformly at random among glases that still have remaining exercises.
 * 3. Pick a knee uniformly at random within that glas.
 * 4. Avoid repeating `lastExerciseId` twice in a row whenever at least 2 exercises remain,
 *    without risking an infinite loop when only 1 exercise remains.
 */
export function pickNextExercise(
  pool: readonly CatalogItem[],
  solvedIds: readonly string[],
  unavailableIds: readonly string[],
  lastExerciseId: string | null,
  mode: QuizMode,
  rng: RandomFn = Math.random
): CatalogItem | null {
  const unavailableSet = new Set(unavailableIds);
  const solvedSet = mode === 'finite' ? new Set(solvedIds) : new Set<string>();

  const remaining = pool.filter(
    (item) => !unavailableSet.has(item.id) && !solvedSet.has(item.id)
  );

  if (remaining.length === 0) {
    return null;
  }

  if (remaining.length === 1) {
    return remaining[0];
  }

  // Group remaining exercises by glas
  const byGlas = new Map<GlasNumber, CatalogItem[]>();
  for (const item of remaining) {
    const group = byGlas.get(item.glas);
    if (group) {
      group.push(item);
    } else {
      byGlas.set(item.glas, [item]);
    }
  }

  // Determine glases that have at least one item other than lastExerciseId
  const eligibleGlases: GlasNumber[] = [];
  for (const [glas, items] of byGlas.entries()) {
    const nonRepeatItems = items.filter((item) => item.id !== lastExerciseId);
    if (nonRepeatItems.length > 0) {
      eligibleGlases.push(glas);
    }
  }

  const glasChoices = eligibleGlases.length > 0 ? eligibleGlases : Array.from(byGlas.keys());
  const chosenGlasIndex = Math.min(
    glasChoices.length - 1,
    Math.floor(rng() * glasChoices.length)
  );
  const chosenGlas = glasChoices[chosenGlasIndex];

  const glasItems = byGlas.get(chosenGlas) ?? remaining;
  const nonRepeatInGlas = glasItems.filter((item) => item.id !== lastExerciseId);
  const finalCandidates = nonRepeatInGlas.length > 0 ? nonRepeatInGlas : glasItems;

  const chosenItemIndex = Math.min(
    finalCandidates.length - 1,
    Math.floor(rng() * finalCandidates.length)
  );
  return finalCandidates[chosenItemIndex];
}

export interface EvaluationResult {
  ok: true;
  attempt: CheckedAttempt;
}

export interface EvaluationValidationError {
  ok: false;
  message: string;
}

/**
 * Evaluates a user's glas & knee guess separately against the hidden exercise.
 * Accepts raw knee input and normalizes it (`1a` = `1а`, `2a` = `2а`, `К` = `к` = `K` = `k`).
 */
export function evaluateAnswer(
  target: Pick<CatalogItem, 'glas' | 'knee'>,
  selectedGlas: GlasNumber | null,
  selectedKneeRaw: string | null,
  timestamp = Date.now()
): EvaluationResult | EvaluationValidationError {
  if (selectedGlas === null && (!selectedKneeRaw || !selectedKneeRaw.trim())) {
    return { ok: false, message: 'Выберите глас и колено перед проверкой ответа.' };
  }
  if (selectedGlas === null) {
    return { ok: false, message: 'Выберите номер гласа (от 1 до 8).' };
  }
  if (!selectedKneeRaw || !selectedKneeRaw.trim()) {
    return { ok: false, message: 'Выберите обозначение колена.' };
  }

  const normalizedKnee = normalizeKnee(selectedKneeRaw);
  if (!normalizedKnee) {
    return {
      ok: false,
      message: 'Укажите допустимое обозначение колена: 1, 1a, 2, 2a, 3, 4, 5 или К.',
    };
  }

  const glasCorrect = selectedGlas === target.glas;
  const kneeCorrect = normalizedKnee === target.knee;
  const isCorrect = glasCorrect && kneeCorrect;

  let verdict: AnswerVerdict;
  if (glasCorrect && kneeCorrect) {
    verdict = 'both_correct';
  } else if (glasCorrect) {
    verdict = 'glas_only';
  } else if (kneeCorrect) {
    verdict = 'knee_only';
  } else {
    verdict = 'both_wrong';
  }

  return {
    ok: true,
    attempt: {
      glas: selectedGlas,
      knee: normalizedKnee,
      glasCorrect,
      kneeCorrect,
      isCorrect,
      verdict,
      timestamp,
    },
  };
}

export function createTurnState(item: CatalogItem, now = Date.now()): CurrentTurnState {
  return {
    turnId: createId('turn'),
    exerciseId: item.id,
    category: item.category,
    glas: item.glas,
    knee: item.knee,
    startedAt: now,
    attempts: [],
    replayCount: 0,
    revealedAnswer: false,
    solved: false,
    audioError: null,
  };
}

export function createActiveQuizSession(
  config: QuizConfig,
  catalogItems: readonly CatalogItem[],
  rng: RandomFn = Math.random,
  now = Date.now()
): ActiveQuizSession | null {
  const pool = filterPoolByConfig(catalogItems, config);
  if (pool.length === 0) {
    return null;
  }

  const poolSnapshots: Record<string, ExerciseSnapshot> = {};
  for (const item of pool) {
    poolSnapshots[item.id] = {
      category: item.category,
      glas: item.glas,
      knee: item.knee,
    };
  }

  const firstItem = pickNextExercise(pool, [], [], null, config.mode, rng);
  if (!firstItem) {
    return null;
  }

  return {
    id: createId('sess'),
    config: {
      category: config.category,
      glases: [...config.glases].sort((a, b) => a - b),
      mode: config.mode,
    },
    poolIds: pool.map((i) => i.id),
    poolSnapshots,
    solvedIds: [],
    unavailableIds: [],
    lastExerciseId: firstItem.id,
    startedAt: now,
    updatedAt: now,
    turns: [],
    currentTurn: createTurnState(firstItem, now),
  };
}

/**
 * Records a checked attempt on the current turn.
 * If solved, marks the turn solved and adds exerciseId to solvedIds (in finite mode).
 */
export function submitAttemptOnSession(
  session: ActiveQuizSession,
  selectedGlas: GlasNumber | null,
  selectedKneeRaw: string | null,
  now = Date.now()
):
  | { ok: true; session: ActiveQuizSession; attempt: CheckedAttempt }
  | { ok: false; message: string } {
  const turn = session.currentTurn;
  if (!turn) {
    return { ok: false, message: 'Нет активного задания.' };
  }
  if (turn.audioError) {
    return {
      ok: false,
      message: 'Запись недоступна для воспроизведения. Перейдите к следующему заданию.',
    };
  }
  if (turn.solved || turn.revealedAnswer) {
    return { ok: false, message: 'Задание уже завершено. Перейдите к следующей записи.' };
  }

  const evalResult = evaluateAnswer(
    { glas: turn.glas, knee: turn.knee },
    selectedGlas,
    selectedKneeRaw,
    now
  );
  if (!evalResult.ok) {
    return evalResult;
  }

  const attempt = evalResult.attempt;
  const updatedAttempts = [...turn.attempts, attempt];
  const isSolvedNow = attempt.isCorrect;

  const updatedTurn: CurrentTurnState = {
    ...turn,
    attempts: updatedAttempts,
    solved: isSolvedNow,
  };

  let solvedIds = session.solvedIds;
  if (isSolvedNow && !solvedIds.includes(turn.exerciseId)) {
    solvedIds = [...solvedIds, turn.exerciseId];
  }

  return {
    ok: true,
    attempt,
    session: {
      ...session,
      solvedIds,
      updatedAt: now,
      currentTurn: updatedTurn,
    },
  };
}

/**
 * Marks the current turn as revealed (hint used).
 * Per MVP §8.3: does NOT mark exercise solved; in finite mode it remains in the unsolved set.
 */
export function revealAnswerOnSession(
  session: ActiveQuizSession,
  now = Date.now()
): ActiveQuizSession {
  const turn = session.currentTurn;
  if (!turn || turn.solved || turn.revealedAnswer || turn.audioError) {
    return session;
  }

  return {
    ...session,
    updatedAt: now,
    currentTurn: {
      ...turn,
      revealedAnswer: true,
    },
  };
}

/**
 * Increments replay counter on the current turn.
 */
export function recordReplayOnSession(
  session: ActiveQuizSession,
  now = Date.now()
): ActiveQuizSession {
  if (!session.currentTurn) return session;
  return {
    ...session,
    updatedAt: now,
    currentTurn: {
      ...session.currentTurn,
      replayCount: session.currentTurn.replayCount + 1,
    },
  };
}

/**
 * Marks the current audio recording as unavailable during the session (§8.3, АУД-01).
 * Does NOT count as a student error and excludes the file from further selection in this session.
 */
export function markCurrentAudioUnavailable(
  session: ActiveQuizSession,
  errorMessage: string,
  now = Date.now()
): ActiveQuizSession {
  const turn = session.currentTurn;
  if (!turn) return session;

  const unavailableIds = session.unavailableIds.includes(turn.exerciseId)
    ? session.unavailableIds
    : [...session.unavailableIds, turn.exerciseId];

  return {
    ...session,
    unavailableIds,
    updatedAt: now,
    currentTurn: {
      ...turn,
      audioError: errorMessage,
    },
  };
}

function finalizeCurrentTurn(
  turn: CurrentTurnState,
  forcedOutcome: 'skipped' | null,
  now: number
): ExerciseTurnRecord {
  let outcome: ExerciseTurnRecord['outcome'];
  if (turn.audioError) {
    outcome = 'audio_error';
  } else if (turn.solved) {
    outcome = 'solved';
  } else if (turn.revealedAnswer) {
    outcome = 'revealed';
  } else if (forcedOutcome === 'skipped') {
    outcome = 'skipped';
  } else {
    outcome = 'skipped';
  }

  const solvedOnFirstTry =
    outcome === 'solved' && turn.attempts.length === 1 && !turn.revealedAnswer;

  return {
    turnId: turn.turnId,
    exerciseId: turn.exerciseId,
    category: turn.category,
    glas: turn.glas,
    knee: turn.knee,
    startedAt: turn.startedAt,
    finishedAt: now,
    attempts: turn.attempts,
    replayCount: turn.replayCount,
    outcome,
    solvedOnFirstTry,
    usedHint: turn.revealedAnswer,
  };
}

/**
 * Advances from the current turn (after solved, revealed, audio error, or explicit skip)
 * to the next exercise, or signals that a finite session is complete.
 */
export function advanceSessionTurn(
  session: ActiveQuizSession,
  catalogItems: readonly CatalogItem[],
  action: 'next' | 'skip',
  rng: RandomFn = Math.random,
  now = Date.now()
): { session: ActiveQuizSession; completed: boolean } {
  const turns = [...session.turns];
  if (session.currentTurn) {
    const finalized = finalizeCurrentTurn(
      session.currentTurn,
      action === 'skip' ? 'skipped' : null,
      now
    );
    turns.push(finalized);
  }

  const pool = catalogItems.filter((item) => session.poolIds.includes(item.id));
  const nextItem = pickNextExercise(
    pool,
    session.solvedIds,
    session.unavailableIds,
    session.currentTurn?.exerciseId ?? session.lastExerciseId,
    session.config.mode,
    rng
  );

  if (!nextItem) {
    return {
      completed: true,
      session: {
        ...session,
        turns,
        currentTurn: null,
        updatedAt: now,
      },
    };
  }

  return {
    completed: false,
    session: {
      ...session,
      turns,
      lastExerciseId: nextItem.id,
      currentTurn: createTurnState(nextItem, now),
      updatedAt: now,
    },
  };
}

/**
 * Finalizes an ActiveQuizSession into a persistent TrainingSessionRecord.
 * If the current turn already has attempts, a reveal, or was solved, it is included in turns.
 */
export function finishActiveSession(
  session: ActiveQuizSession,
  status: FinalSessionStatus,
  now = Date.now()
): TrainingSessionRecord {
  const turns = [...session.turns];
  const turn = session.currentTurn;
  if (turn) {
    if (turn.solved || turn.revealedAnswer || turn.audioError || turn.attempts.length > 0) {
      turns.push(finalizeCurrentTurn(turn, null, now));
    }
  }

  const finishedAt = Math.max(now, session.startedAt);
  return {
    id: session.id,
    config: session.config,
    poolIds: session.poolIds,
    poolSnapshots: session.poolSnapshots,
    solvedIds: session.solvedIds,
    unavailableIds: session.unavailableIds,
    startedAt: session.startedAt,
    finishedAt,
    durationMs: Math.max(0, finishedAt - session.startedAt),
    status,
    turns,
  };
}

export function getVerdictLabel(verdict: AnswerVerdict): string {
  switch (verdict) {
    case 'both_correct':
      return 'Верно определены и глас, и колено';
    case 'glas_only':
      return 'Глас верен, колено неверно';
    case 'knee_only':
      return 'Глас неверен, колено верно';
    case 'both_wrong':
      return 'Глас и колено определены неверно';
  }
}

export function getRemainingCount(session: ActiveQuizSession): number | null {
  if (session.config.mode !== 'finite') return null;
  const unavailableSet = new Set(session.unavailableIds);
  const solvedSet = new Set(session.solvedIds);
  return session.poolIds.filter((id) => !unavailableSet.has(id) && !solvedSet.has(id)).length;
}
