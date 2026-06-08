/**
 * GET /api/analyses
 *
 * Returns paginated analysis history scoped to the current guest session.
 * Query params: ?page=<number>&pageSize=<number>
 * Auth is optional — session is derived from x-guest-id header or client IP.
 *
 * Requirements: 5.4, 8.3, 8.5
 */

import { handleGetAnalyses } from '@/lib/api/analysesHandler';
import { formatErrorResponse } from '@/lib/api/errorHandler';
import type { NextRequest } from 'next/server';

function resolveGuestKey(request: Request): string {
  const guestId = request.headers.get('x-guest-id');
  if (guestId?.trim()) return `guest:${guestId.trim()}`;

  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0]?.trim() : 'unknown';
  return `ip:${ip ?? 'unknown'}`;
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const userId = resolveGuestKey(request);

    const searchParams = request.nextUrl.searchParams;
    const pageParam = searchParams.get('page');
    const pageSizeParam = searchParams.get('pageSize');

    const page = pageParam ? parseInt(pageParam, 10) : undefined;
    const pageSize = pageSizeParam ? parseInt(pageSizeParam, 10) : undefined;

    const result = await handleGetAnalyses(userId, page, pageSize);
    return Response.json(result, { status: 200 });
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return Response.json(body, { status });
  }
}
