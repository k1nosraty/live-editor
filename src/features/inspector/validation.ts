import type { Selection } from '../../shared/types';
export function selectionMessage(value: unknown): Selection | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const text = (x: unknown, max = 4000): x is string => typeof x === 'string' && x.length <= max;
  if (
    !text(v.tag, 100) ||
    !text(v.id) ||
    !text(v.classes) ||
    !text(v.selector) ||
    typeof v.width !== 'number' ||
    !Number.isFinite(v.width) ||
    typeof v.height !== 'number' ||
    !Number.isFinite(v.height) ||
    !v.styles ||
    typeof v.styles !== 'object' ||
    Array.isArray(v.styles) ||
    !Array.isArray(v.rules) ||
    v.rules.length > 256
  )
    return null;
  if (
    Object.entries(v.styles).length > 100 ||
    Object.entries(v.styles).some(([k, val]) => !text(k, 100) || !text(val))
  )
    return null;
  for (const rule of v.rules) {
    if (!rule || typeof rule !== 'object') return null;
    const r = rule as Record<string, unknown>;
    if (
      !text(r.selector) ||
      !text(r.css, 16000) ||
      !text(r.sheet) ||
      typeof r.index !== 'number' ||
      !Number.isInteger(r.index)
    )
      return null;
  }
  return v as unknown as Selection;
}
