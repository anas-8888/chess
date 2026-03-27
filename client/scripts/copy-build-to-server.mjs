import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const clientRoot = path.resolve(__dirname, '..');
const distDir = path.join(clientRoot, 'dist');
const serverPublicDir = path.resolve(clientRoot, '../server/public_html');

const copyDirectoryContents = async (sourceDir, targetDir) => {
  await fs.mkdir(targetDir, { recursive: true });
  const entries = await fs.readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await copyDirectoryContents(sourcePath, targetPath);
      continue;
    }

    await fs.copyFile(sourcePath, targetPath);
  }
};

try {
  await copyDirectoryContents(distDir, serverPublicDir);
  console.log('[copy-build] build output copied to server/public_html');
} catch (error) {
  console.error('[copy-build] failed:', error);
  process.exit(1);
}
