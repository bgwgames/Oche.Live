import './styles.css';
import { S, render, setCelebrator, setRenderer, setToaster } from './app/state';
import { connectRuntime } from './app/runtime';
import { resume } from './app/session';
import { renderApp } from './ui/render';
import { celebrate, showToast } from './ui/fx';
import { installInput } from './ui/input';

setRenderer(renderApp);
setToaster(showToast);
setCelebrator(celebrate);
installInput();

async function boot(): Promise<void> {
  render();
  const { db, room, user } = await connectRuntime();
  S.db = db; S.room = room; S.user = user;
  if (user && db) {
    try { S.canWrite = await user.can('data.write'); } catch { S.canWrite = null; }
  }
  if (!db) S.canWrite = false;
  S.ready = true;
  resume();
  render();
}

void boot();
