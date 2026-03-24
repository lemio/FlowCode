import { memo } from 'react';
import { Handle, Position } from 'reactflow';

/**
 * A tiny visual diagram rendered inside the function node to represent the body.
 * Uses absolute-positioned divs and SVG lines (no nested ReactFlow).
 */
function BodyDiagram({ bodyNodes, bodyEdges }) {
  const allNodes = bodyNodes || [];
  const allEdges = bodyEdges || [];

  // Compute canvas height from node positions
  const maxY = allNodes.reduce((m, n) => Math.max(m, n.y + 30), 60);
  const height = maxY + 30;

  // Map node id → center position for edge drawing
  const centers = {};
  allNodes.forEach(n => {
    centers[n.id] = { x: n.x + 80, y: n.y + 14 }; // center of a typical 160×28 box
  });

  function nodeStyle(n) {
    const base = {
      position: 'absolute',
      left: n.x,
      top: n.y,
      padding: '3px 8px',
      borderRadius: n.type === 'if' ? '4px' : n.type === 'return' ? '12px' : '4px',
      fontSize: '10px',
      fontFamily: "'Fira Code', 'Cascadia Code', monospace",
      whiteSpace: 'nowrap',
      maxWidth: '200px',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      border: '1px solid',
      color: '#e2e8f0',
      zIndex: 1,
      cursor: 'default',
    };
    if (n.type === 'param') {
      return { ...base, background: '#1d4ed8', borderColor: '#3b82f6', color: '#bfdbfe', fontSize: '9px', borderRadius: '10px' };
    }
    if (n.type === 'if') {
      return { ...base, background: '#78350f', borderColor: '#f59e0b', color: '#fde68a', borderRadius: '6px', transform: 'skew(-6deg)' };
    }
    if (n.type === 'return') {
      return { ...base, background: '#052e16', borderColor: '#10b981', color: '#6ee7b7' };
    }
    return { ...base, background: '#1e293b', borderColor: '#475569' };
  }

  return (
    <div style={{ position: 'relative', width: '100%', height, overflow: 'hidden', borderRadius: '0 0 6px 6px' }}>
      {/* SVG for edges */}
      <svg
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}
      >
        {allEdges.map(e => {
          const from = centers[e.source];
          const to = centers[e.target];
          if (!from || !to) return null;
          return (
            <line
              key={e.id}
              x1={from.x} y1={from.y}
              x2={to.x} y2={to.y}
              stroke="#475569" strokeWidth="1.5"
              markerEnd="url(#arr)"
            />
          );
        })}
        <defs>
          <marker id="arr" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#475569" />
          </marker>
        </defs>
      </svg>
      {/* Nodes */}
      {allNodes.map(n => (
        <div key={n.id} style={nodeStyle(n)} title={n.label}>
          {n.label}
        </div>
      ))}
    </div>
  );
}

const FunctionNode = memo(({ data }) => {
  const { label, params, bodyNodes, bodyEdges } = data;
  const hasBody = bodyNodes && bodyNodes.some(n => n.type !== 'param');
  return (
    <div style={{
      background: '#1e1e2e',
      border: '2px solid #7c3aed',
      borderRadius: '8px',
      minWidth: '220px',
      maxWidth: '320px',
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#e2e8f0',
      boxShadow: '0 4px 12px rgba(124,58,237,0.3)',
    }}>
      {/* Header */}
      <div style={{
        background: '#7c3aed',
        padding: '6px 10px',
        borderRadius: '6px 6px 0 0',
        fontWeight: 'bold',
        fontSize: '13px',
        display: 'flex',
        alignItems: 'baseline',
        gap: '6px',
      }}>
        <span style={{ opacity: 0.8, fontSize: '10px' }}>ƒ</span>
        {label}
        {params && params.length > 0 && (
          <span style={{ opacity: 0.65, fontWeight: 'normal', fontSize: '11px' }}>
            ({params.join(', ')})
          </span>
        )}
      </div>

      {/* Body mini-diagram */}
      {hasBody ? (
        <BodyDiagram bodyNodes={bodyNodes} bodyEdges={bodyEdges} />
      ) : (
        <div style={{ padding: '6px 10px', color: '#475569', fontSize: '11px', borderRadius: '0 0 6px 6px' }}>
          (empty body)
        </div>
      )}

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        style={{ background: '#a78bfa', width: 10, height: 10 }}
      />
    </div>
  );
});

FunctionNode.displayName = 'FunctionNode';
export default FunctionNode;
