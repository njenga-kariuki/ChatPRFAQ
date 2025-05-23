import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css' // Reverted to import index.css
// import './test.css' // Commented out test.css import

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
) 