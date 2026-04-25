import { Request } from 'express';

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;

export type PaginationMeta = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export function buildMeta(total: number, page: number, limit: number): PaginationMeta {
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  return { total, page, limit, totalPages };
}

/**
 * Admin (and any always-paginated list): `page` (default 1), `limit` (default 20, max 100).
 */
export function parseAdminPagination(req: Request): { skip: number; page: number; limit: number } {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
  const limitRaw = parseInt(String(req.query.limit ?? String(DEFAULT_PAGE_SIZE)), 10);
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number.isNaN(limitRaw) ? DEFAULT_PAGE_SIZE : limitRaw)
  );
  const skip = (page - 1) * limit;
  return { skip, page, limit };
}

/**
 * Public lists where full result is returned unless `page` or `limit` is present.
 */
export function parseOptionalListPagination(
  req: Request
): { mode: 'all' } | { mode: 'page'; skip: number; page: number; limit: number } {
  const hasPage = req.query.page !== undefined && String(req.query.page).trim() !== '';
  const hasLimit = req.query.limit !== undefined && String(req.query.limit).trim() !== '';
  if (!hasPage && !hasLimit) {
    return { mode: 'all' };
  }
  const { skip, page, limit } = parseAdminPagination(req);
  return { mode: 'page', skip, page, limit };
}
