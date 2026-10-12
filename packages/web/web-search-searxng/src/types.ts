/**
 * Wire types for the SearXNG search API (`GET {baseURL}/search?format=json`).
 * Types only — no runtime code. SearXNG returns a flat `results[]`; each entry
 * carries a URL, title, and `content` (the engine's snippet).
 *
 * @module @deepseek-ai/dsh-web-search-searxng/types
 */

/** One entry of SearXNG's flat `results[]`. */
export interface SearxngResult {
  url: string
  title?: string | null
  /** The engine's result snippet. */
  content?: string | null
  /** Publication date when the engine supplies one. */
  publishedDate?: string | null
}

/** SearXNG's search response envelope. */
export interface SearxngSearchResponse {
  results?: SearxngResult[]
}
