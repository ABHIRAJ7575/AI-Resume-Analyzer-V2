'use client';

/**
 * DropZone — drag-and-drop PDF upload component with progress tracking,
 * validation feedback, and analysis trigger.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.6
 */

import { useCallback, useRef, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type UploadState =
  | { status: 'idle' }
  | { status: 'dragging' }
  | { status: 'uploading'; progress: number; fileName: string }
  | { status: 'success'; fileId: string; fileName: string; size: number }
  | { status: 'error'; message: string };

export interface DropZoneProps {
  /** Called when a valid PDF has been uploaded successfully. */
  onUploadSuccess?: (fileId: string, fileName: string, resumeText?: string) => void;
  /** Called when an error occurs. */
  onError?: (message: string) => void;
  /** Maximum file size in bytes. Default: 10 MB. */
  maxSizeBytes?: number;
  className?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_MAX_SIZE = 10 * 1024 * 1024; // 10 MB
const PDF_MIME = 'application/pdf';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function validateFile(file: File, maxSizeBytes: number): string | null {
  if (file.type !== PDF_MIME && !file.name.toLowerCase().endsWith('.pdf')) {
    return 'Only PDF files are supported. Please upload a .pdf file.';
  }
  if (file.size > maxSizeBytes) {
    return `File exceeds the ${formatBytes(maxSizeBytes)} size limit. Please upload a smaller file.`;
  }
  if (file.size === 0) {
    return 'The selected file is empty. Please upload a valid PDF.';
  }
  return null;
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ progress }: { progress: number }) {
  return (
    <div
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Upload progress"
      className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"
    >
      <div
        className="h-full rounded-full bg-brand-500 transition-all duration-300 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Drag-and-drop PDF upload zone.
 *
 * States:
 *  - idle:      default drop target
 *  - dragging:  file is being dragged over the zone
 *  - uploading: file is being sent to /api/upload (with progress)
 *  - success:   upload complete, shows file name + size
 *  - error:     validation or network error with message
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.6
 */
export function DropZone({
  onUploadSuccess,
  onError,
  maxSizeBytes = DEFAULT_MAX_SIZE,
  className = '',
}: DropZoneProps) {
  const [state, setState] = useState<UploadState>({ status: 'idle' });
  const inputRef = useRef<HTMLInputElement>(null);

  // ── Upload logic ────────────────────────────────────────────────────────────

  const uploadFile = useCallback(
    async (file: File) => {
      const validationError = validateFile(file, maxSizeBytes);
      if (validationError) {
        setState({ status: 'error', message: validationError });
        onError?.(validationError);
        return;
      }

      setState({ status: 'uploading', progress: 0, fileName: file.name });

      try {
        // Simulate progress increments while the fetch is in flight
        const progressInterval = setInterval(() => {
          setState((prev) => {
            if (prev.status !== 'uploading') return prev;
            const next = Math.min(prev.progress + 15, 85);
            return { ...prev, progress: next };
          });
        }, 150);

        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        clearInterval(progressInterval);

        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          const msg = body.error ?? `Upload failed (${res.status})`;
          setState({ status: 'error', message: msg });
          onError?.(msg);
          return;
        }

        const data = (await res.json()) as { fileId: string; fileName: string; size: number; resumeText: string };

        setState({ status: 'uploading', progress: 100, fileName: file.name });

        // Brief pause at 100% before transitioning to success
        await new Promise((r) => setTimeout(r, 300));

        setState({
          status: 'success',
          fileId: data.fileId,
          fileName: data.fileName,
          size: data.size,
        });

        onUploadSuccess?.(data.fileId, data.fileName, data.resumeText);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'An unexpected error occurred during upload.';
        setState({ status: 'error', message: msg });
        onError?.(msg);
      }
    },
    [maxSizeBytes, onUploadSuccess, onError],
  );

  // ── Event handlers ──────────────────────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setState((prev) => (prev.status === 'idle' ? { status: 'dragging' } : prev));
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setState((prev) => (prev.status === 'dragging' ? { status: 'idle' } : prev));
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) void uploadFile(file);
    },
    [uploadFile],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void uploadFile(file);
      // Reset input so the same file can be re-selected
      e.target.value = '';
    },
    [uploadFile],
  );

  const handleReset = useCallback(() => {
    setState({ status: 'idle' });
  }, []);

  // ── Render ──────────────────────────────────────────────────────────────────

  const isDragging = state.status === 'dragging';
  const isUploading = state.status === 'uploading';
  const isSuccess = state.status === 'success';
  const isError = state.status === 'error';

  return (
    <div
      aria-label="File upload area"
      className={`relative ${className}`}
    >
      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="sr-only"
        aria-label="Choose PDF file"
        onChange={handleFileChange}
        data-testid="file-input"
      />

      {/* Drop zone surface */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Drop PDF here or click to browse"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !isUploading && !isSuccess && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !isUploading && !isSuccess) {
            inputRef.current?.click();
          }
        }}
        className={[
          'flex min-h-[200px] w-full cursor-pointer flex-col items-center justify-center gap-4',
          'rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-200',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400',
          isDragging
            ? 'border-brand-400 bg-brand-600/10 scale-[1.01]'
            : isSuccess
              ? 'border-green-500/50 bg-green-500/5 cursor-default'
              : isError
                ? 'border-red-500/50 bg-red-500/5'
                : 'border-white/15 bg-surface-raised hover:border-brand-500/50 hover:bg-brand-600/5',
        ].join(' ')}
      >
        {/* ── Idle / Dragging state ─────────────────────────────────── */}
        {(state.status === 'idle' || state.status === 'dragging') && (
          <>
            <div
              aria-hidden="true"
              className={`flex h-14 w-14 items-center justify-center rounded-full transition-colors ${
                isDragging ? 'bg-brand-600/30' : 'bg-white/8'
              }`}
            >
              <svg
                className={`h-7 w-7 transition-colors ${isDragging ? 'text-brand-400' : 'text-slate-400'}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
                <polyline points="16 12 12 8 8 12" />
                <line x1="12" y1="8" x2="12" y2="20" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200">
                {isDragging ? 'Drop your PDF here' : 'Drag & drop your resume'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                PDF only · max {formatBytes(maxSizeBytes)}
              </p>
            </div>
            {!isDragging && (
              <span className="rounded-full border border-brand-600/40 bg-brand-600/15 px-4 py-1.5 text-xs font-medium text-brand-300">
                Browse files
              </span>
            )}
          </>
        )}

        {/* ── Uploading state ───────────────────────────────────────── */}
        {state.status === 'uploading' && (
          <div className="w-full max-w-xs space-y-3" aria-live="polite">
            <p className="text-sm font-medium text-slate-200">
              Uploading {state.fileName}…
            </p>
            <ProgressBar progress={state.progress} />
            <p className="text-xs text-slate-500">{state.progress}%</p>
          </div>
        )}

        {/* ── Success state ─────────────────────────────────────────── */}
        {state.status === 'success' && (
          <div className="space-y-2" aria-live="polite">
            <div
              aria-hidden="true"
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20"
            >
              <svg
                className="h-6 w-6 text-green-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <p className="text-sm font-medium text-green-400">Upload complete</p>
            <p className="text-xs text-slate-400">
              {state.fileName} · {formatBytes(state.size)}
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleReset();
              }}
              className="mt-1 text-xs text-slate-500 underline hover:text-slate-300"
              aria-label="Upload a different file"
            >
              Upload a different file
            </button>
          </div>
        )}

        {/* ── Error state ───────────────────────────────────────────── */}
        {state.status === 'error' && (
          <div className="space-y-2" aria-live="assertive">
            <div
              aria-hidden="true"
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20"
            >
              <svg
                className="h-6 w-6 text-red-400"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <p
              role="alert"
              className="text-sm font-medium text-red-400"
            >
              {state.message}
            </p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleReset();
              }}
              className="text-xs text-slate-500 underline hover:text-slate-300"
              aria-label="Try again"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
