import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCatalogFromFilenames,
  getAvailableGlasesForCategory,
  normalizeKnee,
  parseAudioFilename,
  validateCatalogJson,
} from '../src/domain/parser.ts';
import {
  advanceSessionTurn,
  createActiveQuizSession,
  evaluateAnswer,
  filterPoolByConfig,
  finishActiveSession,
  markCurrentAudioUnavailable,
  pickNextExercise,
  revealAnswerOnSession,
  submitAttemptOnSession,
} from '../src/domain/quizEngine.ts';
import { computeHistoricalBreakdowns, computeSessionSummary } from '../src/domain/stats.ts';
import { ALL_KNEES } from '../src/domain/types.ts';

// КАТ-01: При наличии trop_1_1.mp3, trop_1_1a.mp3, stih_6_2.mp3 каталог содержит ровно 3 упражнения, 2 категории и верную привязку к гласам.
test('КАТ-01: корректное построение каталога из трёх валидных файлов', () => {
  const result = buildCatalogFromFilenames([
    'trop_1_1.mp3',
    'trop_1_1a.mp3',
    'stih_6_2.mp3',
  ]);

  assert.equal(result.errors.length, 0);
  assert.equal(result.catalog.items.length, 3);

  const categories = new Set(result.catalog.items.map((i) => i.category));
  assert.deepEqual([...categories].sort(), ['stih', 'trop']);

  assert.deepEqual(
    result.catalog.items.map((i) => i.id),
    ['trop:1:1', 'trop:1:1a', 'stih:6:2']
  );

  const validation = validateCatalogJson(result.catalog);
  assert.equal(validation.ok, true);
});

// КАТ-02: При наличии только trop_1_1.mp3 и trop_4_2.mp3 доступны только гласы 1 и 4.
test('КАТ-02: частичная комплектность — только реально существующие гласы попадают в выборку', () => {
  const result = buildCatalogFromFilenames(['trop_1_1.mp3', 'trop_4_2.mp3']);
  assert.equal(result.errors.length, 0);

  const tropGlases = getAvailableGlasesForCategory(result.catalog.items, 'trop');
  const stihGlases = getAvailableGlasesForCategory(result.catalog.items, 'stih');

  assert.deepEqual(tropGlases, [1, 4]);
  assert.deepEqual(stihGlases, []);

  const pool = filterPoolByConfig(result.catalog.items, {
    category: 'trop',
    glases: [1, 4],
    mode: 'finite',
  });
  assert.equal(pool.length, 2);
});

// КАТ-03: trop_2_1a.mp3 и trop_2_1а.mp3 (латинская/кириллическая а) нормализуются к 1a; при одновременном наличии — конфликт.
test('КАТ-03: нормализация 1a/1а и обнаружение конфликта дубликатов', () => {
  const latin = parseAudioFilename('trop_2_1a.mp3');
  const cyrillic = parseAudioFilename('trop_2_1а.mp3');

  assert.equal(latin.ok, true);
  assert.equal(cyrillic.ok, true);
  if (latin.ok && cyrillic.ok) {
    assert.equal(latin.item.knee, '1a');
    assert.equal(cyrillic.item.knee, '1a');
    assert.equal(latin.item.id, cyrillic.item.id);
  }

  const build = buildCatalogFromFilenames(['trop_2_1a.mp3', 'trop_2_1а.mp3']);
  assert.equal(build.errors.length, 1);
  assert.equal(build.errors[0].type, 'conflict');
  assert.equal(build.errors[0].id, 'trop:2:1a');
});

// КАТ-04: stih_7_К.mp3, stih_7_к.mp3 и stih_7_k.mp3 нормализуются к К; дубли диагностируются.
test('КАТ-04: нормализация К/к/k к конечному колену К и диагностика конфликтов', () => {
  assert.equal(normalizeKnee('К'), 'К');
  assert.equal(normalizeKnee('к'), 'К');
  assert.equal(normalizeKnee('K'), 'К');
  assert.equal(normalizeKnee('k'), 'К');

  const build = buildCatalogFromFilenames([
    'stih_7_К.mp3',
    'stih_7_к.mp3',
    'stih_7_k.mp3',
  ]);
  assert.equal(build.catalog.items.length, 1);
  assert.equal(build.catalog.items[0].knee, 'К');
  assert.equal(build.errors.length, 2);
  assert.ok(build.errors.every((e) => e.type === 'conflict'));
});

// КАТ-05: Невалидные имена не попадают в каталог и дают понятные ошибки.
test('КАТ-05: отклонение некорректных имён файлов', () => {
  const invalidFiles = [
    'other_1_1.mp3',
    'trop_9_1.mp3',
    'stih_2_3a.mp3',
    'trop_1_.mp3',
    'trop_0_1.mp3',
    'trop_1_6.mp3',
    'trop_1_1_v2.mp3',
  ];
  const build = buildCatalogFromFilenames(invalidFiles);

  assert.equal(build.catalog.items.length, 0);
  assert.equal(build.errors.length, invalidFiles.length);
  assert.ok(build.errors.every((e) => e.type === 'invalid_name' && e.reason.length > 5));
});

