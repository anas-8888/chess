import { z } from 'zod';

// Validation for friend request action
export const friendRequestActionSchema = z.object({
  action: z.enum(['accept', 'reject'], {
    errorMap: () => ({ message: 'Action must be either "accept" or "reject"' })
  })
});

// Validation for user ID parameter
export const userIdParamSchema = z.object({
  userId: z.string().regex(/^\d+$/, {
    message: 'User ID must be a valid number'
  })
});

// Validation for friend request
export const sendFriendRequestSchema = z.object({
  toUserId: z.string().regex(/^\d+$/, {
    message: 'User ID must be a valid number'
  })
});

// Validation for update friend request
export const updateFriendRequestSchema = z.object({
  userId: z.string().regex(/^\d+$/, {
    message: 'User ID must be a valid number'
  })
});

// Validation for delete friend
export const deleteFriendSchema = z.object({
  userId: z.string().regex(/^\d+$/, {
    message: 'User ID must be a valid number'
  }).optional() // جعلها اختيارية لأنها تأتي من URL
}); 