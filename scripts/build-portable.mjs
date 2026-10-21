/**
 * Сборка переносимого пакета приложения.
 *
 * Папка portable/<платформа> содержит всё, что нужно для запуска на другом
 * компьютере: собранный код, production-зависимости, готовый модуль SQLite
 * под целевую платформу, скрипты запуска и остановки.
 *
 * Данные (база, бэкапы) лежат в portable/<платформа>/data РЯДОМ с кодом —
 * поэтому при обновлении папку app/ можно заменить целиком, а данные
 * останутся нетронутыми.
 *
 * Запуск:
 *   node scripts/build-portable.mjs                     # текущая платформа
 *   node scripts/build-portable.mjs --platform=win32-x64
 *   node scripts/build-portable.mjs --platform=win32-x64 --no-zip
 */

import { mkdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildPackages,
  copyCode,
  downloadSqliteBinaries,
  installDependencies,
  linkWorkspacePackages,
  writeEnv,
} from './portable/steps-code.mjs';
import { writeInstructionAndArchive, writeScripts } from './portable/steps-final.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(join(here, '..'));
const portableRoot = join(repoRoot, 'portable');

/** Платформа текущей машины в формате node-а: os-arch. */
function currentPlatform() {
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  return `${process.platform}-${arch}`;
}

/** Разбор аргументов: поддерживаем и --platform=xxx, и --platform xxx. */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = { platform: currentPlatform(), zip: true };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i] ?? '';
    if (arg === '--platform') {
      options.platform = args[++i] ?? options.platform;
    } else if (arg.startsWith('--platform=')) {
      options.platform = arg.slice('--platform='.length);
    } else if (arg === '--no-zip') {
      options.zip = false;
    }
  }
  return options;
}

const options = parseArgs();
const [osName, arch] = options.platform.split('-');

if (!['win32', 'darwin', 'linux'].includes(osName) || !['x64', 'arm64'].includes(arch)) {
  console.error(`Неподдерживаемая платформа: ${options.platform}`);
  console.error('Ожидается: win32-x64, darwin-x64, darwin-arm64, linux-x64');
  process.exit(1);
}

const targetDir = join(portableRoot, `${osName}-${arch}`);
const appDir = join(targetDir, 'app');
const isWindows = osName === 'win32';

console.log(`Сборка пакета для ${options.platform} → ${targetDir}`);

console.log('  Сборка пакетов…');
buildPackages(repoRoot);

rmSync(targetDir, { recursive: true, force: true });
mkdirSync(appDir, { recursive: true });
mkdirSync(join(targetDir, 'data'), { recursive: true });

console.log('  Копирование кода…');
copyCode(repoRoot, appDir);

console.log('  Установка production-зависимостей…');
installDependencies(targetDir, appDir);
// Наши пакеты — настоящими копиями, а не симлинками: на чужом компьютере
// симлинков не будет, и импорты не разрешатся.
linkWorkspacePackages(appDir);

console.log('  Загрузка модуля SQLite…');
downloadSqliteBinaries(options.platform, appDir);

console.log('  Настройки пакета…');
writeEnv(appDir);

console.log('  Скрипты запуска…');
writeScripts(targetDir, isWindows);

if (options.zip) {
  console.log('  Упаковка в архив…');
  const zipPath = writeInstructionAndArchive(
    targetDir,
    portableRoot,
    options.platform,
    isWindows,
  );
  console.log(`  Архив: ${zipPath}`);
} else {
  writeInstructionAndArchive(targetDir, portableRoot, options.platform, isWindows);
}

console.log(`\nГотово: ${targetDir}`);
