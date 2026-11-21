import {
  ALL_CATEGORIES,
  ALL_GLASES,
  ALL_KNEES,
  type CatalogData,
  type CatalogItem,
  type CategoryCode,
  type GlasNumber,
  type KneeCode,
} from './types.ts';

const KNEE_MAP: Record<string, KneeCode> = {
  '1': '1',
  '1a': '1a',
  '1а': '1a', // Cyrillic а -> canonical Latin 1a
  '2': '2',
  '2a': '2a',
  '2а': '2a', // Cyrillic а -> canonical Latin 2a
  '3': '3',
  '4': '4',
  '5': '5',
  'к': 'К',
  'К': 'К',
  'k': 'К',
  'K': 'К',
};

/**
 * Normalizes a knee string (file token or keyboard input) to a canonical KneeCode.
 * Returns null if the token is not one of the 8 valid canonical knees.
 */
export function normalizeKnee(raw: string): KneeCode | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const lowered = trimmed.toLowerCase();
  return KNEE_MAP[trimmed] ?? KNEE_MAP[lowered] ?? null;
}

export function normalizeCategory(raw: string): CategoryCode | null {
  const lowered = raw.trim().toLowerCase();
  if (lowered === 'trop' || lowered === 'stih') {
    return lowered;
  }
  return null;
}

export function normalizeGlas(raw: string): GlasNumber | null {
  const trimmed = raw.trim();
  if (!/^[1-8]$/.test(trimmed)) {
    return null;
  }
  return Number(trimmed) as GlasNumber;
}

export function makeExerciseId(category: CategoryCode, glas: GlasNumber, knee: KneeCode): string {
  return `${category}:${glas}:${knee}`;
}

export type ParseFilenameResult =
  | { ok: true; item: CatalogItem }
  | { ok: false; filename: string; reason: string };

/**
 * Strictly parses an audio filename matching `<category>_<glas>_<knee>.mp3`.
 * Case-insensitive for category and `.mp3` extension; normalizes `1a`/`1а`, `2a`/`2а`, `К`/`к`/`K`/`k`.
 */
export function parseAudioFilename(filename: string): ParseFilenameResult {
  const baseName = filename.trim();
  if (!baseName) {
    return { ok: false, filename, reason: 'Пустое имя файла.' };
  }

  if (!/\.mp3$/i.test(baseName)) {
    return {
      ok: false,
      filename,
      reason: 'Поддерживаются только файлы с расширением .mp3.',
    };
  }

  const stem = baseName.slice(0, -4);
  const parts = stem.split('_');

  if (parts.length !== 3) {
    return {
      ok: false,
      filename,
      reason:
        'Имя должно соответствовать строгому шаблону <category>_<glas>_<knee>.mp3 без лишних полей или суффиксов.',
    };
  }

  const [rawCategory, rawGlas, rawKnee] = parts;

  if (!rawCategory || !rawGlas || !rawKnee) {
    return {
      ok: false,
      filename,
      reason: 'Обнаружено пустое поле в шаблоне <category>_<glas>_<knee>.mp3.',
    };
  }

  const category = normalizeCategory(rawCategory);
  if (!category) {
    return {
      ok: false,
      filename,
      reason: `Неизвестная категория «${rawCategory}». Допустимы только trop или stih.`,
    };
  }

  const glas = normalizeGlas(rawGlas);
  if (!glas) {
    return {
      ok: false,
      filename,
      reason: `Некорректный номер гласа «${rawGlas}». Допустима одна цифра от 1 до 8.`,
    };
  }

  const knee = normalizeKnee(rawKnee);
  if (!knee) {
    return {
      ok: false,
      filename,
      reason: `Некорректное обозначение колена «${rawKnee}». Допустимы только: 1, 1a, 2, 2a, 3, 4, 5, К.`,
    };
  }

  const id = makeExerciseId(category, glas, knee);
  return {
    ok: true,
    item: {
      id,
      category,
      glas,
      knee,
      file: `audio/${baseName}`,
      originalFilename: baseName,
    },
  };
}

export interface CatalogBuildIssue {
  type: 'invalid_name' | 'conflict';
  filename: string;
  conflictingWith?: string;
  id?: string;
  reason: string;
}

export interface CatalogBuildResult {
  catalog: CatalogData;
  errors: CatalogBuildIssue[];
}

const CATEGORY_ORDER: Record<CategoryCode, number> = { trop: 0, stih: 1 };
const KNEE_ORDER: Record<KneeCode, number> = {
  '1': 0,
  '1a': 1,
  '2': 2,
  '2a': 3,
  '3': 4,
  '4': 5,
  '5': 6,
  'К': 7,
};

export function compareCatalogItems(a: CatalogItem, b: CatalogItem): number {
  const catDiff = CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category];
  if (catDiff !== 0) return catDiff;
  if (a.glas !== b.glas) return a.glas - b.glas;
  return KNEE_ORDER[a.knee] - KNEE_ORDER[b.knee];
}

/**
 * Builds a validated CatalogData from a list of filenames located in public/audio/.
 * Detects both invalid filenames and logical ID conflicts after normalization.
 */
