import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { initializeTheme } from './styles/theme'
import './styles/glass.css'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './hooks/useTheme'

initializeTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </StrictMode>,
)
