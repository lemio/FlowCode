import { memo } from 'react';
import { Handle, Position } from 'reactflow';

/**
 * Function node rendered as a sub-flow GROUP container.
 * Its children (BodyNode instances) are laid out inside it by the parser.
 * Width/height are set via ReactFlow node.style so the container fits its children.
 */
const FunctionNode = memo(({ data }) => {
  const { label, params } = data;
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'rgba(20, 15, 40, 0.75)',
        border: '2px solid #7c3aed',
        borderRadius: '8px',
        boxSizing: 'border-box',
        fontFamily: 'monospace',
        boxShadow: '0 4px 18px rgba(124,58,237,0.35)',
      }}
    >
      {/* ── Header ────────────────────────────────────────────────────── */}
      <div
        style={{
          background: '#7c3aed',
          padding: '5px 10px',
          borderRadius: '6px 6px 0 0',
          fontWeight: 'bold',
          fontSize: '12px',
          color: '#e2e8f0',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          userSelect: 'none',
        }}
      >
        <span style={{ opacity: 0.75, fontSize: '10px' }}>ƒ</span>
        {label}
        {params && params.length > 0 && (
          <span style={{ opacity: 0.6, fontWeight: 'normal', fontSize: '11px' }}>
            ({params.join(', ')})
          </span>
        )}
      </div>

      {/* Output handle – other nodes connect FROM this function */}
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
