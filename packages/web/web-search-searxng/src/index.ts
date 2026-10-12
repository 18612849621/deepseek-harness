/**
 * SearXNG-backed `WebSearchProvider` plugin. It contributes to the `ctx.web`
 * registry without owning the service.
 *
 * @module @deepseek-ai/dsh-web-search-searxng
 */

import type { Context } from '@deepseek-ai/cordis'
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-web'
import {
  SearxngSearchProvider,
  SEARXNG_DEFAULT_BASE_URL,
  SEARXNG_DEFAULT_LANGUAGE,
} from './provider.ts'

export {
  SEARXNG_DEFAULT_BASE_URL,
  SEARXNG_DEFAULT_LANGUAGE,
  SEARXNG_PROVIDER_ID,
  SearxngSearchProvider,
} from './provider.ts'
export type { SearxngSearchProviderOptions } from './provider.ts'

/** Cordis plugin name used by loader diagnostics. */
export const name = 'web-search-searxng'

/** The web seam this provider registers into. */
export const inject = ['web']

/** Plugin config (all optional — `apply` fills env-var and constant defaults). */
export interface Config {
  /** SearXNG endpoint base; `/search` is appended. Falls back to `$SEARXNG_BASE_URL`, then `http://127.0.0.1:8888`. */
  baseURL?: string
  /** SearXNG UI language. Defaults to `en`. */
  language?: string
  /** Default result count when a request carries no `maxResults`. Omitted = none. */
  numResults?: number
}

export const Config: z<Config> = z.object({
  baseURL: z.string(),
  language: z.string(),
  numResults: z.number().step(1).min(1),
})

/** Register the SearXNG search provider with `ctx.web`. */
export function apply(ctx: Context, config: Config): void {
  ctx.web.registerSearchProvider(new SearxngSearchProvider({
    baseURL: config.baseURL ?? launchEnvironmentOf(ctx).get('SEARXNG_BASE_URL')?.value ?? SEARXNG_DEFAULT_BASE_URL,
    language: config.language ?? SEARXNG_DEFAULT_LANGUAGE,
    ...config.numResults !== undefined ? { numResults: config.numResults } : {},
  }))
}
