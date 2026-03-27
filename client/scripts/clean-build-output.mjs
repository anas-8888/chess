import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputDir = path.resolve(__dirname, '../../server/public_html');
const assetsDir = path.join(outputDir, 'assets');

const removeIfExists = async (targetPath) => {
  try {
    await fs.rm(targetPath, { recursive: true, force: true });
    console.log(`[clean-build] removed: ${path.relative(outputDir, targetPath)}`);
  } catch (error) {
    console.error(`[clean-build] failed to remove ${targetPath}:`, error);
    process.exitCode = 1;
  }
};

await removeIfExists(assetsDir);
console.log('[clean-build] done. Preserved files include .htaccess and other public_html roots.');
