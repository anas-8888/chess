import { z } from 'zod';
import { GameMode, GameTime, GameStatus, PlayMethod } from '../../models/gameEnums.js';

export const createGameSchema = z.object({
  mode: z.enum(GameMode),
  opponentId: z.number().int().optional(),
  aiLevel: z.number().int().min(1).max(8).optional(),
  time: z.enum(GameTime),
  playMethod: z.enum(PlayMethod).optional(),
});

export const moveSchema = z.object({
  from: z.string().regex(/^[a-h][1-8]$/),
  to: z.string().regex(/^[a-h][1-8]$/),
  promotion: z.enum(['q', 'r', 'b', 'n']).optional(),
});

export const gameIdParamSchema = z.object({
  id: z.string().regex(/^\d+$/),
});

export const resignSchema = z.object({}); // No body needed

export const drawSchema = z.object({
  action: z.enum(['offer', 'accept', 'decline']),
});

export const timeUpdateSchema = z.object({
  whiteTime: z.number().int().min(0),
  blackTime: z.number().int().min(0),
  currentTurn: z.enum(['w', 'b']),
  timestamp: z.number().int(),
});

// For query params (pagination, filtering)
export const listGamesQuerySchema = z.object({
  status: z.enum(GameStatus).optional(),
  mode: z.enum(GameMode).optional(),
  page: z.string().regex(/^\d+$/).optional(),
  limit: z.string().regex(/^\d+$/).optional(),
});

export const playMethodSchema = z.object({
  playMethod: z.enum(PlayMethod),
});
