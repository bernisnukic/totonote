/**
 * A category rule is the sub-category skeleton stamped onto each new child of a
 * category. It is authored — and stored — as indented plain text:
 *
 *     HISTORY
 *     ABILITIES
 *       COMBAT
 *       MAGIC
 *     COLOUR PALETTE
 *
 * The raw text is the source of truth so it round-trips into the editor exactly as
 * typed; this module turns it into a tree for previewing and for applying.
 */

export interface RuleNode {
  name: string;
  children: RuleNode[];
}

/** Tabs count as this many columns when measuring indentation. */
const TAB_WIDTH = 2;

/** Guard rails against pathological input (a pasted novel, a runaway indent). */
export const MAX_RULE_DEPTH = 10;
export const MAX_RULE_NODES = 200;

/**
 * Parse indented text into a tree.
 *
 * Depth comes from an indent stack rather than dividing by a fixed unit, so mixed or
 * inconsistent indentation degrades into something sensible instead of throwing: a line
 * indented further than the previous one is its child, and a line indented less pops
 * back to the nearest shallower ancestor.
 *
 * Blank lines are ignored, names are trimmed, siblings sharing a name
 * (case-insensitively) collapse to the first — the database would reject the duplicate
 * anyway, and silently keeping one is friendlier than failing the whole apply.
 */
export function parseRuleTemplate(text: string): RuleNode[] {
  const roots: RuleNode[] = [];
  // Sentinel root so every real line has a parent to attach to.
  const stack: { indent: number; children: RuleNode[] }[] = [{ indent: -1, children: roots }];
  let nodeCount = 0;

  for (const rawLine of text.split('\n')) {
    const line = rawLine.replace(/\t/g, ' '.repeat(TAB_WIDTH));
    const name = line.trim();
    if (!name) continue;
    if (nodeCount >= MAX_RULE_NODES) break;

    const indent = line.length - line.trimStart().length;

    // Pop until the stack top is a strictly shallower line — that's this line's parent.
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    // Clamp rather than reject: the extra depth is almost certainly a typo, and losing
    // the level is better than losing the line.
    if (stack.length > MAX_RULE_DEPTH) {
      stack.length = MAX_RULE_DEPTH;
    }

    const parent = stack[stack.length - 1];
    const existing = parent.children.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      // Merge into the node already there so a repeated heading's children aren't
      // orphaned up to the root.
      stack.push({ indent, children: existing.children });
      continue;
    }

    const node: RuleNode = { name, children: [] };
    parent.children.push(node);
    nodeCount++;
    stack.push({ indent, children: node.children });
  }

  return roots;
}

/** Total nodes in the tree, at every depth. */
export function countRuleNodes(nodes: RuleNode[]): number {
  return nodes.reduce((sum, n) => sum + 1 + countRuleNodes(n.children), 0);
}

/** True when the template holds nothing worth applying. */
export function isRuleTemplateEmpty(text: string): boolean {
  return parseRuleTemplate(text).length === 0;
}
