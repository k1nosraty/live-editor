export const dialog = $state<{
  title: string;
  label: string;
  value: string;
  resolve: ((value: string | null) => void) | null;
}>({ title: '', label: '', value: '', resolve: null });
export function prompt(title: string, label: string, value = ''): Promise<string | null> {
  return new Promise((resolve) => {
    dialog.title = title;
    dialog.label = label;
    dialog.value = value;
    dialog.resolve = resolve;
  });
}
export function finish(value: string | null) {
  const resolve = dialog.resolve;
  dialog.resolve = null;
  resolve?.(value);
}
