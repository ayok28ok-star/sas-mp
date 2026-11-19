import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

registerSW({
  immediate: true,
  onRegisteredSW() {
    window.__sasSwReady = true;
    window.dispatchEvent(new CustomEvent('sas:sw-ready'));
  },
  onRegisterError() {
    window.__sasSwError = true;
    window.dispatchEvent(new CustomEvent('sas:sw-error'));
  },
});

createRoot(document.getElementById('root')!).render(<App />);
