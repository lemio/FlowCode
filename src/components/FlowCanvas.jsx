import { useCallback, useEffect, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  MarkerType,
  addEdge,
  updateEdge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import FunctionNode from './FunctionNode';
import VariableNode from './VariableNode';
import CallNode from './CallNode';
import ExpressionNode from './ExpressionNode';
import BodyNode from './BodyNode';

const nodeTypes = {
  functionNode: FunctionNode,
  variableNode: VariableNode,
  callNode: CallNode,
  expressionNode: ExpressionNode,
  bodyNode: BodyNode,
};

function buildFlowNodes(parsedNodes, bindings, onValueChange) {
  const fnMap = {};
  parsedNodes.forEach(n => { if (n.type === 'function') fnMap[n.id] = n; });

  return parsedNodes.map(n => {
    let nodeType = 'variableNode';
    if (n.type === 'function') nodeType = 'functionNode';
    if (n.type === 'call')     nodeType = 'callNode';
    if (n.type === 'expression') nodeType = 'expressionNode';
    if (n.type === 'bodyNode') nodeType = 'bodyNode';

    // For call nodes look up bindings via the variable name (__call_X → X)
    const bindingKey = n.id.startsWith('__call_') ? n.id.slice(7) : n.id;
    const data = { label: n.label, value: bindings[bindingKey] };

    if (n.type === 'function') {
      data.params = n.params;
    }
    if (n.type === 'variable') {
      data.init = n.init;
      data.initKind = n.initKind;
      data.onValueChange = onValueChange;
    }
    if (n.type === 'call') {
      data.callee = n.callee;
      data.args = n.args;
      const fn = fnMap[n.callee];
      data.fnParams = fn ? fn.params : null;
    }
    if (n.type === 'expression') {
      data.label = n.label;
      data.identifiers = n.identifiers;
    }
    if (n.type === 'bodyNode') {
      data.stmtType = n.stmtType;
    }

    const rfNode = {
      id: n.id,
      type: nodeType,
      position: { x: n.x, y: n.y },
      data,
    };

    // Sub-flow: body nodes live inside their parent function container
    if (n.parentNode) {
      rfNode.parentNode = n.parentNode;
      rfNode.extent = 'parent';
    }

    // Function containers need explicit dimensions for sub-flow to work
    if (n.type === 'function') {
      rfNode.style = { width: n.width || 310, height: n.height || 200 };
    }

    return rfNode;
  });
}

function buildFlowEdges(parsedEdges) {
  return parsedEdges.map(e => {
    const isFn        = e.edgeType === 'fn';
    const isCallResult = e.edgeType === 'call-result';
    const isRef       = e.edgeType === 'ref';
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
      // Store edgeType in data so onEdgesDelete callbacks can read it
      data: { edgeType: e.edgeType },
    };
  });
}

// ── Inner component that can call useReactFlow ────────────────────────────
function FlowNavigator({ canvasNavigateRef }) {
  const instance = useReactFlow();

  useEffect(() => {
    if (!canvasNavigateRef) return;
    canvasNavigateRef.current = {
      navigateTo(x, y) {
        const el = document.querySelector('.react-flow');
        const w = el ? el.offsetWidth  : 800;
        const h = el ? el.offsetHeight : 600;
        instance.setViewport(
          { x: w / 2 - x, y: h / 2 - y, zoom: 1 },
          { duration: 400 },
        );
      },
    };
  }, [canvasNavigateRef, instance]);

  return null;
}

