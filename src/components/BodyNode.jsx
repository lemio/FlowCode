import { memo } from 'react';

/**
 * A body node rendered INSIDE a function sub-flow container.
 * data.stmtType: 'param' | 'stmt' | 'if' | 'return'
 * data.label: text to display
 * No external handles – body nodes communicate via visual layout only.
 */
const BodyNode = memo(({ data }) => {
  const { label, stmtType } = data;

  let bg = '#1e293b', border = '#475569', color = '#cbd5e1', radius = '5px';
  let prefix = null;

  if (stmtType === 'param') {
    bg = '#1e3a5f'; border = '#3b82f6'; color = '#93c5fd'; radius = '14px';
  } else if (stmtType === 'if') {
    bg = '#422006'; border = '#d97706'; color = '#fcd34d'; radius = '5px';
    prefix = '◆ ';
  } else if (stmtType === 'return') {
    bg = '#052e16'; border = '#16a34a'; color = '#86efac'; radius = '5px';
    prefix = '↩ ';
  }

  return (
    <div
      style={{
        background: bg,
        border: `1.5px solid ${border}`,
        borderRadius: radius,
        padding: '3px 9px',
        fontSize: '10px',
        fontFamily: "'Fira Code', 'Cascadia Code', monospace",
        color,
        whiteSpace: 'nowrap',
        maxWidth: '200px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        userSelect: 'none',
      }}
      title={label}
    >
      {prefix && <span style={{ opacity: 0.7 }}>{prefix}</span>}
      {label}
    </div>
  );
});

BodyNode.displayName = 'BodyNode';
export default BodyNode;
