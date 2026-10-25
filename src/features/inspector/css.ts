import postcss from 'postcss';
export interface SourceRule {
  selector: string;
  file: string;
  line: number;
  start: number;
  end: number;
  declarations: { property: string; value: string }[];
}
export function sourceRules(text: string, file = 'index.css'): SourceRule[] {
  const rules: SourceRule[] = [];
  postcss.parse(text, { from: file }).walkRules((rule) => {
    rules.push({
      selector: rule.selector,
      file,
      line: rule.source?.start?.line ?? 1,
      start: rule.source?.start?.offset ?? 0,
      end: (rule.source?.end?.offset ?? 0) + 1,
      declarations: rule.nodes
        .filter((n) => n.type === 'decl')
        .map((n) => ({ property: n.prop, value: n.value })),
    });
  });
  return rules;
}
export function updateDeclaration(
  text: string,
  selector: string,
  property: string,
  value: string,
  occurrence = 0,
): string {
  if (!/^(--[\w-]+|[a-z][a-z-]*)$/.test(property)) throw new Error('Invalid CSS property');
  if (/[{};]/.test(value) || value.length > 500 || /!important/i.test(value))
    throw new Error('Enter one CSS value without braces, semicolons, or !important');
  const root = postcss.parse(text);
  const matches: import('postcss').Rule[] = [];
  root.walkRules((r) => {
    if (r.selector === selector) matches.push(r);
  });
  const rule = matches[occurrence];
  if (!rule) throw new Error('Exact source rule not found. Generated styles are inspect-only.');
  const declarations = rule.nodes.filter(
    (n): n is import('postcss').Declaration => n.type === 'decl' && n.prop === property,
  );
  if (declarations.length) declarations.at(-1)!.value = value;
  else rule.append({ prop: property, value });
  return root.toString();
}
