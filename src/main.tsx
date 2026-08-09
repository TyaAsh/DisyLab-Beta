import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ReactFlowProvider } from '@xyflow/react'
import App from './App'
import { installProductionSourceShield } from './sourceShield'
import './styles.css'
import './theme-custom.css'

installProductionSourceShield()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ReactFlowProvider>
      <App />
    </ReactFlowProvider>
  </StrictMode>,
)
