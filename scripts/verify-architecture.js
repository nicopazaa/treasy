/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');

const ROOT = process.cwd();
const SRC_DIR = path.join(ROOT, 'src');

const ALLOWED_MATH_RANDOM = [path.join('src', 'shared', 'utils', 'id.ts')];
const ALLOWED_PROCESS_ENV = [path.join('src', 'shared', 'config', 'env.ts')];
const MAX_USE_APP_ACTIONS_LINES = 900;
const NO_LEGACY_BLOB_WRITE_PATTERN = /setItem\(\s*['"]treasy_app_state_v2['"]/;

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
      continue;
    }
    if (!/\.(ts|tsx|js|jsx)$/.test(entry.name)) continue;
    out.push(full);
  }
  return out;
}

function rel(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, '/');
}

function checkMathRandom(files) {
  const errors = [];
  for (const file of files) {
    const relative = rel(file);
    const content = fs.readFileSync(file, 'utf8');
    if (!content.includes('Math.random(')) continue;
    if (ALLOWED_MATH_RANDOM.includes(relative.replace(/\//g, path.sep))) continue;
    errors.push(`[math-random] ${relative} uses Math.random outside id utility`);
  }
  return errors;
}

function checkProcessEnv(files) {
  const errors = [];
  for (const file of files) {
    const relative = rel(file);
    const content = fs.readFileSync(file, 'utf8');
    if (!content.includes('process.env')) continue;
    if (ALLOWED_PROCESS_ENV.includes(relative.replace(/\//g, path.sep))) continue;
    errors.push(`[process-env] ${relative} uses process.env outside env adapter`);
  }
  return errors;
}

function checkDataImportsFromScreens(files) {
  const errors = [];
  for (const file of files) {
    const relative = rel(file);
    if (!relative.startsWith('src/screens/')) continue;
    const content = fs.readFileSync(file, 'utf8');
    const bad = content.match(/from\s+['"][^'"]*\/features\/[^'"]*\/data\/[^'"]*['"]/g);
    if (!bad) continue;
    errors.push(`[screen-data-import] ${relative} imports feature data-layer directly`);
  }
  return errors;
}

function checkActionSize() {
  const target = path.join(SRC_DIR, 'app', 'actions', 'useAppActions.ts');
  const relative = rel(target);
  const lines = fs.readFileSync(target, 'utf8').split('\n').length;
  if (lines > MAX_USE_APP_ACTIONS_LINES) {
    return [`[module-size] ${relative} has ${lines} lines (limit ${MAX_USE_APP_ACTIONS_LINES})`];
  }
  return [];
}

function checkNoLegacyBlobWrites(files) {
  const errors = [];
  for (const file of files) {
    const relative = rel(file);
    const content = fs.readFileSync(file, 'utf8');
    if (!NO_LEGACY_BLOB_WRITE_PATTERN.test(content)) continue;
    errors.push(`[legacy-blob-write] ${relative} writes treasy_app_state_v2 directly`);
  }
  return errors;
}

function checkSyncWiring() {
  const errors = [];

  const storagePath = path.join(SRC_DIR, 'features', 'workouts', 'data', 'storage.ts');
  const storageContent = fs.readFileSync(storagePath, 'utf8');
  if (!storageContent.includes('ENTITY_STORAGE_KEYS')) {
    errors.push('[sync-storage] storage.ts is missing entity-oriented storage keys');
  }

  const servicePath = path.join(SRC_DIR, 'domain', 'workouts', 'workoutService.ts');
  const serviceContent = fs.readFileSync(servicePath, 'utf8');
  if (!serviceContent.includes('queueAppSyncDelete') || !serviceContent.includes('markSyncDeleted')) {
    errors.push('[sync-delete-flow] workoutService.ts is missing tombstone delete wiring');
  }

  return errors;
}

function main() {
  const files = walk(SRC_DIR);
  const errors = [
    ...checkMathRandom(files),
    ...checkProcessEnv(files),
    ...checkDataImportsFromScreens(files),
    ...checkActionSize(),
    ...checkNoLegacyBlobWrites(files),
    ...checkSyncWiring(),
  ];

  if (errors.length > 0) {
    console.error('Architecture verification failed:');
    for (const err of errors) console.error(`- ${err}`);
    process.exit(1);
  }

  console.log('Architecture verification passed.');
}

main();
