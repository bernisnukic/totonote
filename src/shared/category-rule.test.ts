import { describe, it, expect } from 'vitest';
import {
  parseRuleTemplate,
  countRuleNodes,
  isRuleTemplateEmpty,
  MAX_RULE_DEPTH,
  MAX_RULE_NODES,
} from './category-rule';

/** Compact tree rendering, so expectations stay readable. */
function shape(nodes: ReturnType<typeof parseRuleTemplate>, depth = 0): string[] {
  return nodes.flatMap(n => ['  '.repeat(depth) + n.name, ...shape(n.children, depth + 1)]);
}

describe('parseRuleTemplate', () => {
  it('parses a flat list', () => {
    const tree = parseRuleTemplate('HISTORY\nABILITIES\nCOLOUR PALETTE');
    expect(tree.map(n => n.name)).toEqual(['HISTORY', 'ABILITIES', 'COLOUR PALETTE']);
    expect(tree.every(n => n.children.length === 0)).toBe(true);
  });

  it('nests by indentation', () => {
    const tree = parseRuleTemplate(['HISTORY', 'ABILITIES', '  COMBAT', '  MAGIC', 'COLOUR PALETTE'].join('\n'));
    expect(shape(tree)).toEqual([
      'HISTORY',
      'ABILITIES',
      '  COMBAT',
      '  MAGIC',
      'COLOUR PALETTE',
    ]);
  });

  it('nests several levels deep', () => {
    const tree = parseRuleTemplate('A\n  B\n    C\n      D');
    expect(shape(tree)).toEqual(['A', '  B', '    C', '      D']);
  });

  it('treats a tab as indentation', () => {
    const tree = parseRuleTemplate('ABILITIES\n\tCOMBAT');
    expect(shape(tree)).toEqual(['ABILITIES', '  COMBAT']);
  });

  it('handles tabs and spaces mixed across siblings', () => {
    const tree = parseRuleTemplate('ABILITIES\n\tCOMBAT\n  MAGIC');
    expect(shape(tree)).toEqual(['ABILITIES', '  COMBAT', '  MAGIC']);
  });

  it('ignores blank and whitespace-only lines', () => {
    const tree = parseRuleTemplate('\nHISTORY\n\n   \nABILITIES\n\n');
    expect(tree.map(n => n.name)).toEqual(['HISTORY', 'ABILITIES']);
  });

  it('trims trailing whitespace from names', () => {
    const tree = parseRuleTemplate('HISTORY   \n  COMBAT\t');
    expect(shape(tree)).toEqual(['HISTORY', '  COMBAT']);
  });

  it('pops back to the nearest shallower ancestor on dedent', () => {
    const tree = parseRuleTemplate('A\n    B\n        C\n    D\nE');
    expect(shape(tree)).toEqual(['A', '  B', '    C', '  D', 'E']);
  });

  it('recovers when a dedent lands between two indent levels', () => {
    // "C" is indented 3 — deeper than A (0) but shallower than B (6).
    const tree = parseRuleTemplate('A\n      B\n   C');
    expect(shape(tree)).toEqual(['A', '  B', '  C']);
  });

  it('treats a first line that is indented as a root', () => {
    const tree = parseRuleTemplate('    HISTORY\n    ABILITIES');
    expect(shape(tree)).toEqual(['HISTORY', 'ABILITIES']);
  });

  it('collapses duplicate siblings case-insensitively', () => {
    const tree = parseRuleTemplate('HISTORY\nhistory\nHiStOrY');
    expect(tree.map(n => n.name)).toEqual(['HISTORY']);
  });

  it('allows the same name under different parents', () => {
    const tree = parseRuleTemplate('GURA\n  HISTORY\nPEKORA\n  HISTORY');
    expect(shape(tree)).toEqual(['GURA', '  HISTORY', 'PEKORA', '  HISTORY']);
  });

  it('merges a repeated heading rather than orphaning its children', () => {
    const tree = parseRuleTemplate('ABILITIES\n  COMBAT\nABILITIES\n  MAGIC');
    expect(shape(tree)).toEqual(['ABILITIES', '  COMBAT', '  MAGIC']);
  });

  it('returns an empty tree for empty or whitespace-only input', () => {
    expect(parseRuleTemplate('')).toEqual([]);
    expect(parseRuleTemplate('   \n\n\t')).toEqual([]);
  });

  it('caps depth, keeping the over-deep line rather than dropping it', () => {
    const lines = Array.from({ length: MAX_RULE_DEPTH + 5 }, (_, i) => '  '.repeat(i) + `L${i}`);
    const tree = parseRuleTemplate(lines.join('\n'));

    let depth = 0;
    let node = tree[0];
    while (node?.children.length) {
      depth++;
      node = node.children[0];
    }
    expect(depth + 1).toBe(MAX_RULE_DEPTH);
    // Nothing was silently discarded.
    expect(countRuleNodes(tree)).toBe(MAX_RULE_DEPTH + 5);
  });

  it('caps the total number of nodes', () => {
    const lines = Array.from({ length: MAX_RULE_NODES + 50 }, (_, i) => `N${i}`);
    expect(countRuleNodes(parseRuleTemplate(lines.join('\n')))).toBe(MAX_RULE_NODES);
  });
});

describe('countRuleNodes', () => {
  it('counts every node at every depth', () => {
    expect(countRuleNodes(parseRuleTemplate('A\n  B\n  C\nD'))).toBe(4);
  });

  it('is zero for an empty tree', () => {
    expect(countRuleNodes([])).toBe(0);
  });
});

describe('isRuleTemplateEmpty', () => {
  it('is true for text with no usable names', () => {
    expect(isRuleTemplateEmpty('')).toBe(true);
    expect(isRuleTemplateEmpty('  \n\t\n')).toBe(true);
  });

  it('is false as soon as there is one name', () => {
    expect(isRuleTemplateEmpty('\n  HISTORY  \n')).toBe(false);
  });
});