// ВИК-01: При выборе категории trop и гласа 4 не выбираются stih и чужие гласы.
test('ВИК-01: строгая фильтрация выборки по категории и гласам', () => {
  const catalog = buildCatalogFromFilenames([
    'trop_1_1.mp3',
    'trop_4_1.mp3',
    'trop_4_2.mp3',
    'stih_4_1.mp3',
    'stih_6_2.mp3',
  ]).catalog;

  const pool = filterPoolByConfig(catalog.items, {
    category: 'trop',
    glases: [4],
    mode: 'finite',
  });
  assert.deepEqual(
    pool.map((i) => i.id),
    ['trop:4:1', 'trop:4:2']
  );
});

// ВИК-02: Для trop_1_1a.mp3 ответы 1/1a и 1/1а верны; 1/К неверен даже при единственном колене.
test('ВИК-02: нормализация ввода колена и запрет подмены на К', () => {
  const target = { glas: 1 as const, knee: '1a' as const };

  const okLatin = evaluateAnswer(target, 1, '1a');
  assert.equal(okLatin.ok, true);
  if (okLatin.ok) assert.equal(okLatin.attempt.isCorrect, true);

  const okCyr = evaluateAnswer(target, 1, '1а');
  assert.equal(okCyr.ok, true);
  if (okCyr.ok) assert.equal(okCyr.attempt.isCorrect, true);

  const wrongK = evaluateAnswer(target, 1, 'К');
  assert.equal(wrongK.ok, true);
  if (wrongK.ok) {
    assert.equal(wrongK.attempt.isCorrect, false);
    assert.equal(wrongK.attempt.glasCorrect, true);
    assert.equal(wrongK.attempt.kneeCorrect, false);
  }
});

// ВИК-03: Раздельная проверка гласа и колена для stih_6_2a.mp3.
test('ВИК-03: раздельная оценка гласа и колена', () => {
  const target = { glas: 6 as const, knee: '2a' as const };

  const bothOk = evaluateAnswer(target, 6, '2a');
  assert.equal(bothOk.ok && bothOk.attempt.verdict, 'both_correct');

  const kneeOnly = evaluateAnswer(target, 5, '2a');
  assert.equal(kneeOnly.ok && kneeOnly.attempt.verdict, 'knee_only');
  assert.equal(kneeOnly.ok && kneeOnly.attempt.glasCorrect, false);
  assert.equal(kneeOnly.ok && kneeOnly.attempt.kneeCorrect, true);

  const glasOnly = evaluateAnswer(target, 6, '2');
  assert.equal(glasOnly.ok && glasOnly.attempt.verdict, 'glas_only');
  assert.equal(glasOnly.ok && glasOnly.attempt.glasCorrect, true);
  assert.equal(glasOnly.ok && glasOnly.attempt.kneeCorrect, false);

  const bothWrong = evaluateAnswer(target, 3, '4');
  assert.equal(bothWrong.ok && bothWrong.attempt.verdict, 'both_wrong');

  // Пустой ввод не засчитывается как попытка
  const incomplete = evaluateAnswer(target, 6, '');
  assert.equal(incomplete.ok, false);
});

