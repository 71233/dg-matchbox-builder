import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BuilderShell } from '@/components/builder/builder-shell';
import './globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BuilderShell />
  </StrictMode>,
);
