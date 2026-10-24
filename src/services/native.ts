import { invoke, isTauri } from '@tauri-apps/api/core';
import { confirm, message } from '@tauri-apps/plugin-dialog';
export const desktop = isTauri();
export async function native<T>(command: string, args: Record<string, unknown> = {}): Promise<T> {
  if (!desktop)
    throw new Error('This action requires the desktop application. Run npm run tauri dev.');
  return invoke<T>('dispatch', { op: command, args });
}
export async function pickFile(): Promise<string | null> {
  return native<string | null>('select_file');
}
export async function pickFolder(): Promise<string | null> {
  return native<string | null>('select_folder');
}
export async function savePath(name: string): Promise<string | null> {
  return native<string | null>('select_save', { name });
}
export async function ask(text: string): Promise<boolean> {
  return desktop ? confirm(text, { title: 'Renderift', kind: 'warning' }) : window.confirm(text);
}
export async function inform(text: string): Promise<void> {
  if (desktop) await message(text, { title: 'Renderift' });
  else window.alert(text);
}
export function download(name: string, data: BlobPart, type = 'text/plain'): void {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
