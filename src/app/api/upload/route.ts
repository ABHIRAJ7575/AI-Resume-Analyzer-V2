/**
 * POST /api/upload — PDF file upload endpoint.
 * Requirements: 1.1, 1.4, 11.3, 9.6
 */

import { NextResponse } from 'next/server';
import { handleUpload } from '@/lib/api/uploadHandler';
import { formatErrorResponse } from '@/lib/api/errorHandler';

export async function POST(request: Request): Promise<Response> {
  try {
    const formData = await request.formData();
    // Pass the request so handleUpload can apply IP-based rate limiting
    // and the full security suite (magic bytes, size, malicious content scan).
    const result = await handleUpload(formData, request);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const { status, body } = formatErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
