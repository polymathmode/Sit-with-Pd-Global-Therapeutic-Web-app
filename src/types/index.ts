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

// Applicant details collected when a user applies for a camp.
// Stored as JSON on CampRegistration.applicantDetails so fields stay flexible.
export interface ApplicantDetails {
  fullName?: string;
  phone?: string;
  emergencyContact?: {
    name: string;
    phone: string;
    relationship?: string;
  };
  dietaryRestrictions?: string;
  medicalConditions?: string;
  accommodationPreference?: string;
  // For Couple / Family tiers — lists the other attendees covered by this registration.
  partyMembers?: Array<{
    fullName: string;
    age?: number;
    relationship?: string;
  }>;
  notes?: string;
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

// Flutterwave webhook event shape — sent to /api/payments/flutterwave-webhook.
// We rely on `data.tx_ref` (the reference we generated on init) plus the static
// `verif-hash` header for authenticity.
export interface FlutterwaveWebhookEvent {
  event: string; // typically 'charge.completed'
  data: {
    id: number;
    tx_ref: string;
    flw_ref?: string;
    amount: number;
    currency: string;
    status: 'successful' | 'failed' | 'pending' | string;
    customer: { email: string };
    meta: {
      userId: string;
      type: 'PROGRAM' | 'CAMP' | 'CONSULTATION';
      itemId: string;
    };
    [key: string]: unknown;
  };
}
