import { Request } from 'express';
import { Role } from '@prisma/client';

// Extends Express Request to include authenticated user
export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: Role;
  };
}

// Standard API response shape
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

// Paystack webhook event shape
export interface PaystackEvent {
  event: string;
  data: {
    reference: string;
    amount: number;
    status: string;
    metadata: {
      userId: string;
      type: 'PROGRAM' | 'CAMP' | 'CONSULTATION';
      itemId: string;
    };
    customer: {
      email: string;
    };
  };
}
