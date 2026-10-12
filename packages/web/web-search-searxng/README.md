---
description: "The SearXNG-backed search provider for ctx.web: how deployments mount a self-hosted meta-search backend with portable snippets."
kind: "package-reference"
---

# @deepseek-ai/dsh-web-search-searxng

English | [中文](README.zh.md)

## Summary

With `dsh-web-search-searxng`, the harness searches the web through a self-hosted [SearXNG](https://docs.searxng.org/) instance's JSON API. Choose it when a deployment runs its own SearXNG and wants engine-aggregated results (Google, Bing, DuckDuckGo, Brave, and others) with portable snippets, without a per-query API key. SearXNG returns no generated answer, so results carry no `content` — only citeable sources. The model-facing `web_search` tool lives in `dsh-tool-web`.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Mount the provider in a composition that already loads the web service; it registers as the `searxng` search provider, so `ctx.web.search()` resolves it automatically when it is the only usable search backend — or pin it with `searchProvider: searxng`.

### When to choose it

Choose this backend when a deployment runs a SearXNG instance with its JSON format enabled and wants engine-aggregated results without an upstream API key. The provider is unavailable — and every search call fails with a structured error — when the endpoint base does not parse or the language is empty.

### Minimal configuration

Load the web service and the provider; the endpoint base falls back to `$SEARXNG_BASE_URL` from the launch environment, then `http://127.0.0.1:8888`, and all other settings have safe defaults.

```yaml
- name: '@deepseek-ai/dsh-web'
- name: '@deepseek-ai/dsh-web-search-searxng'
  config:
    baseURL: http://127.0.0.1:8888
```

| Field | Default | Meaning |
|---|---|---|
| `baseURL` | `$SEARXNG_BASE_URL`, then `http://127.0.0.1:8888` | Endpoint base; `/search` is appended. An unparseable value makes the provider unavailable |
| `language` | `en` | SearXNG UI language sent as the `language` query parameter; must be non-empty |
| `numResults` | (unset) | Default result count when a request carries no `maxResults`; sent as `limit`; must be a positive integer |

The generated [configuration catalog](../../../docs/config-catalog.md#deepseek-aidsh-web-search-searxng) is the exhaustive source for every accepted field and its JSDoc.

### What a search returns

Each SearXNG result maps to a `WebSearchSource`: `url`, `title`, the engine's `content` as `snippet`, and `publishedDate` as `publishedAt`; a result with no URL is dropped. A request's `maxResults` wins over the configured `numResults` default and is sent to SearXNG as `limit` — the final bound is enforced by the service, which truncates and flags. SearXNG returns no generated answer, so the result carries no `content`.

### Failures and recovery

Provider failures — HTTP errors, network failures, unparseable or wrong-shape bodies — surface as `WebError` `WEB_PROVIDER_ERROR`; an aborted request surfaces as `WEB_ABORTED`. HTTP redirects are rejected before the `Location` target is contacted and surface as `WEB_PROVIDER_ERROR`. Callers route on the code; the model-facing `web_search` tool surfaces failures to the model under its own error wrapper.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

This section explains the design decisions behind the provider; the observable behavior is fully covered in [Use this package](#use-this-package).

### Design philosophy

The provider is a thin adapter over SearXNG's JSON API with two deliberate rules:

- **Portable snippets only.** A source gains a `snippet` only from the engine's own `content`; a result without one keeps its URL and title but no invented text.
- **No invented answers.** SearXNG returns no generated answer, so `content` is omitted rather than fabricating provider prose the model might trust.

### Source map

| File | Role |
|---|---|
| [`src/index.ts`](src/index.ts) | Plugin entry: config schema, environment fallback, provider registration |
| [`src/provider.ts`](src/provider.ts) | The `SearxngSearchProvider`: request dispatch, abort classification, result mapping |
| [`src/types.ts`](src/types.ts) | SearXNG wire types: `SearxngSearchResponse`, `SearxngResult` |

### Request and mapping flow

`search()` issues `GET {baseURL}/search` with `q`, `format=json`, `language`, and an optional `limit`, using `redirect: 'error'`, so a redirect fails the request without contacting the target. The parsed `results[]` are mapped one by one, URL-less entries dropped, and the service applies the final `maxResults` bound on the way back. An abort — a `DOMException` named `AbortError` — becomes `WEB_ABORTED`; anything else becomes `WEB_PROVIDER_ERROR`.

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

Read these pages when the package-level contract is not enough. They move from the shared vocabulary to the service, the model-facing tools, and the design rationale.

- [Web subsystem](../../../docs/subsystems/web.md) — the exhaustive search request/result vocabulary and error codes.
- [Web package map](../README.md) — the package family and each role.
- [dsh-web](../web/README.md) — the web service this provider registers into.
- [dsh-tool-web](../tool-web/README.md) — the model-facing `web_search` tool that renders this provider's sources.
- [Generated configuration catalog](../../../docs/config-catalog.md#deepseek-aidsh-web-search-searxng) — every accepted config field and its source declaration.
- [Web capability seam decision](../../../.agents/notes/implemented/architecture/2026-06-24-web-capability-seam.md) — why search and fetch share one provider-selection service.

-----

<a id="model-experience"></a>
## Model Experience

Indirectly, through `dsh-tool-web`, which retains this provider's `maxResults`-bounded URLs, titles, snippets, and publication dates or its exact `SearXNG search aborted`, `SearXNG search request failed: <error>`, and `SearXNG returned an unprocessable response body: <error>` failures under the consumer's error wrapper.

#### KV Cache effect

No direct invalidation; the named consumer owns any request-prefix changes.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

These limits define when the provider is a poor fit. They are current package constraints.

- **Requires a running SearXNG with the JSON format enabled** — the provider adds no engines of its own; result quality and coverage come entirely from the instance's configured engines.
- **Only `language`/`numResults` are exposed** — SearXNG's other controls (engine selection, categories, time range, safe search) wait on provider-neutral service fields ([seam Agent Note](../../../.agents/notes/implemented/architecture/2026-06-24-web-capability-seam.md)).
- **Abort classification is error-shape-based** — only a `DOMException` named `AbortError` maps to `WEB_ABORTED`; an abort carrying a custom reason (such as `dsh-timeout`'s `TimeoutReason`) surfaces as `WEB_PROVIDER_ERROR`.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

This Dev Note is working context for maintainers: open questions and undecided directions. It is explicitly non-authoritative — shipped behavior, limits, and rationale live in the sections above and the linked Agent Notes.

#### Future: wider SearXNG control surface

SearXNG's engine selection, categories, time range, and safe-search controls stay unexposed. Exposing them needs provider-neutral service fields first, so the family adds one coordinated control rather than a vendor-specific argument.

</details>
