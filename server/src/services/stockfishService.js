import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STOCKFISH_DIR = path.join(__dirname, '../../node_modules/stockfish/src');

const resolveEnginePath = () => {
  try {
    const candidates = fs
      .readdirSync(STOCKFISH_DIR)
      .filter((file) => file.endsWith('.js') && file.includes('single') && !file.includes('lite'))
      .sort((a, b) => a.localeCompare(b));

    if (candidates.length > 0) {
      return path.join(STOCKFISH_DIR, candidates[candidates.length - 1]);
    }
  } catch (_error) {
    // ignore and fallback
  }

  return path.join(STOCKFISH_DIR, 'stockfish-17.1-single-a496a04.js');
};

const ENGINE_PATH = resolveEnginePath();

const DIFFICULTY_CONFIG = {
  easy: { skillLevel: 2, depth: 5, moveTimeMs: 250, rating: 900, limitStrength: true },
  medium: { skillLevel: 10, depth: 10, moveTimeMs: 900, rating: 1500, limitStrength: true },
  hard: { skillLevel: 20, depth: 22, moveTimeMs: 3200, rating: 2300, limitStrength: false },
  impossible: { skillLevel: 20, depth: 64, moveTimeMs: 12000, rating: 3500, limitStrength: false },
};

const sanitizeFen = (fen) => {
  if (typeof fen !== 'string') return null;
  const trimmed = fen.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 120);
};

export const getStockfishBestMove = async ({ fen, difficulty = 'medium' }) => {
  const safeFen = sanitizeFen(fen);
  if (!safeFen) {
    throw new Error('Invalid FEN');
  }

  const config = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.medium;
  const timeoutMs = Math.max(config.moveTimeMs + 6000, 8000);

  return new Promise((resolve, reject) => {
    const proc = spawn(process.execPath, [ENGINE_PATH], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let settled = false;
    let ready = false;

    const cleanup = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      try {
        proc.stdin.write('quit\n');
      } catch (_error) {
        // ignore
      }
      proc.kill('SIGKILL');
      if (err) {
        reject(err);
      }
    };

    const timeout = setTimeout(() => {
      cleanup(new Error('Stockfish timeout'));
    }, timeoutMs);

    proc.stdout.setEncoding('utf8');
    proc.stderr.setEncoding('utf8');

    proc.stdout.on('data', (chunk) => {
      const lines = String(chunk || '')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      for (const line of lines) {
        if (line === 'uciok') {
          proc.stdin.write(`setoption name Skill Level value ${config.skillLevel}\n`);
          if (config.limitStrength) {
            proc.stdin.write('setoption name UCI_LimitStrength value true\n');
            proc.stdin.write(`setoption name UCI_Elo value ${Math.max(1320, Math.min(3190, config.rating))}\n`);
          } else {
            proc.stdin.write('setoption name UCI_LimitStrength value false\n');
          }
          proc.stdin.write('isready\n');
          continue;
        }

        if (line === 'readyok' && !ready) {
          ready = true;
          proc.stdin.write('ucinewgame\n');
          proc.stdin.write(`position fen ${safeFen}\n`);
          proc.stdin.write(`go depth ${config.depth} movetime ${config.moveTimeMs}\n`);
          continue;
        }

        if (line.startsWith('bestmove')) {
          const parts = line.split(/\s+/);
          const bestMove = parts[1] && parts[1] !== '(none)' ? parts[1] : null;
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            try {
              proc.stdin.write('quit\n');
            } catch (_error) {
              // ignore
            }
            proc.kill('SIGKILL');
            if (!bestMove) {
              reject(new Error('No best move returned'));
            } else {
              resolve(bestMove);
            }
          }
          return;
        }
      }
    });

    proc.stderr.on('data', (chunk) => {
      if (!settled && String(chunk || '').toLowerCase().includes('error')) {
        cleanup(new Error('Stockfish engine error'));
      }
    });

    proc.on('error', (err) => {
      cleanup(err);
    });

    proc.on('exit', (code) => {
      if (!settled) {
        cleanup(new Error(`Stockfish exited (${code})`));
      }
    });

    proc.stdin.write('uci\n');
  });
};
