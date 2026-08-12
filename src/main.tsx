import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// U+20C3 (the new UAE dirham sign) has no OS font support yet — this ships a
// unicode-range web font covering exactly that one glyph.
import 'dirham/css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
