import { Request, Response, NextFunction } from 'express';
import { validationResult } from 'express-validator';

// Run after express-validator checks — returns 422 if any field fails
export const validate = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed.',
      errors: errors.array().map((e) => ({ field: e.type, message: e.msg })),
    });
  }
  next();
};
