import { memo } from 'react';
import { Handle, Position } from 'reactflow';

const ExpressionNode = memo(({ data }) => {
  const { label, identifiers } = data;
  return (
    <div style={{
      background: '#1e1e2e',
      border: '2px solid #f59e0b',
      borderRadius: '8px',
      minWidth: '140px',
      maxWidth: '220px',
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#e2e8f0',
      boxShadow: '0 4px 12px rgba(245,158,11,0.3)',
    }}>
      {/* Header */}
      <div style={{
        background: '#f59e0b',
        padding: '5px 10px',
        borderRadius: '6px 6px 0 0',
        fontWeight: 'bold',
        fontSize: '11px',
        color: '#000',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
      }}>
        <span style={{ fontSize: '13px' }}>∑</span>
        expr
      </div>

      {/* Expression text */}
      <div style={{
        padding: '6px 10px',
        fontFamily: "'Fira Code', 'Cascadia Code', monospace",
        fontSize: '12px',
        color: '#fbbf24',
        borderBottom: identifiers && identifiers.length > 0 ? '1px solid #374151' : 'none',
        wordBreak: 'break-all',
      }}>
        {label}
      </div>

      {/* Identifier inputs */}
      {identifiers && identifiers.length > 0 && (
        <div>
          {identifiers.map((ident, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              padding: '3px 10px 3px 16px',
              position: 'relative',
              fontSize: '11px',
            }}>
              <Handle
                type="target"
                position={Position.Left}
                id={`id-${i}`}
                style={{ left: -8, background: '#f59e0b', width: 8, height: 8 }}
              />
              <span style={{ color: '#94a3b8', marginRight: 4 }}>{ident}:</span>
              <span style={{ color: '#fbbf24' }}>{ident}</span>
            </div>
          ))}
        </div>
      )}

      {/* Output handle */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        style={{ background: '#fbbf24', width: 10, height: 10 }}
      />
    </div>
  );
});

ExpressionNode.displayName = 'ExpressionNode';
export default ExpressionNode;
