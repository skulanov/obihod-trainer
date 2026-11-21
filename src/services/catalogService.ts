import { validateCatalogJson } from '../domain/parser.ts';
import type { CatalogData } from '../domain/types.ts';
import { resolveStaticUrl } from './urlResolver.ts';

export type CatalogLoadResult =
  | { ok: true; data: CatalogData }
  | { ok: false; error: string };

export async function loadAudioCatalog(signal?: AbortSignal): Promise<CatalogLoadResult> {
  const url = resolveStaticUrl('data/catalog.json');
  try {
    const response = await fetch(url, {
      cache: 'no-cache',
      signal,
    });

    if (!response.ok) {
      return {
        ok: false,
        error: `Не удалось загрузить каталог аудиозаписей (HTTP ${response.status}). Проверьте подключение к сети или публикацию файла data/catalog.json.`,
      };
    }

    let rawJson: unknown;
    try {
      rawJson = await response.json();
    } catch {
      return {
        ok: false,
        error: 'Файл каталога повреждён: не удалось разобрать JSON.',
      };
    }

    const validated = validateCatalogJson(rawJson);
    if (!validated.ok) {
      return { ok: false, error: validated.error };
    }

    return { ok: true, data: validated.data };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      return { ok: false, error: 'Загрузка каталога была прервана.' };
    }
    return {
      ok: false,
      error:
        'Не удалось получить каталог аудиозаписей. Проверьте подключение к интернету и попробуйте снова.',
    };
  }
}
