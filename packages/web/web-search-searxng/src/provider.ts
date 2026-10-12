/**
 * `SearxngSearchProvider`: a `WebSearchProvider` backed by a SearXNG instance's
 * JSON API (`GET {baseURL}/search?format=json`). It maps each result's `content`
 * to `snippet`, maps `publishedDate` to `publishedAt`, and drops entries with no
 * usable URL. SearXNG returns no generated answer, so `content` is omitted.
 *
 * @module @deepseek-ai/dsh-web-search-searxng/provider
 */

import { WebError } from '@deepseek-ai/dsh-web'
import type {
  WebSearchProvider,
  WebSearchRequest,
  WebSearchResult,
  WebSearchSource,
} from '@deepseek-ai/dsh-web'
import type { SearxngResult, SearxngSearchResponse } from './types.ts'

/** Stable id this provider registers under. */
export const SEARXNG_PROVIDER_ID = 'searxng'

/** Default SearXNG base URL; `/search` is the operation. */
export const SEARXNG_DEFAULT_BASE_URL = 'http://127.0.0.1:8888'

/** Default UI language for search requests. */
export const SEARXNG_DEFAULT_LANGUAGE = 'en'

/** Attribution header sent on every request. Bump with the package version. */
const USER_AGENT = 'deepseek-harness/0.0.1'

/** Resolved provider options (the plugin's `apply` supplies env-var and constant defaults). */
export interface SearxngSearchProviderOptions {
  /** Endpoint base; `/search` is appended. */
  baseURL: string
  /** SearXNG UI language (`language` query parameter). */
  language: string
  /** Default result count when a request carries no `maxResults`. */
  numResults?: number
}

/**
 * Map one SearXNG result to a normalized source, or `undefined` when it carries
 * no usable URL.
 *
 * @param result - one entry of SearXNG's `results[]`.
 * @returns the normalized source, or `undefined` when the entry has no URL.
 */
export function mapSearxngResult(result: SearxngResult): WebSearchSource | undefined {
  if (result.url.length === 0) return undefined
  const snippet = result.content?.trim()
  return {
    url: result.url,
    ...result.title != null && result.title.length > 0 ? { title: result.title } : {},
    ...snippet != null && snippet.length > 0 ? { snippet } : {},
    ...result.publishedDate != null && result.publishedDate.length > 0 ? { publishedAt: result.publishedDate } : {},
  }
}

/**
 * Map a SearXNG response envelope to a normalized search result.
 *
 * @param response - the parsed `/search?format=json` response body.
 * @returns the normalized result; URL-less entries are dropped
 *   ({@link mapSearxngResult}).
 */
export function mapSearxngResponse(response: SearxngSearchResponse): WebSearchResult {
  const sources = (response.results ?? [])
    .map(mapSearxngResult)
    .filter((source): source is WebSearchSource => source !== undefined)
  // SearXNG returns no generated answer, so `content` is omitted. The web service owns the
  // final `maxResults` truncation, so this provider reports `truncated: false`.
  return { sources, truncated: false }
}

/** The SearXNG-backed search provider; HTTP redirects fail as `WEB_PROVIDER_ERROR`. */
export class SearxngSearchProvider implements WebSearchProvider {
  readonly id = SEARXNG_PROVIDER_ID

  constructor(private readonly options: SearxngSearchProviderOptions) {}

  // Availability checks stay beside each provider's distinct config contract;
  // a shared base class would obscure which fields make this backend usable.
  /* jscpd:ignore-start */
  available(): boolean {
    return isValidBaseUrl(this.options.baseURL)
      && this.options.language.length > 0
      && (this.options.numResults === undefined || isPositiveInteger(this.options.numResults))
  }
  /* jscpd:ignore-end */

  async search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
    // A per-request bound wins over the configured default; either may be absent.
    const numResults = request.maxResults ?? this.options.numResults
    const url = new URL(`${this.options.baseURL.replace(/\/+$/u, '')}/search`)
    url.searchParams.set('q', request.query)
    url.searchParams.set('format', 'json')
    url.searchParams.set('language', this.options.language)
    if (numResults !== undefined) url.searchParams.set('limit', String(numResults))

    let response: Response
    try {
      response = await fetch(url, {
        method: 'GET',
        redirect: 'error',
        headers: {
          'accept': 'application/json',
          'user-agent': USER_AGENT,
        },
        ...signal !== undefined ? { signal } : {},
      })
    } catch (error: unknown) {
      if (isAbortError(error)) throw new WebError('SearXNG search aborted', 'WEB_ABORTED', { cause: error })
      throw new WebError(`SearXNG search request failed: ${String(error)}`, 'WEB_PROVIDER_ERROR', { cause: error })
    }

    if (!response.ok) {
      throw new WebError(`SearXNG API error (HTTP ${response.status})`, 'WEB_PROVIDER_ERROR')
    }

    try {
      const payload = await response.json() as SearxngSearchResponse
      return mapSearxngResponse(payload)
    } catch (error: unknown) {
      if (isAbortError(error)) throw new WebError('SearXNG search aborted', 'WEB_ABORTED', { cause: error })
      throw new WebError(`SearXNG returned an unprocessable response body: ${String(error)}`, 'WEB_PROVIDER_ERROR', { cause: error })
    }
  }
}

/* jscpd:ignore-start */
/** True when `baseURL` parses as an absolute URL (a cheap local config check). */
function isValidBaseUrl(baseURL: string): boolean {
  return URL.canParse(baseURL)
}

/** True for a request limit that can be sent to SearXNG (a positive whole number). */
function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0
}

/** True for a fetch/`AbortSignal` abort, surfaced as `WEB_ABORTED`. */
function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
/* jscpd:ignore-end */
