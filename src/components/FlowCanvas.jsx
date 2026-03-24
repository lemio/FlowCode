import { useCallback, useEffect, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  addEdge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import FunctionNode from './FunctionNode';
import VariableNode from './VariableNode';
import CallNode from './CallNode';
import ExpressionNode from './ExpressionNode';

const nodeTypes = {
  functionNode: FunctionNode,
  variableNode: VariableNode,
  callNode: CallNode,
  expressionNode: ExpressionNode,
};

function buildFlowNodes(parsedNodes, bindings, onValueChange) {
  const fnMap = {};
  parsedNodes.forEach(n => { if (n.type === 'function') fnMap[n.id] = n; });

  return parsedNodes.map(n => {
    let nodeType = 'variableNode';
    if (n.type === 'function') nodeType = 'functionNode';
    if (n.type === 'call') nodeType = 'callNode';
    if (n.type === 'expression') nodeType = 'expressionNode';

    // For call nodes, look up the bindings via the variable name (__call_X → X)
    const bindingKey = n.id.startsWith('__call_') ? n.id.slice(7) : n.id;
    const data = { label: n.label, value: bindings[bindingKey] };

    if (n.type === 'function') {
      data.params = n.params;
      data.bodyNodes = n.bodyNodes;
      data.bodyEdges = n.bodyEdges;
    }
    if (n.type === 'variable') {
      data.init = n.init;
      data.initKind = n.initKind;
      data.onValueChange = onValueChange;
    }
    if (n.type === 'call') {
      data.callee = n.callee;
      data.args = n.args;
      // Find the callee function to get param names
      const fn = fnMap[n.callee];
      data.fnParams = fn ? fn.params : null;
    }
    if (n.type === 'expression') {
      data.label = n.label;
      data.identifiers = n.identifiers;
    }

    return {
      id: n.id,
      type: nodeType,
      position: { x: n.x, y: n.y },
      data,
    };
  });
}

function buildFlowEdges(parsedEdges) {
  return parsedEdges.map(e => {
    const isFn = e.edgeType === 'fn';
    const isCallResult = e.edgeType === 'call-result';
    const isRef = e.edgeType === 'ref';
    const color = isFn ? '#10b981' : isCallResult ? '#34d399' : isRef ? '#a78bfa' : '#0ea5e9';
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      ...(e.sourceHandle ? { sourceHandle: e.sourceHandle } : {}),
      ...(e.targetHandle ? { targetHandle: e.targetHandle } : {}),
      label: e.label || '',
      animated: !!e.animated,
      markerEnd: { type: MarkerType.ArrowClosed, color },
      style: { stroke: color, strokeWidth: 2 },
      labelStyle: { fill: '#e2e8f0', fontSize: 10 },
      labelBgStyle: { fill: '#1e1e2e', fillOpacity: 0.8 },
    };
  });
}

export default function FlowCanvas({
  parsedNodes,
  parsedEdges,
  viewport,
  bindings,
  onNodePositionChange,
  onGraphConnect,
  onEdgeDelete,
  onValueChange,
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  // Track which nodeIds had their position explicitly set by the user in text
  const prevParsedPositions = useRef({});

  // Sync nodes: use parsed position when it differs from the last-known parsed position
  // (meaning the user edited //x,y in text), otherwise preserve the current canvas position.
  useEffect(() => {
    const newFlowNodes = buildFlowNodes(parsedNodes, bindings, onValueChange);

    setNodes(prev => {
      return newFlowNodes.map(n => {
        const existing = prev.find(p => p.id === n.id);
        const prevParsed = prevParsedPositions.current[n.id];

        if (!existing) {
          // New node – use parsed position
          prevParsedPositions.current[n.id] = { x: n.position.x, y: n.position.y };
          return n;
        }

        // Check if parsed position changed compared to last known parsed position
        const parsedChanged =
          !prevParsed ||
          Math.abs(n.position.x - prevParsed.x) > 1 ||
          Math.abs(n.position.y - prevParsed.y) > 1;

        prevParsedPositions.current[n.id] = { x: n.position.x, y: n.position.y };

        if (parsedChanged) {
          // User edited //x,y in text → move node on canvas
          return n;
        }
        // Otherwise preserve current canvas position (could be a drag)
        return { ...n, position: existing.position };
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsedNodes, bindings, onValueChange]);

  useEffect(() => {
    setEdges(buildFlowEdges(parsedEdges));
  }, [parsedEdges, setEdges]);

  const onNodeDragStop = useCallback((event, node) => {
    onNodePositionChange && onNodePositionChange(node.id, node.position.x, node.position.y);
  }, [onNodePositionChange]);

  // Allow connecting two nodes
  const handleConnect = useCallback((connection) => {
    if (onGraphConnect) {
      onGraphConnect(connection);
    } else {
      // Optimistically add the edge locally (will be replaced on next parse)
      setEdges(eds => addEdge({
        ...connection,
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed, color: '#a78bfa' },
        style: { stroke: '#a78bfa', strokeWidth: 2 },
      }, eds));
    }
  }, [onGraphConnect, setEdges]);

  // Delete selected edges/nodes on Backspace/Delete
  const handleEdgesDelete = useCallback((deletedEdges) => {
    if (onEdgeDelete) {
      deletedEdges.forEach(e => onEdgeDelete(e));
    }
  }, [onEdgeDelete]);

  const defaultViewport = viewport
    ? { x: -viewport.x, y: -viewport.y, zoom: 1 }
    : { x: 50, y: 50, zoom: 1 };

  return (
    <div style={{ width: '100%', height: '100%', background: '#0f172a' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStop={onNodeDragStop}
        onConnect={handleConnect}
        onEdgesDelete={handleEdgesDelete}
        nodeTypes={nodeTypes}
        defaultViewport={defaultViewport}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={['Backspace', 'Delete']}
        connectionLineStyle={{ stroke: '#a78bfa', strokeWidth: 2 }}
        connectionLineType="smoothstep"
      >
        <Background color="#1e293b" gap={20} />
        <Controls style={{ background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0' }} />
        <MiniMap
          style={{ background: '#1e293b', border: '1px solid #334155' }}
          nodeColor={n => {
            if (n.type === 'functionNode') return '#7c3aed';
            if (n.type === 'callNode') return '#059669';
            if (n.type === 'expressionNode') return '#f59e0b';
            return '#0ea5e9';
          }}
        />
      </ReactFlow>
    </div>
  );
}
