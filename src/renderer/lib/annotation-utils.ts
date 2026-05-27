import type { Annotation } from '../../shared/domain-types';

export function detectOverlaps(annotations: Annotation[]): Map<string, string[]> {
  const overlaps = new Map<string, string[]>();

  for (let i = 0; i < annotations.length; i++) {
    for (let j = i + 1; j < annotations.length; j++) {
      const a = annotations[i];
      const b = annotations[j];

      if (a.fromPos < b.toPos && b.fromPos < a.toPos) {
        if (!overlaps.has(a.id)) overlaps.set(a.id, []);
        if (!overlaps.has(b.id)) overlaps.set(b.id, []);
        overlaps.get(a.id)!.push(b.id);
        overlaps.get(b.id)!.push(a.id);
      }
    }
  }

  return overlaps;
}

export function findAdjacentAnnotations(
  annotations: Annotation[],
  targetId: string,
  threshold = 1
): Annotation[] {
  const target = annotations.find(a => a.id === targetId);
  if (!target) return [];

  return annotations.filter(a => {
    if (a.id === targetId) return false;
    return (
      Math.abs(a.toPos - target.fromPos) <= threshold ||
      Math.abs(target.toPos - a.fromPos) <= threshold
    );
  });
}

export function isPositionInAnnotation(pos: number, annotation: Annotation): boolean {
  return pos >= annotation.fromPos && pos <= annotation.toPos;
}

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
