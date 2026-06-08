/**
 * Supabase REST API client using native fetch (no @supabase/supabase-js).
 * Requirements: 5.1, 8.1
 */

import { DatabaseError } from '@/types/errors';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SupabaseClientConfig {
  url?: string;
  anonKey?: string;
}

export interface QueryResult<T> {
  data: T[] | null;
  error: Error | null;
}

// ─── QueryBuilder ─────────────────────────────────────────────────────────────

/**
 * Fluent query builder for a single Supabase REST API table endpoint.
 * Supports insert, select, eq filters, ordering, and range-based pagination.
 */
export class QueryBuilder<T = Record<string, unknown>> {
  private readonly baseUrl: string;
  private readonly headers: Record<string, string>;
  private readonly table: string;

  private _method: 'GET' | 'POST' = 'GET';
  private _body: object | null = null;
  private _columns: string = '*';
  private _filters: string[] = [];
  private _order: string | null = null;
  private _rangeFrom: number | null = null;
  private _rangeTo: number | null = null;

  constructor(baseUrl: string, headers: Record<string, string>, table: string) {
    this.baseUrl = baseUrl;
    this.headers = headers;
    this.table = table;
  }

  /**
   * Configure an INSERT operation.
   * Sets method to POST and stores the data as the request body.
   */
  insert(data: object): this {
    this._method = 'POST';
    this._body = data;
    return this;
  }

  /**
   * Configure a SELECT operation with optional column list.
   * Defaults to '*' (all columns).
   */
  select(columns = '*'): this {
    this._method = 'GET';
    this._columns = columns;
    return this;
  }

  /**
   * Add an equality filter: `?{column}=eq.{value}`.
   */
  eq(column: string, value: unknown): this {
    this._filters.push(`${column}=eq.${String(value)}`);
    return this;
  }

  /**
   * Add an ORDER BY clause.
   * Defaults to ascending order; pass `{ ascending: false }` for DESC.
   */
  order(column: string, opts?: { ascending?: boolean }): this {
    const direction = opts?.ascending === false ? 'desc' : 'asc';
    this._order = `${column}.${direction}`;
    return this;
  }

  /**
   * Add a Range header for pagination.
   * Supabase uses `Range: {from}-{to}` (0-indexed, inclusive).
   */
  range(from: number, to: number): this {
    this._rangeFrom = from;
    this._rangeTo = to;
    return this;
  }

  /**
   * Execute the built query against the Supabase REST API.
   * Returns `{ data, error }` — never throws.
   */
  async execute(): Promise<QueryResult<T>> {
    try {
      const url = this._buildUrl();
      const init = this._buildInit();
      const response = await fetch(url, init);

      if (!response.ok) {
        let message = `Supabase request failed with status ${response.status}`;
        try {
          const body = (await response.json()) as { message?: string };
          if (body.message) message = body.message;
        } catch {
          // ignore JSON parse errors
        }
        return { data: null, error: new Error(message) };
      }

      // 204 No Content (e.g. DELETE without Prefer: return=representation)
      if (response.status === 204) {
        return { data: [], error: null };
      }

      const data = (await response.json()) as T[];
      return { data: Array.isArray(data) ? data : [data], error: null };
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      return { data: null, error };
    }
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private _buildUrl(): string {
    const base = `${this.baseUrl}/rest/v1/${this.table}`;

    if (this._method === 'POST') {
      return base;
    }

    // Build query string for GET
    const params: string[] = [];

    if (this._columns !== '*') {
      params.push(`select=${encodeURIComponent(this._columns)}`);
    } else {
      params.push('select=*');
    }

    for (const filter of this._filters) {
      params.push(filter);
    }

    if (this._order) {
      params.push(`order=${this._order}`);
    }

    return params.length > 0 ? `${base}?${params.join('&')}` : base;
  }

  private _buildInit(): RequestInit {
    const headers: Record<string, string> = {
      ...this.headers,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    };

    if (this._rangeFrom !== null && this._rangeTo !== null) {
      headers['Range'] = `${this._rangeFrom}-${this._rangeTo}`;
      headers['Range-Unit'] = 'items';
      headers['Prefer'] = 'return=representation,count=exact';
    }

    const init: RequestInit = {
      method: this._method,
      headers,
    };

    if (this._method === 'POST' && this._body !== null) {
      init.body = JSON.stringify(this._body);
    }

    return init;
  }
}

// ─── SupabaseClient ───────────────────────────────────────────────────────────

/**
 * Minimal Supabase REST API client.
 *
 * Reads credentials from environment variables by default:
 *  - `NEXT_PUBLIC_SUPABASE_URL`
 *  - `SUPABASE_SERVICE_ROLE_KEY`
 *
 * Throws `DatabaseError` if either credential is missing.
 *
 * Requirements: 5.1, 8.1
 */
export class SupabaseClient {
  private readonly url: string;
  private readonly anonKey: string;
  private readonly authHeaders: Record<string, string>;

  constructor(config: SupabaseClientConfig = {}) {
    const url = config.url ?? process.env['NEXT_PUBLIC_SUPABASE_URL'];
    const anonKey =
      config.anonKey ?? process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

    if (!url) {
      throw new DatabaseError(
        'Supabase URL is required. Set NEXT_PUBLIC_SUPABASE_URL environment variable or pass url in config.',
      );
    }

    if (!anonKey) {
      throw new DatabaseError(
        'Supabase anon key is required. Set NEXT_PUBLIC_SUPABASE_ANON_KEY environment variable or pass anonKey in config.',
      );
    }

    this.url = url.replace(/\/$/, ''); // strip trailing slash
    this.anonKey = anonKey;
    this.authHeaders = {
      apikey: this.anonKey,
      Authorization: `Bearer ${this.anonKey}`,
    };
  }

  /**
   * Return a `QueryBuilder` targeting the given table.
   * Chain `.insert()`, `.select()`, `.eq()`, `.order()`, `.range()`,
   * then call `.execute()` to fire the request.
   */
  from<T = Record<string, unknown>>(table: string): QueryBuilder<T> {
    return new QueryBuilder<T>(this.url, this.authHeaders, table);
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a `SupabaseClient` singleton from environment variables.
 * Throws `DatabaseError` if credentials are missing.
 *
 * Requirements: 5.1, 8.1
 */
export function createSupabaseClient(config?: SupabaseClientConfig): SupabaseClient {
  return new SupabaseClient(config);
}
