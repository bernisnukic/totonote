import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../../stores';
import { invoke } from '../../lib/ipc-client';
import type { FilingEdge } from '../../../shared/domain-types';

/**
 * The connections view: every category, every tag, and every filing drawn as one map.
 *
 *   category ── category   the tree (parent to child)
 *   tag ┄┄ category         membership (the tag lives in that category)
 *   tag ━━ category         filings (excerpts with that tag are filed on that page)
 *
 * Filings are the interesting edges — they cut across the tree and show which pages a
 * tag's excerpts actually landed on. Clicking any node opens its page in the Info tab.
 *
 * Layout is a small hand-rolled force simulation; at the scale of a lore project
 * (tens of nodes) there is no need for a graph library.
 */

interface GraphNode {
  id: string;
  kind: 'category' | 'tag';
  refId: string;
  label: string;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface GraphEdge {
  from: string;
  to: string;
  kind: 'tree' | 'member' | 'filing';
  weight: number;
}

const SPRING_LENGTH: Record<GraphEdge['kind'], number> = { tree: 95, member: 70, filing: 150 };
const TICKS = 260;

export function GraphView() {
  const categories = useStore(s => s.categories);
  const tags = useStore(s => s.tags);
  const setGraphOpen = useStore(s => s.setGraphOpen);
  const setFocusedTag = useStore(s => s.setFocusedTag);
  const setFocusedCategory = useStore(s => s.setFocusedCategory);

  const [filingEdges, setFilingEdges] = useState<FilingEdge[]>([]);
  const [, setTick] = useState(0);
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });

  const nodesRef = useRef<GraphNode[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const dragRef = useRef<{ nodeId: string | null; panning: boolean; moved: boolean; lastX: number; lastY: number }>(
    { nodeId: null, panning: false, moved: false, lastX: 0, lastY: 0 },
  );

  useEffect(() => {
    invoke('annotation:filing-edges').then(setFilingEdges);
  }, []);

  const empty = categories.length + tags.length === 0;

  const edges = useMemo<GraphEdge[]>(() => {
    const result: GraphEdge[] = [];
    for (const c of categories) {
      if (c.parentId) result.push({ from: `c:${c.parentId}`, to: `c:${c.id}`, kind: 'tree', weight: 1 });
    }
    for (const t of tags) {
      result.push({ from: `t:${t.id}`, to: `c:${t.categoryId}`, kind: 'member', weight: 1 });
    }
    for (const f of filingEdges) {
      // A filing into the tag's own category would duplicate the membership edge.
      const tag = tags.find(t => t.id === f.tagId);
      if (tag && tag.categoryId === f.categoryId) continue;
      result.push({ from: `t:${f.tagId}`, to: `c:${f.categoryId}`, kind: 'filing', weight: f.count });
    }
    return result;
  }, [categories, tags, filingEdges]);

  // (Re)build nodes when the data changes, keeping positions of survivors.
  useEffect(() => {
    const existing = new Map(nodesRef.current.map(n => [n.id, n]));
    const next: GraphNode[] = [];
    const total = categories.length + tags.length;
    let i = 0;
    const place = (id: string): { x: number; y: number } => {
      const kept = existing.get(id);
      if (kept) return { x: kept.x, y: kept.y };
      // Spiral seed positions — deterministic enough, and the simulation untangles it.
      const angle = (i / Math.max(total, 1)) * Math.PI * 2 * 2.5;
      const radius = 60 + i * 14;
      return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
    };
    for (const c of categories) {
      const id = `c:${c.id}`;
      next.push({ id, kind: 'category', refId: c.id, label: c.name, color: '', ...place(id), vx: 0, vy: 0 });
      i++;
    }
    for (const t of tags) {
      const id = `t:${t.id}`;
      next.push({ id, kind: 'tag', refId: t.id, label: t.name, color: t.color, ...place(id), vx: 0, vy: 0 });
      i++;
    }
    nodesRef.current = next;
    setTick(t => t + 1);
  }, [categories, tags]);

  // Force simulation: repulsion + springs + gentle centering, run to rest once.
  useEffect(() => {
    let frame = 0;
    let raf = 0;
    const byId = () => new Map(nodesRef.current.map(n => [n.id, n]));

    const step = () => {
      const nodes = nodesRef.current;
      const map = byId();
      for (let a = 0; a < nodes.length; a++) {
        for (let b = a + 1; b < nodes.length; b++) {
          const na = nodes[a];
          const nb = nodes[b];
          const dx = nb.x - na.x;
          const dy = nb.y - na.y;
          const distSq = Math.max(dx * dx + dy * dy, 64);
          const force = 2600 / distSq;
          const dist = Math.sqrt(distSq);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          na.vx -= fx;
          na.vy -= fy;
          nb.vx += fx;
          nb.vy += fy;
        }
      }
      for (const e of edges) {
        const from = map.get(e.from);
        const to = map.get(e.to);
        if (!from || !to) continue;
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
        const stretch = (dist - SPRING_LENGTH[e.kind]) * 0.02;
        const fx = (dx / dist) * stretch;
        const fy = (dy / dist) * stretch;
        from.vx += fx;
        from.vy += fy;
        to.vx -= fx;
        to.vy -= fy;
      }
      for (const n of nodes) {
        if (dragRef.current.nodeId === n.id) {
          n.vx = 0;
          n.vy = 0;
          continue;
        }
        n.vx = (n.vx - n.x * 0.01) * 0.82;
        n.vy = (n.vy - n.y * 0.01) * 0.82;
        n.x += n.vx;
        n.y += n.vy;
      }
      setTick(t => t + 1);
      frame++;
      if (frame < TICKS) raf = requestAnimationFrame(step);
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [edges]);

  // Escape closes the graph.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setGraphOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [setGraphOpen]);

  // Keep the origin at the visual centre of the canvas.
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [empty]);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    const target = e.target as SVGElement;
    const nodeId = target.closest('[data-node-id]')?.getAttribute('data-node-id') ?? null;
    dragRef.current = { nodeId, panning: !nodeId, moved: false, lastX: e.clientX, lastY: e.clientY };
    (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag.nodeId && !drag.panning) return;
    const dx = e.clientX - drag.lastX;
    const dy = e.clientY - drag.lastY;
    if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    if (drag.nodeId) {
      const node = nodesRef.current.find(n => n.id === drag.nodeId);
      if (node) {
        node.x += dx / view.scale;
        node.y += dy / view.scale;
        setTick(t => t + 1);
      }
    } else {
      setView(v => ({ ...v, x: v.x + dx / v.scale, y: v.y + dy / v.scale }));
    }
  };

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (drag.nodeId && !drag.moved) {
      const node = nodesRef.current.find(n => n.id === drag.nodeId);
      if (node) {
        setGraphOpen(false);
        if (node.kind === 'tag') setFocusedTag(node.refId);
        else setFocusedCategory(node.refId);
      }
    }
    dragRef.current = { nodeId: null, panning: false, moved: false, lastX: 0, lastY: 0 };
    (e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId);
  };

  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
    setView(v => ({ ...v, scale: Math.min(3, Math.max(0.3, v.scale * factor)) }));
  };

  const nodes = nodesRef.current;
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  return (
    <div className="graph-overlay">
      <div className="graph-header">
        <span className="graph-title">Connections</span>
        <button className="btn btn-ghost btn-sm graph-close" onClick={() => setGraphOpen(false)} title="Close">
          &times;
        </button>
      </div>

      {empty ? (
        <div className="empty-state">
          <p className="empty-state-text">Nothing to map yet — create some categories and tags first.</p>
        </div>
      ) : (
        <svg
          ref={svgRef}
          className="graph-canvas"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onWheel={onWheel}
        >
          <g transform={`translate(${size.w / 2}, ${size.h / 2})`}>
            <g transform={`scale(${view.scale}) translate(${view.x}, ${view.y})`}>
              {edges.map((e, i) => {
                const from = nodeMap.get(e.from);
                const to = nodeMap.get(e.to);
                if (!from || !to) return null;
                return (
                  <line
                    key={i}
                    className={`graph-edge graph-edge-${e.kind}`}
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    strokeWidth={e.kind === 'filing' ? Math.min(1 + e.weight * 0.5, 4) : undefined}
                  />
                );
              })}
              {nodes.map(n =>
                n.kind === 'category' ? (
                  <g key={n.id} data-node-id={n.id} className="graph-node graph-node-category">
                    <rect x={n.x - 10} y={n.y - 8} width={20} height={16} rx={3} />
                    <text x={n.x} y={n.y + 22} textAnchor="middle">
                      {n.label}
                    </text>
                  </g>
                ) : (
                  <g key={n.id} data-node-id={n.id} className="graph-node graph-node-tag">
                    <circle cx={n.x} cy={n.y} r={7} fill={n.color} />
                    <text x={n.x} y={n.y + 20} textAnchor="middle">
                      {n.label}
                    </text>
                  </g>
                ),
              )}
            </g>
          </g>
        </svg>
      )}

      <div className="graph-legend">
        <span className="graph-legend-item">
          <svg width="18" height="10"><line className="graph-edge graph-edge-tree" x1="0" y1="5" x2="18" y2="5" /></svg>
          category tree
        </span>
        <span className="graph-legend-item">
          <svg width="18" height="10"><line className="graph-edge graph-edge-member" x1="0" y1="5" x2="18" y2="5" /></svg>
          tag&rsquo;s home
        </span>
        <span className="graph-legend-item">
          <svg width="18" height="10"><line className="graph-edge graph-edge-filing" x1="0" y1="5" x2="18" y2="5" /></svg>
          filed excerpts
        </span>
        <span className="graph-legend-hint">click a node to open its page · drag to move · scroll to zoom</span>
      </div>
    </div>
  );
}
