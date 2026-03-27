import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientRoot = fs.realpathSync(path.resolve(__dirname, '..'));

const run = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: clientRoot,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

run(process.execPath, [path.join(clientRoot, 'scripts/clean-build-output.mjs')]);
run(process.execPath, [path.join(clientRoot, 'node_modules/vite/bin/vite.js'), 'build']);
run(process.execPath, [path.join(clientRoot, 'scripts/copy-build-to-server.mjs')]);
