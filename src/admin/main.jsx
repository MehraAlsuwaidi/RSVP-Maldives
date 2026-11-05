import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/nunito-sans/500.css';
import '@fontsource/nunito-sans/600.css';
import '@fontsource/nunito-sans/700.css';
import './admin.css';
import AdminApp from './AdminApp.jsx';

createRoot(document.getElementById('admin-root')).render(
  <StrictMode>
    <AdminApp />
  </StrictMode>,
);
