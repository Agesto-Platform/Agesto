import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import '@fontsource-variable/geist'
import './index.css'
import App from './App.tsx'
import { queryClient } from './lib/queryClient'
import { enableMocking } from './mocks/enable'
import { AuthProvider } from './auth/AuthProvider'
import { ToastProvider } from './components/ui'

function render(): void {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <BrowserRouter>
            <AuthProvider>
              <App />
            </AuthProvider>
          </BrowserRouter>
        </ToastProvider>
      </QueryClientProvider>
    </StrictMode>,
  )
}

// O render nunca deve ficar refém do MSW: se o mock (dev-only) falhar ao subir
// — ex.: Service Worker indisponível no ambiente —, ainda assim renderizamos o
// app em vez de deixar a tela em branco.
enableMocking()
  .catch((err) => {
    console.error('[mocks] falha ao iniciar o MSW — seguindo sem mocks:', err)
  })
  .finally(render)
