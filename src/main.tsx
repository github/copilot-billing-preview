import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './theme.css'
import App from './App.tsx'

if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then(async (registrations) => {
      await Promise.all(registrations.map((registration) => registration.unregister()))
    })
    .catch((error) => {
      console.error('Failed to unregister service workers:', error)
    })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
