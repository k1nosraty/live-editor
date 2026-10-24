import type { Playground } from '../../shared/types';
export function escapeScript(text: string): string {
  return text.replace(/<\/script/gi, '<\\/script');
}
export function buildPlayground(
  pg: Pick<Playground, 'html' | 'css' | 'js'>,
  bridge: string,
): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob:; style-src 'unsafe-inline'; script-src 'unsafe-inline' 'unsafe-eval' blob:; font-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'"><script>${escapeScript(bridge)}</script><style id="renderift-css">${pg.css.replace(/<\/style/gi, '<\\/style')}</style></head><body>${pg.html}<script>${escapeScript(pg.js)}\n//# sourceURL=playground.js\n</script></body></html>`;
}
export class Scheduler {
  private timer: ReturnType<typeof setTimeout> | undefined;
  schedule(callback: () => void, delay: number) {
    this.cancel();
    this.timer = setTimeout(callback, delay);
  }
  cancel() {
    clearTimeout(this.timer);
  }
}
// This function is serialized into the sandbox. It must not reference app modules.
function boot(channel: string) {
  const send = (type: string, payload: unknown) =>
    parent.postMessage({ renderift: channel, type, payload }, '*');
  const serialize = (value: unknown): string => {
    try {
      return typeof value === 'string'
        ? value
        : (JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? String(v) : v)) ??
            String(value));
    } catch {
      return String(value);
    }
  };
  for (const level of ['log', 'info', 'warn', 'error'] as const) {
    const original = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      original(...args);
      send('console', {
        level,
        message: args.map(serialize).join(' ').slice(0, 16000),
      });
    };
  }
  window.addEventListener('error', (event) =>
    send('console', {
      level: 'error',
      message: event.message,
      source: event.filename,
      line: event.lineno,
      column: event.colno,
      stack: event.error?.stack,
    }),
  );
  window.addEventListener('unhandledrejection', (event) =>
    send('console', {
      level: 'error',
      message: serialize(event.reason),
      stack: event.reason?.stack,
    }),
  );
  let enabled = false;
  let selected: Element | null = null;
  let overlay: HTMLDivElement | null = null;
  function highlight(element: Element) {
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.dataset.renderiftOverlay = 'true';
      Object.assign(overlay.style, {
        position: 'fixed',
        pointerEvents: 'none',
        zIndex: '2147483647',
        border: '2px solid #30a77b',
        background: 'rgba(48,167,123,.10)',
      });
      document.documentElement.append(overlay);
    }
    const rect = element.getBoundingClientRect();
    Object.assign(overlay.style, {
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
  }
  const props = [
    'color',
    'background-color',
    'width',
    'height',
    'margin-top',
    'margin-right',
    'margin-bottom',
    'margin-left',
    'padding-top',
    'padding-right',
    'padding-bottom',
    'padding-left',
    'border-top-width',
    'border-right-width',
    'border-bottom-width',
    'border-left-width',
    'font-size',
    'border-radius',
    'border',
    'display',
    'gap',
    'align-items',
    'justify-content',
  ];
  function inspect(element: Element) {
    selected = element;
    highlight(element);
    const computed = getComputedStyle(element);
    const styles: Record<string, string> = {};
    for (const p of props) styles[p] = computed.getPropertyValue(p);
    const rules: {
      selector: string;
      css: string;
      sheet: string;
      index: number;
    }[] = [];
    const visit = (list: CSSRuleList, sheet: string) => {
      for (let i = 0; i < list.length; i++) {
        const rule = list[i];
        if (rule instanceof CSSStyleRule) {
          try {
            if (element.matches(rule.selectorText))
              rules.push({
                selector: rule.selectorText,
                css: rule.style.cssText,
                sheet,
                index: i,
              });
          } catch {
            /* Unsupported browser selectors are inspection-only. */
          }
        } else if ('cssRules' in rule) {
          if (rule instanceof CSSMediaRule && !matchMedia(rule.conditionText).matches) continue;
          visit((rule as CSSGroupingRule).cssRules, sheet);
        }
      }
    };
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        visit(sheet.cssRules, sheet.href ?? 'playground.css');
      } catch {
        /* Cross-origin styles are computed-only. */
      }
    }
    const rect = element.getBoundingClientRect();
    const selector = element.id
      ? `#${CSS.escape(element.id)}`
      : element.tagName.toLowerCase() +
        Array.from(element.classList)
          .map((c) => `.${CSS.escape(c)}`)
          .join('');
    send('selection', {
      tag: element.tagName.toLowerCase(),
      id: element.id,
      classes: element.className?.toString() ?? '',
      selector,
      width: rect.width,
      height: rect.height,
      styles,
      rules,
    });
  }
  document.addEventListener(
    'mouseover',
    (event) => {
      if (enabled && event.target instanceof Element) highlight(event.target);
    },
    true,
  );
  document.addEventListener(
    'click',
    (event) => {
      if (enabled && event.target instanceof Element) {
        event.preventDefault();
        event.stopImmediatePropagation();
        inspect(event.target);
      }
    },
    true,
  );
  window.addEventListener('message', (event) => {
    if (event.source !== parent || event.data?.renderift !== channel) return;
    const { type, payload } = event.data;
    if (type === 'inspector') {
      enabled = payload === true;
      if (!enabled) {
        overlay?.remove();
        overlay = null;
      }
    }
    if (type === 'css' && typeof payload === 'string') {
      const style = document.getElementById('renderift-css');
      if (style) style.textContent = payload;
      else send('reload-needed', null);
      if (selected) inspect(selected);
    }
    if (type === 'stylesheets' && Array.isArray(payload)) {
      const paths = payload.filter((d) => typeof d?.path === 'string').map((d) => d.path as string);
      const affected = (sheet: CSSStyleSheet): boolean => {
        if (sheet.href && paths.some((path) => new URL(sheet.href!).pathname.endsWith('/' + path)))
          return true;
        try {
          for (const rule of Array.from(sheet.cssRules))
            if (rule instanceof CSSImportRule && rule.styleSheet && affected(rule.styleSheet))
              return true;
        } catch {
          /* Cross-origin styles are inspection-only. */
        }
        return false;
      };
      for (const link of Array.from(
        document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
      )) {
        if (link.sheet && affected(link.sheet)) {
          const href = new URL(link.href);
          href.searchParams.set('__renderift', String(Date.now()));
          link.href = href.href;
        }
      }
    }
    if (type === 'scroll') scrollTo(0, Number(payload) || 0);
  });
  window.addEventListener(
    'scroll',
    () => {
      send('scroll', scrollY);
      if (selected && enabled) highlight(selected);
    },
    { passive: true },
  );
  window.addEventListener('DOMContentLoaded', () => {
    for (const link of Array.from(
      document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'),
    )) {
      // Opaque sandbox origins need a CORS stylesheet fetch for safe CSSOM inspection.
      if (!link.crossOrigin) {
        link.crossOrigin = 'anonymous';
        link.setAttribute('href', link.href);
      }
    }
    send('ready', null);
  });
}
export function bridgeScript(channel: string): string {
  return `(${boot.toString()})(${JSON.stringify(channel)})`;
}