export default function FlowCanvas({
  parsedNodes,
  parsedEdges,
  viewport,
  bindings,
  onNodePositionChange,
  onGraphConnect,
  onEdgeDelete,
  onEdgeReconnect,
  onValueChange,
  canvasNavigateRef,
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const prevParsedPositions = useRef({});

  // ── Sync nodes ───────────────────────────────────────────────────────────
  useEffect(() => {
    const newFlowNodes = buildFlowNodes(parsedNodes, bindings, onValueChange);

    setNodes(prev => {
      return newFlowNodes.map(n => {
        const existing = prev.find(p => p.id === n.id);
        const prevParsed = prevParsedPositions.current[n.id];

        if (!existing) {
          prevParsedPositions.current[n.id] = { x: n.position.x, y: n.position.y };
          return n;
        }

        const parsedChanged =
          !prevParsed ||
          Math.abs(n.position.x - prevParsed.x) > 1 ||
          Math.abs(n.position.y - prevParsed.y) > 1;

        prevParsedPositions.current[n.id] = { x: n.position.x, y: n.position.y };

        if (parsedChanged) {
          // //x,y edited in text → snap to parsed position
          return n;
        }
        // Preserve user-dragged position
        return { ...n, position: existing.position };
      });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsedNodes, bindings, onValueChange]);

  useEffect(() => {
    setEdges(buildFlowEdges(parsedEdges));
  }, [parsedEdges, setEdges]);

  // ── Drag stop ────────────────────────────────────────────────────────────
  const onNodeDragStop = useCallback((_, node) => {
    onNodePositionChange && onNodePositionChange(node.id, node.position.x, node.position.y);
  }, [onNodePositionChange]);

  // ── Connect ──────────────────────────────────────────────────────────────
  const handleConnect = useCallback((connection) => {
    if (onGraphConnect) {
      onGraphConnect(connection);
    } else {
      setEdges(eds => addEdge({
        ...connection,
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed, color: '#a78bfa' },
        style: { stroke: '#a78bfa', strokeWidth: 2 },
      }, eds));
    }
  }, [onGraphConnect, setEdges]);

  // ── Edge delete ──────────────────────────────────────────────────────────
  const handleEdgesDelete = useCallback((deletedEdges) => {
    if (onEdgeDelete) {
      deletedEdges.forEach(e => onEdgeDelete({
        ...e,
        edgeType: e.data?.edgeType || 'unknown',
      }));
    }
  }, [onEdgeDelete]);

  // ── Reconnect edges (ReactFlow v11: onEdgeUpdate API) ────────────────────
  const edgeUpdateSuccessful = useRef(true);

  const onEdgeUpdateStart = useCallback(() => {
    edgeUpdateSuccessful.current = false;
  }, []);

  const onEdgeUpdate = useCallback((oldEdge, newConnection) => {
    edgeUpdateSuccessful.current = true;
    setEdges(els => updateEdge(oldEdge, newConnection, els));
    if (onEdgeReconnect) {
      onEdgeReconnect(oldEdge, newConnection);
    }
  }, [onEdgeReconnect, setEdges]);

  const onEdgeUpdateEnd = useCallback((_, edge) => {
    if (!edgeUpdateSuccessful.current) {
      setEdges(eds => eds.filter(e => e.id !== edge.id));
      if (onEdgeDelete) {
        onEdgeDelete({ ...edge, edgeType: edge.data?.edgeType || 'unknown' });
      }
    }
    edgeUpdateSuccessful.current = true;
  }, [onEdgeDelete, setEdges]);

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
        onEdgeUpdate={onEdgeUpdate}
        onEdgeUpdateStart={onEdgeUpdateStart}
        onEdgeUpdateEnd={onEdgeUpdateEnd}
        nodeTypes={nodeTypes}
        defaultViewport={defaultViewport}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={['Backspace', 'Delete']}
        connectionLineStyle={{ stroke: '#a78bfa', strokeWidth: 2 }}
        connectionLineType="smoothstep"
      >
        <FlowNavigator canvasNavigateRef={canvasNavigateRef} />
        <Background color="#1e293b" gap={20} />
        <Controls style={{ background: '#1e293b', border: '1px solid #334155', color: '#e2e8f0' }} />
        <MiniMap
          style={{ background: '#1e293b', border: '1px solid #334155' }}
          nodeColor={n => {
            if (n.type === 'functionNode') return '#7c3aed';
            if (n.type === 'callNode')     return '#059669';
            if (n.type === 'expressionNode') return '#f59e0b';
            if (n.type === 'bodyNode')     return '#334155';
            return '#0ea5e9';
          }}
        />
      </ReactFlow>
    </div>
  );
}

