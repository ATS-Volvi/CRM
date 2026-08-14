import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import App from './App'
import './index.css'

/**
 * Performance-tuned QueryClient:
 * - Static master-data (users, stages, sources) cached 5 min before refetch
 * - gcTime keeps unused cache alive for 10 min (avoids re-fetch on back-nav)
 * - Window-focus refetch disabled globally — pages poll explicitly where needed
 * - Retry reduced from default 3 to 1 so transient failures surface faster
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,       // 5 min — data considered fresh
      gcTime: 10 * 60 * 1000,          // 10 min — keep in cache after unmount
      refetchOnWindowFocus: false,      // Don't refetch just because window regains focus
      refetchOnReconnect: true,         // Do refetch when internet reconnects
      retry: 1,                         // 1 retry on failure (not 3)
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
)
