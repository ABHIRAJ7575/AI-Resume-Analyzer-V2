// @vitest-environment jsdom
/**
 * Component tests for DropZone
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.6
 */

import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { DropZone } from '../DropZone';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePdfFile(name = 'resume.pdf', sizeBytes = 1024): File {
  const content = new Uint8Array(sizeBytes);
  // PDF magic bytes
  content[0] = 0x25; content[1] = 0x50; content[2] = 0x44; content[3] = 0x46;
  return new File([content], name, { type: 'application/pdf' });
}

function makeNonPdfFile(): File {
  return new File(['hello'], 'image.png', { type: 'image/png' });
}

function mockFetchSuccess(fileId = 'file-123', fileName = 'resume.pdf', size = 1024) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ fileId, fileName, size }),
  }));
}

function mockFetchError(status = 400, message = 'Invalid file format') {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => ({ error: message }),
  }));
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DropZone', () => {
  // ── Idle state ─────────────────────────────────────────────────────────────

  it('renders the drop zone with correct aria-label', () => {
    const { container } = render(<DropZone />);
    expect(
      container.querySelector('[aria-label="File upload area"]'),
    ).toBeInTheDocument();
  });

  it('renders the drop target button', () => {
    render(<DropZone />);
    expect(
      screen.getByRole('button', { name: /drop pdf here or click to browse/i }),
    ).toBeInTheDocument();
  });

  it('renders the "Drag & drop your resume" prompt in idle state', () => {
    render(<DropZone />);
    expect(screen.getByText(/drag & drop your resume/i)).toBeInTheDocument();
  });

  it('renders the "Browse files" button in idle state', () => {
    render(<DropZone />);
    expect(screen.getByText(/browse files/i)).toBeInTheDocument();
  });

  it('renders the hidden file input', () => {
    const { container } = render(<DropZone />);
    const input = container.querySelector('input[type="file"]');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('accept', '.pdf,application/pdf');
  });

  // ── Drag events ────────────────────────────────────────────────────────────

  it('shows dragging state when a file is dragged over', () => {
    render(<DropZone />);
    const dropTarget = screen.getByRole('button', { name: /drop pdf/i });
    fireEvent.dragOver(dropTarget);
    expect(screen.getByText(/drop your pdf here/i)).toBeInTheDocument();
  });

  it('returns to idle state when drag leaves', () => {
    render(<DropZone />);
    const dropTarget = screen.getByRole('button', { name: /drop pdf/i });
    fireEvent.dragOver(dropTarget);
    fireEvent.dragLeave(dropTarget);
    expect(screen.getByText(/drag & drop your resume/i)).toBeInTheDocument();
  });

  // ── File validation ────────────────────────────────────────────────────────

  it('shows an error when a non-PDF file is dropped', async () => {
    render(<DropZone />);
    const dropTarget = screen.getByRole('button', { name: /drop pdf/i });
    const file = makeNonPdfFile();
    fireEvent.drop(dropTarget, { dataTransfer: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByRole('alert').textContent).toMatch(/only pdf/i);
  });

  it('shows an error when file exceeds size limit', async () => {
    const maxSize = 100; // 100 bytes
    render(<DropZone maxSizeBytes={maxSize} />);
    const dropTarget = screen.getByRole('button', { name: /drop pdf/i });
    const bigFile = makePdfFile('big.pdf', 200);
    fireEvent.drop(dropTarget, { dataTransfer: { files: [bigFile] } });
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByRole('alert').textContent).toMatch(/size limit/i);
  });

  it('shows a "Try again" button in error state', async () => {
    render(<DropZone />);
    const dropTarget = screen.getByRole('button', { name: /drop pdf/i });
    fireEvent.drop(dropTarget, { dataTransfer: { files: [makeNonPdfFile()] } });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });
  });

  it('resets to idle when "Try again" is clicked', async () => {
    render(<DropZone />);
    const dropTarget = screen.getByRole('button', { name: /drop pdf/i });
    fireEvent.drop(dropTarget, { dataTransfer: { files: [makeNonPdfFile()] } });
    await waitFor(() => screen.getByRole('button', { name: /try again/i }));
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(screen.getByText(/drag & drop your resume/i)).toBeInTheDocument();
  });

  // ── Upload flow ────────────────────────────────────────────────────────────

  it('shows uploading state with progress bar after valid file drop', async () => {
    mockFetchSuccess();
    render(<DropZone />);
    const dropTarget = screen.getByRole('button', { name: /drop pdf/i });
    const file = makePdfFile();
    fireEvent.drop(dropTarget, { dataTransfer: { files: [file] } });
    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });
  });

  it('shows success state after successful upload', async () => {
    mockFetchSuccess('file-abc', 'resume.pdf', 2048);
    render(<DropZone />);
    const dropTarget = screen.getByRole('button', { name: /drop pdf/i });
    fireEvent.drop(dropTarget, { dataTransfer: { files: [makePdfFile()] } });
    await waitFor(() => {
      expect(screen.getByText(/upload complete/i)).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('calls onUploadSuccess with fileId and fileName on success', async () => {
    mockFetchSuccess('file-xyz', 'my-resume.pdf', 1024);
    const onSuccess = vi.fn();
    render(<DropZone onUploadSuccess={onSuccess} />);
    const dropTarget = screen.getByRole('button', { name: /drop pdf/i });
    fireEvent.drop(dropTarget, { dataTransfer: { files: [makePdfFile('my-resume.pdf')] } });
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledWith('file-xyz', 'my-resume.pdf');
    }, { timeout: 2000 });
  });

  it('shows error state when API returns an error', async () => {
    mockFetchError(422, 'PDF is corrupted');
    render(<DropZone />);
    const dropTarget = screen.getByRole('button', { name: /drop pdf/i });
    fireEvent.drop(dropTarget, { dataTransfer: { files: [makePdfFile()] } });
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    expect(screen.getByRole('alert').textContent).toContain('PDF is corrupted');
  });

  it('calls onError when validation fails', async () => {
    const onError = vi.fn();
    render(<DropZone onError={onError} />);
    const dropTarget = screen.getByRole('button', { name: /drop pdf/i });
    fireEvent.drop(dropTarget, { dataTransfer: { files: [makeNonPdfFile()] } });
    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(expect.stringMatching(/only pdf/i));
    });
  });

  // ── Success state ──────────────────────────────────────────────────────────

  it('shows "Upload a different file" button in success state', async () => {
    mockFetchSuccess();
    render(<DropZone />);
    const dropTarget = screen.getByRole('button', { name: /drop pdf/i });
    fireEvent.drop(dropTarget, { dataTransfer: { files: [makePdfFile()] } });
    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /upload a different file/i }),
      ).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('resets to idle when "Upload a different file" is clicked', async () => {
    mockFetchSuccess();
    render(<DropZone />);
    const dropTarget = screen.getByRole('button', { name: /drop pdf/i });
    fireEvent.drop(dropTarget, { dataTransfer: { files: [makePdfFile()] } });
    await waitFor(() =>
      screen.getByRole('button', { name: /upload a different file/i }),
      { timeout: 2000 },
    );
    fireEvent.click(screen.getByRole('button', { name: /upload a different file/i }));
    expect(screen.getByText(/drag & drop your resume/i)).toBeInTheDocument();
  });

  // ── className prop ─────────────────────────────────────────────────────────

  it('applies a custom className to the root element', () => {
    const { container } = render(<DropZone className="my-zone" />);
    expect(
      container.querySelector('[aria-label="File upload area"]'),
    ).toHaveClass('my-zone');
  });
});
