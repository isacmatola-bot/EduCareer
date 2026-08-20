import { readdir } from 'node:fs/promises';

const migrationDirectory = new URL('../supabase/migrations/', import.meta.url);
const migrationPattern = /^(\d{14})_([a-z0-9_]+)\.sql$/;
const files = (await readdir(migrationDirectory))
  .filter((file) => file.endsWith('.sql'))
  .sort();

const invalid = files.filter((file) => !migrationPattern.test(file));
if (invalid.length > 0) {
  console.error(`Invalid migration filenames:\n${invalid.join('\n')}`);
  process.exit(1);
}

const versions = files.map((file) => file.match(migrationPattern)[1]);
const duplicates = versions.filter((version, index) => versions.indexOf(version) !== index);
if (duplicates.length > 0) {
  console.error(`Duplicate migration versions: ${[...new Set(duplicates)].join(', ')}`);
  process.exit(1);
}

console.log(`Validated ${files.length} ordered Supabase migrations.`);
