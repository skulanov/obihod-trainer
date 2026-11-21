import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCatalogFromFilenames } from '../src/domain/parser.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const audioDir = path.join(projectRoot, 'public', 'audio');
const outputDir = path.join(projectRoot, 'public', 'data');
const outputFile = path.join(outputDir, 'catalog.json');

function main(): void {
  if (!fs.existsSync(audioDir)) {
    fs.mkdirSync(audioDir, { recursive: true });
  }

  const entries = fs.readdirSync(audioDir, { withFileTypes: true });
  const filenames: string[] = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      console.error(
        `[catalog] Ошибка: обнаружена вложенная папка «${entry.name}» в public/audio/. Поместите MP3-файлы непосредственно в public/audio/.`
      );
      process.exit(1);
    }
    filenames.push(entry.name);
  }

  const result = buildCatalogFromFilenames(filenames);

  if (result.errors.length > 0) {
    console.error(
      `\n[catalog] Обнаружены ошибки при проверке аудиотеки (${result.errors.length}):\n`
    );
    for (const err of result.errors) {
      if (err.type === 'conflict') {
        console.error(`  • КОНФЛИКТ [${err.id}]: ${err.reason}`);
      } else {
        console.error(`  • НЕВЕРНОЕ ИМЯ «${err.filename}»: ${err.reason}`);
      }
    }
    console.error('\nСборка каталога прервана. Исправьте имена файлов в public/audio/.\n');
    process.exit(1);
  }

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputFile, `${JSON.stringify(result.catalog, null, 2)}\n`, 'utf8');

  const tropCount = result.catalog.items.filter((i) => i.category === 'trop').length;
  const stihCount = result.catalog.items.filter((i) => i.category === 'stih').length;
  console.log(
    `[catalog] Успешно собран catalog.json: всего ${result.catalog.items.length} записей (тропари: ${tropCount}, стихиры: ${stihCount}).`
  );
}

main();
