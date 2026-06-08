/**
 * Analysis history handler — retrieves paginated analysis history for a user.
 * Requirements: 5.4, 8.3, 8.5
 */

import type { ResumeAnalysis } from '@/types';
import { getAnalysisHistory } from '@/lib/db/analysisRepository';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnalysesResult {
  analyses: ResumeAnalysis[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── handleGetAnalyses ────────────────────────────────────────────────────────

/**
 * Retrieve paginated analysis history for a user.
 *
 * - Enforces userId ownership via the repository layer.
 * - Defaults: page=1, pageSize=10.
 *
 * Requirements: 5.4, 8.3, 8.5
 */
export async function handleGetAnalyses(
  userId: string,
  page?: number,
  pageSize?: number,
): Promise<AnalysesResult> {
  const options: { page?: number; pageSize?: number } = {};
  if (page !== undefined) options.page = page;
  if (pageSize !== undefined) options.pageSize = pageSize;
  return getAnalysisHistory(userId, options);
}
