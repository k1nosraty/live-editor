import { invoke, isTauri } from '@tauri-apps/api/core';
export const desktop = isTauri();
export async function native<T>(command: string, args: Record<string, unknown> = {}): Promise<T> {
  if (!desktop)
    throw new Error('This action requires the desktop application. Run npm run tauri dev.');
  const token = (window as Window & { __RENDERIFT_NATIVE_TOKEN__?: string })
    .__RENDERIFT_NATIVE_TOKEN__;
  if (!token)
    throw new Error('Native authentication was not initialized in the main application frame.');
  return invoke<T>('dispatch', { op: command, args, token });
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
  return desktop ? native<boolean>('confirm', { text }) : window.confirm(text);
}
export async function inform(text: string): Promise<void> {
  if (desktop) await native('inform', { text });
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
