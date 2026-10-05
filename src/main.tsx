import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { VistaAnimaciones } from './ui/VistaAnimaciones'
import './styles.css'

// v6.22 · ?ver=<animación> abre solo la vista previa de las animaciones grandes
const ver = new URLSearchParams(location.search).get('ver')

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {ver ? <VistaAnimaciones ver={ver} /> : <App />}
  </React.StrictMode>
)
