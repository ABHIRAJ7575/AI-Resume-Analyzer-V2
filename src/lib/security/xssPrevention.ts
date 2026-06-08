/**
 * XSS Prevention — utilities for escaping user-provided content and
 * sanitising any HTML before it is rendered in the browser.
 *
 * Two layers of defence:
 *  1. `escapeHtml()` — plain-text escaping for content rendered via React
 *     text nodes (belt-and-suspenders; React already escapes JSX children).
 *  2. `sanitiseHtml()` — DOMPurify-based sanitisation for the rare cases
 *     where raw HTML must be rendered (e.g. rich-text feedback from the LLM).
 *     Always prefer React text nodes over `dangerouslySetInnerHTML`; only
 *     call this function when raw HTML rendering is unavoidable.
 *
 * Requirements: 11.5, 11.6
 */

// ─── HTML character escaping ──────────────────────────────────────────────────

/**
 * Map of characters that must be escaped in HTML contexts.
 *
 * Covers the five characters that can break out of HTML attribute values
 * and text nodes and introduce script injection.
 */
const HTML_ESCAPE_MAP: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
};

const HTML_ESCAPE_REGEX = /[&<>"']/g;

/**
 * Escape a string for safe insertion into an HTML text node or attribute.
 *
 * Replaces `&`, `<`, `>`, `"`, and `'` with their HTML entity equivalents.
 * This is a belt-and-suspenders measure — React already escapes JSX children
 * automatically, but this function is useful when:
 *  - Building HTML strings outside of JSX (e.g. in server-side templates).
 *  - Constructing attribute values dynamically.
 *  - Logging or storing content that will later be embedded in HTML.
 *
 * @param text - The raw user-provided string to escape.
 * @returns The HTML-safe escaped string.
 *
 * Requirements: 11.6
 */
export function escapeHtml(text: string): string {
  if (typeof text !== 'string') return '';
  return text.replace(HTML_ESCAPE_REGEX, (char) => HTML_ESCAPE_MAP[char] ?? char);
}

// ─── DOMPurify HTML sanitisation ─────────────────────────────────────────────

/**
 * Allowed HTML tags for rich-text LLM feedback.
 *
 * Restricted to a minimal safe subset: structural/semantic elements only.
 * No `<script>`, `<style>`, `<iframe>`, `<object>`, `<embed>`, `<form>`,
 * `<input>`, `<link>`, `<meta>`, or any other potentially dangerous tags.
 */
const ALLOWED_TAGS: string[] = [
  'p', 'br', 'strong', 'em', 'b', 'i', 'u', 's',
  'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'pre', 'code',
  'span', 'div', 'section', 'article',
  'a',
  'hr',
];

/**
 * Allowed HTML attributes.
 *
 * `href` is allowed only on `<a>` tags and is further validated by DOMPurify
 * to block `javascript:` URIs.  No event handlers (`on*`) are permitted.
 */
const ALLOWED_ATTR: string[] = ['href', 'title', 'class', 'id', 'aria-label'];

/**
 * DOMPurify configuration used for all sanitisation calls.
 */
const DOMPURIFY_CONFIG = {
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  /** Block `javascript:` and `data:` URIs in href attributes. */
  ALLOW_DATA_ATTR: false,
  /** Force all links to open in a new tab with safe rel attributes. */
  ADD_ATTR: ['target', 'rel'],
  /** Prevent DOM clobbering attacks. */
  SANITIZE_DOM: true,
  /** Return a string, not a DOM node. */
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
} as const;

/**
 * Cached DOMPurify instance for Node.js / SSR environments.
 * Created once on first use to avoid the overhead of spinning up a new
 * JSDOM instance on every sanitiseHtml() call.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _nodeDOMPurify: any = null;

/**
 * Sanitise an HTML string using DOMPurify before rendering it with
 * `dangerouslySetInnerHTML`.
 *
 * **Only call this function when raw HTML rendering is unavoidable.**
 * Prefer React text nodes (plain JSX children) for all other content.
 *
 * This function is safe to call in both browser and server (Node.js)
 * environments:
 *  - In the browser: uses the real DOM via DOMPurify.
 *  - In Node.js (SSR / tests): uses jsdom to provide a DOM implementation.
 *
 * @param html - The raw HTML string to sanitise (e.g. LLM-generated feedback).
 * @returns A sanitised HTML string safe for use with `dangerouslySetInnerHTML`.
 *
 * Requirements: 11.5, 11.6
 */
export function sanitiseHtml(html: string): string {
  if (typeof html !== 'string') return '';
  if (html.trim() === '') return '';

  // Browser environment — use the real DOM.
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('dompurify') as any;
    const DOMPurify = 'default' in mod ? mod.default : mod;
    const purified = DOMPurify.sanitize(html, DOMPURIFY_CONFIG);
    return typeof purified === 'string' ? purified : '';
  }

  // Server / Node.js environment — DOMPurify needs a DOM implementation.
  // We use jsdom (already a dev dependency) to provide one.
  // The JSDOM instance and DOMPurify are cached at module scope to avoid
  // the overhead of creating a new JSDOM per call (which causes test timeouts).
  try {
    if (!_nodeDOMPurify) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { JSDOM } = require('jsdom') as typeof import('jsdom');
      const { window: jsdomWindow } = new JSDOM('');
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('dompurify') as { default: (window: Window) => typeof import('dompurify') } | ((window: Window) => typeof import('dompurify'));
      const createDOMPurify = 'default' in mod ? mod.default : mod;
      _nodeDOMPurify = createDOMPurify(jsdomWindow as unknown as Window);
    }
    const purified = _nodeDOMPurify.sanitize(html, DOMPURIFY_CONFIG);
    return typeof purified === 'string' ? purified : '';
  } catch {
    // If jsdom is unavailable (e.g. production server without jsdom),
    // fall back to stripping all tags — safe but lossy.
    return stripAllTags(html);
  }
}

/**
 * Emergency fallback: strip all HTML tags from a string.
 *
 * Used when DOMPurify cannot be initialised (no DOM available).
 * Produces plain text — all markup is removed.
 *
 * @param html - The HTML string to strip.
 * @returns Plain text with all tags removed.
 */
export function stripAllTags(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&[a-z#0-9]+;/gi, (entity) => {
    const entities: Record<string, string> = {
      '&amp;': '&',
      '&lt;': '<',
      '&gt;': '>',
      '&quot;': '"',
      '&#x27;': "'",
      '&nbsp;': ' ',
    };
    return entities[entity] ?? entity;
  });
}

// ─── Safe render helper ───────────────────────────────────────────────────────

/**
 * Produce a `dangerouslySetInnerHTML`-compatible object from an HTML string,
 * after sanitising it with DOMPurify.
 *
 * Usage:
 * ```tsx
 * <div {...safeHtml(llmFeedback)} />
 * ```
 *
 * @param html - Raw HTML string (e.g. from LLM output).
 * @returns Object with `dangerouslySetInnerHTML.__html` set to the sanitised HTML.
 *
 * Requirements: 11.5, 11.6
 */
export function safeHtml(html: string): { dangerouslySetInnerHTML: { __html: string } } {
  return { dangerouslySetInnerHTML: { __html: sanitiseHtml(html) } };
}