export function buildCatalogFromFilenames(
  filenames: string[],
  generatedAt = new Date().toISOString()
): CatalogBuildResult {
  const errors: CatalogBuildIssue[] = [];
  const seenById = new Map<string, CatalogItem>();

  // Sort filenames deterministically before processing so conflict diagnostics are reproducible.
  const sortedNames = [...filenames].sort((a, b) => a.localeCompare(b, 'ru'));

  for (const filename of sortedNames) {
    // Ignore hidden dotfiles and markdown documentation inside audio directory.
    if (filename.startsWith('.') || /^readme\.md$/i.test(filename)) {
      continue;
    }

    const parsed = parseAudioFilename(filename);
    if (!parsed.ok) {
      errors.push({
        type: 'invalid_name',
        filename,
        reason: parsed.reason,
      });
      continue;
    }

    const existing = seenById.get(parsed.item.id);
    if (existing) {
      errors.push({
        type: 'conflict',
        filename,
        conflictingWith: existing.originalFilename ?? existing.file,
        id: parsed.item.id,
        reason: `Конфликт логического упражнения (${parsed.item.id}): файл «${filename}» дублирует «${existing.originalFilename ?? existing.file}» после нормализации.`,
      });
      continue;
    }

    seenById.set(parsed.item.id, parsed.item);
  }

  const items = Array.from(seenById.values()).sort(compareCatalogItems);

  return {
    catalog: {
      schemaVersion: 1,
      generatedAt,
      items,
    },
    errors,
  };
}

export type CatalogValidationResult =
  | { ok: true; data: CatalogData }
  | { ok: false; error: string };

/**
 * Runtime schema validation for loaded `public/data/catalog.json`.
 */
export function validateCatalogJson(raw: unknown): CatalogValidationResult {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Каталог имеет неверный формат JSON (ожидается объект).' };
  }

  const obj = raw as Record<string, unknown>;
  if (obj.schemaVersion !== 1) {
    return { ok: false, error: 'Неподдерживаемая версия схемы каталога.' };
  }

  if (!Array.isArray(obj.items)) {
    return { ok: false, error: 'В каталоге отсутствует массив записей items.' };
  }

  const seenIds = new Set<string>();
  const validatedItems: CatalogItem[] = [];

  for (let i = 0; i < obj.items.length; i++) {
    const entry = obj.items[i] as Record<string, unknown> | null;
    if (!entry || typeof entry !== 'object') {
      return { ok: false, error: `Запись каталога #${i + 1} повреждена.` };
    }

    const category = typeof entry.category === 'string' ? entry.category : '';
    const glas = typeof entry.glas === 'number' ? entry.glas : NaN;
    const knee = typeof entry.knee === 'string' ? entry.knee : '';
    const file = typeof entry.file === 'string' ? entry.file : '';
    const id = typeof entry.id === 'string' ? entry.id : '';

    if (!ALL_CATEGORIES.includes(category as CategoryCode)) {
      return { ok: false, error: `Недопустимая категория в записи #${i + 1}: «${category}».` };
    }

    if (!ALL_GLASES.includes(glas as GlasNumber)) {
      return { ok: false, error: `Недопустимый глас в записи #${i + 1}: «${glas}».` };
    }

    if (!ALL_KNEES.includes(knee as KneeCode)) {
      return { ok: false, error: `Недопустимое колено в записи #${i + 1}: «${knee}».` };
    }

    if (!file || file.startsWith('/') || /^https?:\/\//i.test(file)) {
      return {
        ok: false,
        error: `Некорректный относительный путь аудиофайла в записи #${i + 1}.`,
      };
    }

    const expectedId = makeExerciseId(
      category as CategoryCode,
      glas as GlasNumber,
      knee as KneeCode
    );
    if (id !== expectedId) {
      return {
        ok: false,
        error: `Несоответствие идентификатора в записи #${i + 1}: ожидалось ${expectedId}, получено ${id}.`,
      };
    }

    if (seenIds.has(id)) {
      return { ok: false, error: `Обнаружен дублирующийся идентификатор в каталоге: ${id}.` };
    }
    seenIds.add(id);

    validatedItems.push({
      id,
      category: category as CategoryCode,
      glas: glas as GlasNumber,
      knee: knee as KneeCode,
      file,
      originalFilename:
        typeof entry.originalFilename === 'string' ? entry.originalFilename : undefined,
    });
  }

  validatedItems.sort(compareCatalogItems);

  return {
    ok: true,
    data: {
      schemaVersion: 1,
      generatedAt: typeof obj.generatedAt === 'string' ? obj.generatedAt : '',
      items: validatedItems,
    },
  };
}

export function getAvailableGlasesForCategory(
  items: readonly CatalogItem[],
  category: CategoryCode
): GlasNumber[] {
  const glases = new Set<GlasNumber>();
  for (const item of items) {
    if (item.category === category) {
      glases.add(item.glas);
    }
  }
  return Array.from(glases).sort((a, b) => a - b);
}

export function getKneesForCategoryAndGlas(
  items: readonly CatalogItem[],
  category: CategoryCode,
  glas: GlasNumber
): CatalogItem[] {
  return items
    .filter((item) => item.category === category && item.glas === glas)
    .sort(compareCatalogItems);
}
