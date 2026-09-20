import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Ensure web browser tab logo dynamically syncs with official company logo
if (typeof document !== 'undefined') {
  try {
    const existingIcon = document.querySelector("link[rel='icon'][type='image/png']") as HTMLLinkElement;
    if (existingIcon) {
      existingIcon.href = `/favicon-32x32.png?v=${Date.now()}`;
    }
  } catch {
    // Ignore in non-browser environments
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

