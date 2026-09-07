import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { applyTheme, getTheme } from './lib/theme';
import './design/tokens.css';
import './design/base.css';
import './design/shell.css';
import './design/council.css';
import './design/document.css';
import './design/pages.css';

applyTheme(getTheme());

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
