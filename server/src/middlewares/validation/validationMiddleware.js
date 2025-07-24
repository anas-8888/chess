import { formatError } from '../../utils/helpers.js';

// Generic validation middleware
export const validate = (schema) => {
  return (req, res, next) => {
    try {
      const data = {
        ...req.params,
        ...req.query,
        ...req.body
      };
      
      const result = schema.safeParse(data);
      
      if (!result.success) {
        return res.status(400).json(
          formatError('Validation error', result.error.errors)
        );
      }
      
      next();
    } catch (error) {
      return res.status(400).json(
        formatError('Validation error', error.message)
      );
    }
  };
}; 