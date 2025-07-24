import { z } from 'zod';

// Common validation schemas
export const userIdSchema = z.object({
  userId: z.string().regex(/^\d+$/, {
    message: 'معرف المستخدم يجب أن يكون رقم صحيح'
  }),
});

export const inviteIdSchema = z.object({
  inviteId: z.number().int().positive('معرف الدعوة يجب أن يكون رقم موجب'),
});

export const gameIdSchema = z.object({
  id: z.number().int().positive('معرف اللعبة يجب أن يكون رقم موجب'),
});

export const paginationSchema = z.object({
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().optional(),
});

// User state enum - يجب أن يتطابق مع نموذج User
export const userStateSchema = z.enum(['online', 'offline', 'in-game'], {
  message: 'حالة المستخدم غير صحيحة'
});

// Game status enum - يجب أن يتطابق مع نموذج Game
export const gameStatusSchema = z.enum(['waiting', 'in_progress', 'completed', 'abandoned'], {
  message: 'حالة اللعبة غير صحيحة'
});

// Invite status enum - يجب أن يتطابق مع نموذج Invite
export const inviteStatusSchema = z.enum(['pending', 'accepted', 'rejected', 'expired'], {
  message: 'حالة الدعوة غير صحيحة'
});

// Game type enum - يجب أن يتطابق مع نموذج Invite
export const gameTypeSchema = z.enum(['friendly', 'competitive'], {
  message: 'نوع اللعبة غير صحيح'
});

// Play method enum - يجب أن يتطابق مع نموذج Game و Invite
export const playMethodSchema = z.enum(['physical_board', 'phone'], {
  message: 'طريقة اللعب غير صحيحة'
});

// Game time enum - يجب أن يتطابق مع نموذج Game
export const gameTimeSchema = z.enum(['5', '10', '15'], {
  message: 'وقت اللعبة غير صحيح'
});

// Game mode enum - يجب أن يتطابق مع نموذج Game
export const gameModeSchema = z.enum(['friend', 'random', 'ai', 'challenge'], {
  message: 'نمط اللعبة غير صحيح'
});

export const emailSchema = z.object({
  email: z.string().email('البريد الإلكتروني غير صحيح'),
});

// Combined schemas
export const sendFriendRequestSchema = z.object({
  toUserId: z.string().regex(/^\d+$/, { message: 'معرف المستخدم يجب أن يكون رقم صحيح' }),
});

export const sendFriendRequestByEmailSchema = z.object({
  email: z.string().email('البريد الإلكتروني غير صحيح'),
});

export const createGameInviteSchema = z.object({
  to_user_id: z.string().regex(/^\d+$/, { message: 'معرف المستخدم يجب أن يكون رقم صحيح' }),
  game_type: z.enum(['friendly', 'competitive'], { message: 'نوع اللعبة يجب أن يكون ودية أو تنافسية' }),
  play_method: playMethodSchema,
});

export const respondToInviteSchema = z.object({
  inviteId: z.number().int().positive('معرف الدعوة يجب أن يكون رقم موجب'),
  response: z.enum(['accept', 'reject'], { message: 'الرد غير صحيح' }),
});

export const startGameSchema = z.object({
  id: z.number().int().positive('معرف الدعوة يجب أن يكون رقم موجب'),
  play_method: playMethodSchema,
});

export const listInvitesSchema = z.object({
  page: z.number().int().positive().optional(),
  limit: z.number().int().positive().optional(),
  status: inviteStatusSchema.optional(),
  from_user_id: z.number().int().positive().optional(),
  to_user_id: z.number().int().positive().optional(),
});

// Game creation schema
export const createGameSchema = z.object({
  whiteUserId: z.number().int().positive('معرف اللاعب الأبيض يجب أن يكون رقم موجب'),
  blackUserId: z.number().int().positive('معرف اللاعب الأسود يجب أن يكون رقم موجب'),
  whitePlayMethod: playMethodSchema,
  blackPlayMethod: playMethodSchema,
  gameTime: gameTimeSchema,
  mode: gameModeSchema,
  status: gameStatusSchema.optional().default('waiting'),
});

// Move schema
export const moveSchema = z.object({
  from: z.string().min(2, 'الحركة غير صحيحة'),
  to: z.string().min(2, 'الحركة غير صحيحة'),
  promotion: z.string().optional(),
});

// Draw schema
export const drawSchema = z.object({
  action: z.enum(['offer', 'accept', 'reject'], { message: 'الإجراء غير صحيح' }),
});

// Socket validation schemas
export const socketGameInviteSchema = z.object({
  toUserId: z.string().regex(/^\d+$/, { message: 'معرف المستخدم يجب أن يكون رقم صحيح' }),
  gameType: z.enum(['friendly', 'competitive'], { message: 'نوع اللعبة يجب أن يكون ودية أو تنافسية' }),
  playMethod: playMethodSchema,
});

export const socketInviteResponseSchema = z.object({
  inviteId: z.string().regex(/^\d+$/, { message: 'معرف الدعوة يجب أن يكون رقم صحيح' }),
  response: z.enum(['accept', 'reject'], { message: 'الرد غير صحيح' }),
});

export const socketStartGameSchema = z.object({
  inviteId: z.number().int().positive('معرف الدعوة يجب أن يكون رقم موجب'),
  method: playMethodSchema,
});

export const socketMoveSchema = z.object({
  gameId: z.number().int().positive('معرف اللعبة يجب أن يكون رقم موجب'),
  from: z.string().min(2, 'الحركة غير صحيحة'),
  to: z.string().min(2, 'الحركة غير صحيحة'),
  promotion: z.string().optional(),
});

export const socketGameActionSchema = z.object({
  gameId: z.number().int().positive('معرف اللعبة يجب أن يكون رقم موجب'),
});

export const socketDrawOfferSchema = z.object({
  gameId: z.number().int().positive('معرف اللعبة يجب أن يكون رقم موجب'),
  action: z.enum(['offer', 'accept', 'reject'], { message: 'الإجراء غير صحيح' }),
});

// Helper function to validate socket data
export function validateSocketData(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new Error(`Validation error: ${result.error.errors.map(e => e.message).join(', ')}`);
  }
  return result.data;
} 