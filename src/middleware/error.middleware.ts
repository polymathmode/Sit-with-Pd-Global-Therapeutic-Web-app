import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Global error handler — always the last middleware in server.ts
export const errorHandler = (
  err: AppError | Error,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  let statusCode = (err as AppError).statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Multer errors — return clearer messages
  if (err.name === 'MulterError') {
    statusCode = 400;
    const multerErr = err as { code?: string; field?: string };
    if (multerErr.code === 'LIMIT_UNEXPECTED_FILE') {
      message = `Unexpected file field "${multerErr.field}". For Create/Update Program use "thumbnail". For Add Lesson use "video" and/or "file".`;
    } else if (multerErr.code === 'LIMIT_FILE_SIZE') {
      message = 'File too large. Thumbnail: max 10MB. Video: max 500MB.';
    }
  }

  // Cloudinary format errors
  if ((err as { http_code?: number }).http_code === 400 && message.includes('format')) {
    statusCode = 400;
    message = 'Invalid file type. Thumbnail accepts JPG, PNG, WebP only. Use an image file or leave thumbnail empty.';
  }

  if (process.env.NODE_ENV === 'development') {
    console.error('❌ Error:', err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

// Catch async errors without try/catch in every controller
export const catchAsync = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
};