// ВИК-04, ВИК-05, ВИК-07: Конечный режим, пропуски, повторные попытки и статистика первой попытки.
test('ВИК-04/05/07: конечная викторина, пропуск != ошибка, учёт 1-й и 2-й попытки', () => {
  const catalog = buildCatalogFromFilenames(['trop_1_1.mp3', 'trop_4_2.mp3']).catalog;
  let session = createActiveQuizSession(
    { category: 'trop', glases: [1, 4], mode: 'finite' },
    catalog.items,
    () => 0,
    1000
  );
  assert.ok(session);
  assert.equal(session.currentTurn?.exerciseId, 'trop:1:1');

  // Пропуск не считается ошибкой и не удаляет упражнение из конечного набора
  const skipped = advanceSessionTurn(session, catalog.items, 'skip', () => 0, 2000);
  assert.equal(skipped.completed, false);
  session = skipped.session;
  assert.equal(session.solvedIds.length, 0);
  // Не должно повторять trop:1:1 сразу при наличии альтернативы trop:4:2
  assert.equal(session.currentTurn?.exerciseId, 'trop:4:2');

  // Ошибка по колену, затем верный ответ со второй попытки
  const firstWrong = submitAttemptOnSession(session, 4, '1', 3000);
  assert.equal(firstWrong.ok, true);
  if (firstWrong.ok) {
    assert.equal(firstWrong.attempt.isCorrect, false);
    session = firstWrong.session;
  }

  const secondRight = submitAttemptOnSession(session, 4, '2', 4000);
  assert.equal(secondRight.ok, true);
  if (secondRight.ok) {
    assert.equal(secondRight.attempt.isCorrect, true);
    session = secondRight.session;
  }
  assert.deepEqual(session.solvedIds, ['trop:4:2']);

  // Переход к последнему оставшемуся упражнению trop:1:1
  const nextStep = advanceSessionTurn(session, catalog.items, 'next', () => 0, 5000);
  assert.equal(nextStep.completed, false);
  session = nextStep.session;
  assert.equal(session.currentTurn?.exerciseId, 'trop:1:1');

  // Верный ответ с первой попытки
  const solvedFirst = submitAttemptOnSession(session, 1, '1', 6000);
  assert.equal(solvedFirst.ok, true);
  if (solvedFirst.ok) session = solvedFirst.session;

  // Все упражнения освоены — конечная викторина завершается
  const done = advanceSessionTurn(session, catalog.items, 'next', () => 0, 7000);
  assert.equal(done.completed, true);

  const record = finishActiveSession(done.session, 'completed', 7000);
  const summary = computeSessionSummary(record);

  assert.equal(summary.solvedUniqueCount, 2);
  assert.equal(summary.unsolvedUniqueCount, 0);
  assert.equal(summary.solvedFirstTryCount, 1);
  assert.equal(summary.solvedLaterTryCount, 1);
  assert.equal(summary.skipsCount, 1);
  assert.equal(summary.wrongCheckedAttempts, 1);
  // Первая попытка trop:4:2: глас верен (4==4), колено неверно (1!=2).
  // Первая попытка trop:1:1: глас верен (1==1), колено верно (1==1).
  assert.equal(summary.firstAttemptGlasAccuracy, 100);
  assert.equal(summary.firstAttemptKneeAccuracy, 50);
});

// ВИК-06: Бесконечный режим не завершается автоматически и позволяет повторно встречать решённые колена.
test('ВИК-06: бесконечный режим продолжает выдачу и не зацикливается при 1 упражнении', () => {
  const singleCatalog = buildCatalogFromFilenames(['trop_1_1.mp3']).catalog;
  const picked = pickNextExercise(
    singleCatalog.items,
    ['trop:1:1'],
    [],
    'trop:1:1',
    'infinite',
    () => 0
  );
  assert.equal(picked?.id, 'trop:1:1');
});

// ВИК-08 & Подсказка («Показать ответ»): полный постоянный список колен и сохранение упражнения в конечном наборе после подсказки.
test('ВИК-08 и правило подсказки: константный список из 8 колен и повтор после раскрытия ответа', () => {
  assert.deepEqual([...ALL_KNEES], ['1', '1a', '2', '2a', '3', '4', '5', 'К']);

  const catalog = buildCatalogFromFilenames(['trop_1_1.mp3']).catalog;
  let session = createActiveQuizSession(
    { category: 'trop', glases: [1], mode: 'finite' },
    catalog.items,
    () => 0,
    1000
  );
  assert.ok(session);
  session = revealAnswerOnSession(session, 2000);
  assert.equal(session.solvedIds.length, 0);

  // После подсказки в конечном режиме колено остаётся в наборе
  const next = advanceSessionTurn(session, catalog.items, 'next', () => 0, 3000);
  assert.equal(next.completed, false);
  assert.equal(next.session.currentTurn?.exerciseId, 'trop:1:1');
});

// АУД-01 & ХР-02: Ошибка аудио не считается ошибкой ученика; статистика не выдумывает проценты без данных.
test('АУД-01 и статистика без данных: ошибка воспроизведения не портит точность', () => {
  const catalog = buildCatalogFromFilenames(['trop_1_1.mp3', 'trop_1_2.mp3']).catalog;
  let session = createActiveQuizSession(
    { category: 'trop', glases: [1], mode: 'finite' },
    catalog.items,
    () => 0,
    1000
  );
  assert.ok(session);
  session = markCurrentAudioUnavailable(session, 'Файл не найден (404)', 1500);

  // Нельзя засчитать попытку при недоступном аудио
  const blocked = submitAttemptOnSession(session, 1, '1', 1600);
  assert.equal(blocked.ok, false);

  const next = advanceSessionTurn(session, catalog.items, 'next', () => 0, 2000);
  assert.equal(next.completed, false);
  assert.equal(next.session.currentTurn?.exerciseId, 'trop:1:2');

  const record = finishActiveSession(next.session, 'stopped', 2500);
  const summary = computeSessionSummary(record);
  assert.equal(summary.audioErrorsCount, 1);
  assert.equal(summary.wrongCheckedAttempts, 0);
  assert.equal(summary.firstAttemptGlasAccuracy, null);
  assert.equal(summary.firstAttemptKneeAccuracy, null);

  const hist = computeHistoricalBreakdowns([record]);
  assert.equal(hist.overallFirstTryAccuracy, null);
  assert.equal(hist.byCategory.stih.firstTryAccuracy, null);
});
