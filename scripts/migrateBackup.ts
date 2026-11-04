import { DADOS_FILE_NAME, findFileByName, downloadFileText, upsertJsonFile } from '../src/drive/api';
import { parseBackupJson } from '../src/lib/backup';

/**
 * Migration script that ensures every backup stored on Google Drive contains the
 * `ultimaModificacao` field. It reads the existing `MotoristaConta-dados.json`
 * file, adds the missing field (using `ultimaSincronizacao` or `exportedAt` as a
 * fallback), and writes the updated JSON back to Drive.
 *
 * Usage (after setting a valid access token):
 *   GOOGLE_DRIVE_TOKEN=<access_token> npm run migrate-backup
 */
async function main() {
  const token = process.env.GOOGLE_DRIVE_TOKEN;
  if (!token) {
    console.error('❌ ENV var GOOGLE_DRIVE_TOKEN is required.');
    process.exit(1);
  }

  // Locate the backup file on Drive
  const fileRef = await findFileByName(token, DADOS_FILE_NAME);
  if (!fileRef) {
    console.error(`❌ Backup file "${DADOS_FILE_NAME}" not found on Drive.`);
    process.exit(1);
  }

  // Download and parse the backup JSON
  const raw = await downloadFileText(token, fileRef.id);
  const backup = parseBackupJson(raw);

  // If the field already exists, nothing to do
  if (backup.ultimaModificacao) {
    console.log('✅ No migration needed – `ultimaModificacao` already present.');
    return;
  }

  const fallback = backup.ultimaSincronizacao ?? backup.exportedAt ?? new Date().toISOString();
  backup.ultimaModificacao = fallback;

  const updated = JSON.stringify(backup, null, 2);
  await upsertJsonFile(token, DADOS_FILE_NAME, updated, fileRef.id);
  console.log('✅ Migration completed – field `ultimaModificacao` added.');
}

main().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});

