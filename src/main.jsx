import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/500-italic.css';
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/cormorant-garamond/600-italic.css';
import '@fontsource/nunito-sans/500.css';
import '@fontsource/nunito-sans/600.css';
import '@fontsource/nunito-sans/700.css';
import './styles/invitation.css';
import App from './App.jsx';
import { isPreviewMode } from './services/rsvpService.js';

if (isPreviewMode) {
  console.info(
    '[RSVP] Preview mode: VITE_RSVP_ENDPOINT is not set, so RSVPs are not sent anywhere. ' +
      'Production builds (npm run build / npm run deploy) use /api/rsvp. See README → "Connecting RSVPs".',
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
