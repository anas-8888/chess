import { API_BASE_URL } from '@/config/urls';
import { authService } from './authService';

export type PuzzleLevel = 'easy' | 'medium' | 'hard';
export type PuzzleStatus = 'locked' | 'unlocked' | 'completed';

export interface PuzzleMoveInput {
  uci?: string;
  san?: string;
}

export interface PuzzleMoveLine {
  actor: 'player' | 'opponent';
  uci: string | null;
  san: string | null;
  raw: string;
}

export interface PuzzleItem {
  id: number;
  name: string;
  level: PuzzleLevel;
  levelLabel: string;
  objective: string;
  details: string;
  orderIndex: number;
  points: number;
  status: PuzzleStatus;
  attemptsCount: number;
  successCount: number;
  bestTimeSeconds: number | null;
  lastSolvedAt: string | null;
}

export interface PuzzleProgressOverview {
  stats: {
    totalPuzzles: number;
    completedPuzzles: number;
    unlockedPuzzles: number;
    totalAttempts: number;
    totalSuccesses: number;
    totalFails: number;
    totalPoints: number;
    successRate: number;
  };
  levels: Record<PuzzleLevel, PuzzleItem[]>;
  all: PuzzleItem[];
}

export interface PlayablePuzzle {
  id: number;
  name: string;
  level: PuzzleLevel;
  levelLabel: string;
  fen: string;
  details: string;
  objective: string;
  startsWith: 'white' | 'black';
  points: number;
  orderIndex: number;
  isActive: boolean;
  totalSteps: number;
  playerSteps: number;
  solution: PuzzleMoveLine[];
}

export interface CheckPuzzleMoveResponse {
  isCorrect: boolean;
  completed: boolean;
  nextIndex?: number;
  incorrectAt?: number | null;
  message?: string;
  autoMoves?: Array<{
    index: number;
    actor: 'player' | 'opponent';
    uci: string | null;
    san: string | null;
    raw: string;
  }>;
}

export interface FinishPuzzleAttemptPayload {
  status: 'solved' | 'failed' | 'abandoned';
  moves: PuzzleMoveInput[];
  mistakesCount?: number;
  hintsUsed?: number;
  usedSolution?: boolean;
  elapsedSeconds?: number;
}

class PuzzleService {
  private getAuthHeaders() {
    return authService.getAuthHeaders();
  }

  async getProgressOverview(): Promise<PuzzleProgressOverview> {
    const response = await fetch(`${API_BASE_URL}/api/puzzles/progress/overview`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'فشل في تحميل تقدم الألغاز');
    }

    return response.json();
  }

  async getPlayablePuzzle(id: number): Promise<PlayablePuzzle> {
    const response = await fetch(`${API_BASE_URL}/api/puzzles/${id}/play`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'فشل في تحميل اللغز');
    }

    return response.json();
  }

  async checkMove(id: number, moves: PuzzleMoveInput[]): Promise<CheckPuzzleMoveResponse> {
    const response = await fetch(`${API_BASE_URL}/api/puzzles/${id}/check-move`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ moves }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'فشل التحقق من النقلة');
    }

    return response.json();
  }

  async finishAttempt(id: number, payload: FinishPuzzleAttemptPayload): Promise<{
    status: string;
    pointsAwarded: number;
    firstSolve: boolean;
    progress: PuzzleProgressOverview;
  }> {
    const response = await fetch(`${API_BASE_URL}/api/puzzles/${id}/finish`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'فشل إنهاء المحاولة');
    }

    return response.json();
  }

  async listPuzzlesForAdmin(): Promise<PlayablePuzzle[]> {
    const response = await fetch(`${API_BASE_URL}/api/puzzles?limit=500&includeInactive=1`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'فشل في تحميل قائمة الألغاز');
    }

    const data = await response.json();
    return data?.puzzles || [];
  }
}

export const puzzleService = new PuzzleService();

