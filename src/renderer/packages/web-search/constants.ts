export const WEB_SEARCH_PROVIDERS = (
  [
    { value: 'build-in', label: 'Chatbox AI' },
    { value: 'bing', label: 'Bing Search' },
    { value: 'tavily', label: 'Tavily' },
    { value: 'bocha', label: 'BoCha' },
    { value: 'querit', label: 'Querit' },
    { value: 'searxng', label: 'SearXNG' },
  ] as const
).filter((provider) => provider.value !== 'build-in')

export type WebSearchProviderValue = 'build-in' | (typeof WEB_SEARCH_PROVIDERS)[number]['value']
