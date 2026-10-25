import { mount } from 'svelte';
import { desktop, native } from './services/native';
import './styles/app.css';
async function start() {
  if (desktop) {
    let valid = false;
    try {
      const raw = localStorage.getItem('renderift.session.v1');
      valid = !!raw && !!JSON.parse(raw);
    } catch {
      /* Restore the separate native recovery copy. */
    }
    if (!valid) {
      try {
        const recovery = await native<string | null>('recovery_load');
        if (recovery) {
          JSON.parse(recovery);
          localStorage.setItem('renderift.session.v1', recovery);
        }
      } catch (error) {
        console.error('Recovery could not be loaded', error);
      }
    }
  }
  const { default: App } = await import('./app/App.svelte');
  mount(App, { target: document.getElementById('app')! });
}
void start();
