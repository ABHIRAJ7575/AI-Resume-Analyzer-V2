/**
 * POST /api/analyze
 *
 * Accepts a JSON body: { fileId, resumeText, fileName? }
 * Auth is optional — unauthenticated requests are assigned a guest session key
 * derived from the client IP, enabling anonymous pipeline access.
 *
 * Requirements: 2.3, 3.3, 4.1, 5.1, 12.1
 */

import { handleAnalyze } from '@/lib/api/analyzeHandler';
import { formatErrorResponse } from '@/lib/api/errorHandler';
import { AuthenticationError } from '@/types/errors';

export const maxDuration = 60; // Set timeout boundary to 60 seconds

/**
 * Derive a stable guest session key from the request.
 * Prefers x-guest-id header (client-generated UUID persisted in localStorage),
 * then falls back to the forwarded IP address.
 */
function resolveGuestKey(request: Request): string {
  const guestId = request.headers.get('x-guest-id');
  if (guestId?.trim()) return `guest:${guestId.trim()}`;

  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0]?.trim() : 'unknown';
  return `ip:${ip ?? 'unknown'}`;
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json() as Record<string, unknown>;
    const fileId = typeof body['fileId'] === 'string' ? body['fileId'] : '';
    const resumeText = typeof body['resumeText'] === 'string' ? body['resumeText'] : '';
    const fileName = typeof body['fileName'] === 'string' ? body['fileName'] : 'resume.pdf';

    const userId = resolveGuestKey(request);

    let attempt = 1;
    while (true) {
      try {
        const analysis = await handleAnalyze({ fileId, resumeText, userId, fileName });
        return Response.json(analysis, { status: 200 });
      } catch (err) {
        if (err instanceof AuthenticationError) {
          return Response.json({ error: err.message }, { status: 401 });
        }
        const { status, body } = formatErrorResponse(err);
        
        // 2-pass retry loop for 503 Network Dropouts
        if (status === 503 && attempt === 1) {
          console.error("DEBUG API ERROR RETRYING:", err);
          attempt++;
          await new Promise(resolve => setTimeout(resolve, 500));
          continue;
        }
        
        console.error("DEBUG API ERROR FINAL:", err);
        return Response.json(body, { status });
      }
    }
  } catch (err) {
    const { status, body } = formatErrorResponse(err);
    return Response.json(body, { status });
  }
}
