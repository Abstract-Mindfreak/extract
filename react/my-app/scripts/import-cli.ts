#!/usr/bin/env node
/**
 * CLI-утилита для импорта архива producer-ai-archiver
 * 
 * Использование:
 *   npx ts-node scripts/import-cli.ts --input "./producer-ai-archiver" --accounts "1,2,3,4"
 * 
 * Флаги:
 *   --input, -i      Путь к архиву (обязательный)
 *   --accounts, -a   ID аккаунтов через запятую (default: "1,2,3,4")
 *   --output, -o     Путь для копирования файлов (default: "./public/local-data")
 *   --dry-run        Только показать что будет импортировано
 *   --verbose, -v    Подробный вывод
 *   --help, -h       Показать справку
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';

// Types
interface CLIOptions {
  input: string;
  accounts: string;
  output: string;
  dryRun: boolean;
  verbose: boolean;
}

interface ImportFile {
  sourcePath: string;
  targetPath: string;
  relativePath: string;
  type: 'meta' | 'audio' | 'image' | 'session';
  size: number;
}

interface ScanResult {
  files: ImportFile[];
  totalSize: number;
  trackCount: number;
  accountIds: string[];
  errors: string[];
}

interface ImportReport {
  timestamp: string;
  options: CLIOptions;
  result: ScanResult;
  duration: number;
  copiedFiles: number;
  skippedFiles: number;
  errorFiles: number;
}

interface CatalogAccount {
  accountId: string;
  trackCount: number;
  trackIds: string[];
}

interface ImportCatalog {
  generatedAt: string;
  source: string;
  accounts: CatalogAccount[];
}

// CLI Setup
const program = new Command();

program
  .name('import-archiver')
  .description('CLI для импорта архива Producer.ai')
  .version('1.0.0')
  .requiredOption('-i, --input <path>', 'Путь к директории producer-ai-archiver')
  .option('-a, --accounts <ids>', 'ID аккаунтов через запятую', '1,2,3,4')
  .option('-o, --output <path>', 'Путь для выходных файлов', './public/local-data')
  .option('--dry-run', 'Только показать что будет импортировано', false)
  .option('-v, --verbose', 'Подробный вывод', false)
  .parse();

const options = program.opts<CLIOptions>();

// Logger
const logger = {
  info: (msg: string) => console.log(chalk.blue('ℹ'), msg),
  success: (msg: string) => console.log(chalk.green('✓'), msg),
  warning: (msg: string) => console.log(chalk.yellow('⚠'), msg),
  error: (msg: string) => console.log(chalk.red('✗'), msg),
  verbose: (msg: string) => {
    if (options.verbose) console.log(chalk.gray('  →'), msg);
  },
  header: (msg: string) => console.log(chalk.bold.cyan('\n' + msg)),
  stat: (label: string, value: string | number) => {
    console.log(`  ${chalk.gray(label)}: ${chalk.white(value)}`);
  }
};

// File size formatter
function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Scan directory recursively for producer-ai-archiver structure
// Structure: producer_backup_N/XX/uuid_title/meta.json
async function scanDirectory(
  dirPath: string,
  accountIds: string[],
  outputPath: string
): Promise<ScanResult> {
  const result: ScanResult = {
    files: [],
    totalSize: 0,
    trackCount: 0,
    accountIds: [],
    errors: []
  };

  for (const accountId of accountIds) {
    // Real structure uses producer_backup_N instead of account_N
    const backupDir = path.join(dirPath, `producer_backup_${accountId}`);
    
    try {
      const stat = await fs.stat(backupDir);
      if (!stat.isDirectory()) {
        // Fallback to old structure account_N
        const oldAccountDir = path.join(dirPath, `account_${accountId}`);
        const oldStat = await fs.stat(oldAccountDir);
        if (!oldStat.isDirectory()) continue;
        
        result.accountIds.push(accountId);
        await scanAccountDir(oldAccountDir, accountId, outputPath, result, `account_${accountId}`);
        continue;
      }
      
      result.accountIds.push(accountId);
      logger.verbose(`Сканирование producer_backup_${accountId}...`);

      // Scan hex subdirectories (00, 01, 02, ...)
      const hexDirs = await fs.readdir(backupDir, { withFileTypes: true });
      
      for (const hexDir of hexDirs) {
        if (!hexDir.isDirectory()) continue;
        if (hexDir.name.endsWith('.json')) continue; // Skip json files at root

        const hexPath = path.join(backupDir, hexDir.name);
        
        // Scan track directories inside hex directory
        const trackDirs = await fs.readdir(hexPath, { withFileTypes: true });
        
        for (const trackDir of trackDirs) {
          if (!trackDir.isDirectory()) continue;

          const trackPath = path.join(hexPath, trackDir.name);
          // Extract UUID from track directory name (first 36 chars)
          const trackId = trackDir.name.slice(0, 36);
          const relativeBase = `account_${accountId}/${trackId}`;

          try {
            const trackFiles = await fs.readdir(trackPath);
            let hasMeta = false;

            for (const file of trackFiles) {
              const filePath = path.join(trackPath, file);
              const fileStat = await fs.stat(filePath);
              
              if (!fileStat.isFile()) continue;

              let type: ImportFile['type'] = 'session';
              if (file === 'meta.json') {
                type = 'meta';
                hasMeta = true;
              } else if (file.endsWith('.m4a') || file.endsWith('.mp3')) {
                type = 'audio';
              } else if (file.endsWith('.jpg') || file.endsWith('.png') || file.endsWith('.webp')) {
                type = 'image';
              } else {
                continue; // Skip other files
              }

              const importFile: ImportFile = {
                sourcePath: filePath,
                targetPath: path.join(outputPath, relativeBase, file),
                relativePath: `${relativeBase}/${file}`,
                type,
                size: fileStat.size
              };

              result.files.push(importFile);
              result.totalSize += fileStat.size;
            }

            if (hasMeta) {
              result.trackCount++;
            }
          } catch (err) {
            result.errors.push(`Ошибка чтения трека ${trackDir.name}: ${(err as Error).message}`);
          }
        }
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        result.errors.push(`Ошибка producer_backup_${accountId}: ${(err as Error).message}`);
      }
    }
  }

  return result;
}

// Scan old-style account directory (account_N/track_id/)
async function scanAccountDir(
  accountDir: string,
  accountId: string,
  outputPath: string,
  result: ScanResult,
  accountName: string
): Promise<void> {
  logger.verbose(`Сканирование ${accountName} (old structure)...`);

  const entries = await fs.readdir(accountDir, { withFileTypes: true });
  
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const trackId = entry.name;
    const trackDir = path.join(accountDir, trackId);
    const relativeBase = `${accountName}/${trackId}`;

    try {
      const trackFiles = await fs.readdir(trackDir);
      let hasMeta = false;

      for (const file of trackFiles) {
        const filePath = path.join(trackDir, file);
        const fileStat = await fs.stat(filePath);
        
        if (!fileStat.isFile()) continue;

        let type: ImportFile['type'] = 'session';
        if (file === 'meta.json') {
          type = 'meta';
          hasMeta = true;
        } else if (file.endsWith('.m4a') || file.endsWith('.mp3')) {
          type = 'audio';
        } else if (file.endsWith('.jpg') || file.endsWith('.png') || file.endsWith('.webp')) {
          type = 'image';
        } else {
          continue;
        }

        result.files.push({
          sourcePath: filePath,
          targetPath: path.join(outputPath, relativeBase, file),
          relativePath: `${relativeBase}/${file}`,
          type,
          size: fileStat.size
        });
        result.totalSize += fileStat.size;
      }

      if (hasMeta) {
        result.trackCount++;
      }
    } catch (err) {
      result.errors.push(`Ошибка чтения трека ${trackId}: ${(err as Error).message}`);
    }
  }
}

// Copy file with directory creation
async function copyFile(source: string, target: string): Promise<void> {
  const targetDir = path.dirname(target);
  await fs.mkdir(targetDir, { recursive: true });
  await fs.copyFile(source, target);
}

// Generate import report
async function generateReport(report: ImportReport): Promise<void> {
  const reportPath = path.join(options.output, 'import-report.json');
  
  try {
    await fs.mkdir(options.output, { recursive: true });
    await fs.writeFile(
      reportPath,
      JSON.stringify(report, null, 2),
      'utf-8'
    );
    logger.verbose(`Отчёт сохранён: ${reportPath}`);
  } catch (err) {
    logger.warning(`Не удалось сохранить отчёт: ${(err as Error).message}`);
  }
}

function buildCatalog(scanResult: ScanResult): ImportCatalog {
  const accountMap = new Map<string, Set<string>>();

  for (const file of scanResult.files) {
    if (file.type !== 'meta') continue;

    const match = file.relativePath.match(/^account_(\d+)\/([^/]+)\/meta\.json$/);
    if (!match) continue;

    const accountId = match[1];
    const trackId = match[2];

    if (!accountMap.has(accountId)) {
      accountMap.set(accountId, new Set());
    }

    accountMap.get(accountId)?.add(trackId);
  }

  const accounts = Array.from(accountMap.entries())
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([accountId, trackIds]) => {
      const sortedTrackIds = Array.from(trackIds).sort();

      return {
        accountId,
        trackCount: sortedTrackIds.length,
        trackIds: sortedTrackIds
      };
    });

  return {
    generatedAt: new Date().toISOString(),
    source: path.resolve(options.input),
    accounts
  };
}

async function generateCatalog(scanResult: ScanResult): Promise<void> {
  const catalogPath = path.join(options.output, 'catalog.json');
  const catalog = buildCatalog(scanResult);

  try {
    await fs.mkdir(options.output, { recursive: true });
    await fs.writeFile(
      catalogPath,
      JSON.stringify(catalog, null, 2),
      'utf-8'
    );
    logger.verbose(`Catalog saved: ${catalogPath}`);
  } catch (err) {
    logger.warning(`Could not save catalog: ${(err as Error).message}`);
  }
}

// Main import function
async function runImport(): Promise<void> {
  const startTime = Date.now();
  
  logger.header('Producer.ai Archive Importer');
  
  // Validate input path
  try {
    const inputStat = await fs.stat(options.input);
    if (!inputStat.isDirectory()) {
      logger.error(`Указанный путь не является директорией: ${options.input}`);
      process.exit(1);
    }
  } catch {
    logger.error(`Директория не найдена: ${options.input}`);
    process.exit(1);
  }

  // Parse account IDs
  const accountIds = options.accounts.split(',').map(id => id.trim());
  
  logger.info(`Входная директория: ${path.resolve(options.input)}`);
  logger.info(`Выходная директория: ${path.resolve(options.output)}`);
  logger.info(`Аккаунты: ${accountIds.join(', ')}`);
  
  if (options.dryRun) {
    logger.warning('Режим DRY RUN — файлы не будут скопированы');
  }

  // Scan
  logger.header('Сканирование архива...');
  const scanResult = await scanDirectory(options.input, accountIds, options.output);

  // Print scan results
  logger.stat('Найдено аккаунтов', scanResult.accountIds.length);
  logger.stat('Найдено треков', scanResult.trackCount);
  logger.stat('Всего файлов', scanResult.files.length);
  logger.stat('Общий размер', formatSize(scanResult.totalSize));

  if (scanResult.errors.length > 0) {
    logger.header('Ошибки сканирования:');
    scanResult.errors.forEach(err => logger.error(err));
  }

  if (scanResult.files.length === 0) {
    logger.error('Файлы для импорта не найдены');
    process.exit(1);
  }

  // Group by type
  const byType = {
    meta: scanResult.files.filter(f => f.type === 'meta'),
    audio: scanResult.files.filter(f => f.type === 'audio'),
    image: scanResult.files.filter(f => f.type === 'image')
  };

  logger.header('По типам файлов:');
  logger.stat('meta.json', `${byType.meta.length} (${formatSize(byType.meta.reduce((s, f) => s + f.size, 0))})`);
  logger.stat('Аудио', `${byType.audio.length} (${formatSize(byType.audio.reduce((s, f) => s + f.size, 0))})`);
  logger.stat('Изображения', `${byType.image.length} (${formatSize(byType.image.reduce((s, f) => s + f.size, 0))})`);

  if (options.dryRun) {
    logger.header('Dry Run — импорт не выполняется');
    
    // Show sample files
    logger.verbose('Примеры файлов для копирования:');
    scanResult.files.slice(0, 5).forEach(f => {
      logger.verbose(`${f.relativePath} → ${f.targetPath}`);
    });
    
    process.exit(0);
  }

  // Copy files
  logger.header('Копирование файлов...');
  
  let copied = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < scanResult.files.length; i++) {
    const file = scanResult.files[i];
    
    if (options.verbose) {
      process.stdout.write(`\r  ${i + 1}/${scanResult.files.length} ${file.relativePath}`);
    }

    try {
      // Check if target exists and compare size
      try {
        const targetStat = await fs.stat(file.targetPath);
        if (targetStat.size === file.size) {
          skipped++;
          continue; // File already exists with same size
        }
      } catch {
        // Target doesn't exist, proceed with copy
      }

      await copyFile(file.sourcePath, file.targetPath);
      copied++;
    } catch (err) {
      logger.error(`Ошибка копирования ${file.relativePath}: ${(err as Error).message}`);
      errors++;
    }
  }

  if (options.verbose) {
    process.stdout.write('\n');
  }

  const duration = Date.now() - startTime;

  // Summary
  logger.header('Результат:');
  logger.stat('Скопировано файлов', copied);
  logger.stat('Пропущено (уже есть)', skipped);
  logger.stat('Ошибок', errors);
  logger.stat('Время', `${(duration / 1000).toFixed(2)}s`);

  // Generate report
  const report: ImportReport = {
    timestamp: new Date().toISOString(),
    options,
    result: scanResult,
    duration,
    copiedFiles: copied,
    skippedFiles: skipped,
    errorFiles: errors
  };

  await generateReport(report);
  await generateCatalog(scanResult);

  if (errors === 0) {
    logger.success('Импорт завершен успешно!');
  } else {
    logger.warning('Импорт завершен с ошибками');
    process.exit(1);
  }
}

// Run
runImport().catch(err => {
  logger.error(`Критическая ошибка: ${err.message}`);
  process.exit(1);
});
