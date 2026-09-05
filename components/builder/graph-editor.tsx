'use client';

import { useMemo, useState } from 'react';
import {
  Background,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  type NodeProps,
  type ReactFlowInstance,
} from '@xyflow/react';
import { Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NODE_BY_ID, NODE_CATALOG } from '@/lib/matchbox/catalog';
import type { NodeDefinition, ProjectNode } from '@/lib/matchbox/types';
import { useProjectStore } from '@/lib/store/project-store';

interface MatchboxNodeData extends Record<string, unknown> {
  projectNode: ProjectNode;
  definition: NodeDefinition;
}

export function GraphEditor({ active = true }: { active?: boolean }) {
  const {
    project,
    onNodesChange,
    onEdgesChange,
    onConnect,
    selectNode,
    addNode,
    selectedNodeId,
    selectedNodeIds,
    selectedEdgeIds,
    connect,
    connectionError,
    beginEdit,
    endEdit,
  } = useProjectStore();
  const [search, setSearch] = useState('');
  const [flow, setFlow] = useState<ReactFlowInstance>();
  const [zoom, setZoom] = useState(1);
  const [measurements, setMeasurements] = useState<
    Record<string, { width: number; height: number }>
  >({});
  const [mode, setMode] = useState(() => {
    try {
      return localStorage.getItem('dgmb-navigation') ?? 'mouse';
    } catch {
      return 'mouse';
    }
  });
  const [menu, setMenu] = useState<{ id: string; x: number; y: number }>();
  const nodes = useMemo(
    () =>
      project.nodes.map((projectNode) => ({
        id: projectNode.id,
        position: projectNode.position,
        type: 'matchbox',
        selected: selectedNodeIds.includes(projectNode.id),
        measured: measurements[projectNode.id],
        data: {
          projectNode,
          definition: NODE_BY_ID.get(projectNode.definitionId)!,
        },
      })),
    [project.nodes, selectedNodeIds, measurements],
  );
  const edges = useMemo(
    () =>
      project.edges.map((edge) => ({
        ...edge,
        type: 'smoothstep',
        selected: selectedEdgeIds.includes(edge.id),
        interactionWidth: 24,
        reconnectable: true,
        style: {
          stroke: selectedEdgeIds.includes(edge.id) ? '#ffb15f' : '#b8612a',
          strokeWidth: selectedEdgeIds.includes(edge.id) ? 3 : 1.5,
        },
      })),
    [project.edges, selectedEdgeIds],
  );
  const filtered = NODE_CATALOG.filter((entry) =>
    entry.label.en.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="absolute inset-0 flex bg-[#0c0d0f]">
      <aside className="w-44 shrink-0 overflow-auto border-r border-[#2d3037] bg-[#15171b] p-3">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.14em] text-[#767c86]">
              Node library
            </p>
            <h2 className="text-sm font-semibold">Add a node</h2>
          </div>
        </div>
        <div className="relative mb-3">
          <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-[#717681]" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-8 border-[#343840] bg-[#101215] pl-7 text-xs"
            placeholder="Search"
          />
        </div>
        <div className="max-h-[calc(100vh-130px)] space-y-1 overflow-y-auto pr-1">
          {filtered.map((definition) => (
            <button
              key={definition.id}
              onClick={() => addNode(definition.id)}
              className="flex w-full items-center gap-2 rounded-md border border-transparent px-2 py-2 text-left hover:border-[#3a3e46] hover:bg-[#202329]"
            >
              <span className="grid size-6 place-items-center rounded bg-[#29231f] text-[#f18a46]">
                <Plus className="size-3" />
              </span>
              <span>
                <span className="block text-xs font-medium">
                  {definition.label.en}
                </span>
                <span className="block text-[9px] uppercase text-[#6f7580]">
                  {definition.category} · {definition.cost}
                </span>
              </span>
            </button>
          ))}
        </div>
      </aside>
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="z-10 flex flex-wrap items-center gap-1 border-b border-[#343840] bg-[#15171b] p-2 text-xs">
          <select
            aria-label="Graph navigation"
            value={mode}
            onChange={(e) => {
              setMode(e.target.value);
              try {
                localStorage.setItem('dgmb-navigation', e.target.value);
              } catch {
                /* optional preference */
              }
            }}
          >
            <option value="mouse">Mouse</option>
            <option value="trackpad">Trackpad</option>
          </select>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => flow?.zoomOut()}
            aria-label="Zoom graph out"
          >
            −
          </Button>
          <span>{Math.round(zoom * 100)}%</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => flow?.zoomIn()}
            aria-label="Zoom graph in"
          >
            +
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => flow?.fitView({ padding: 0.2 })}
          >
            Fit all
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!selectedNodeId}
            onClick={() =>
              flow?.fitView({
                nodes: selectedNodeIds.map((id) => ({ id })),
                maxZoom: 1.5,
                padding: 0.3,
              })
            }
          >
            Fit selection
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={!selectedEdgeIds.length}
            onClick={() =>
              onEdgesChange(
                selectedEdgeIds.map((id) => ({ type: 'remove', id })),
              )
            }
          >
            Disconnect
          </Button>
        </div>
        <div className="relative min-h-0 flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onInit={setFlow}
            onMove={(_, viewport) => setZoom(viewport.zoom)}
            onNodesChange={(changes) => {
              const dimensions = changes.filter(
                (change) => change.type === 'dimensions',
              );
              if (dimensions.length)
                setMeasurements((previous) => {
                  const next = { ...previous };
                  for (const change of dimensions)
                    if (change.dimensions) next[change.id] = change.dimensions;
                  return next;
                });
              const edits = changes.filter(
                (change) => change.type !== 'dimensions',
              );
              if (edits.length) onNodesChange(edits);
            }}
            onEdgesChange={onEdgesChange}
            onBeforeDelete={async () => {
              beginEdit();
              return true;
            }}
            onDelete={endEdit}
            onConnect={onConnect}
            onReconnect={(edge, connection) => connect(connection, edge.id)}
            onConnectEnd={(_, state) => {
              if (!state.isValid)
                useProjectStore.setState({
                  connectionError:
                    'Connection unchanged. Drop onto a compatible socket.',
                });
            }}
            onReconnectEnd={(_, __, ___, state) => {
              if (!state.isValid)
                useProjectStore.setState({
                  connectionError:
                    'Connection unchanged. Drop onto a compatible socket.',
                });
            }}
            onNodeDragStart={beginEdit}
            onNodeDragStop={endEdit}
            onSelectionDragStart={beginEdit}
            onSelectionDragStop={endEdit}
            panOnScroll={mode === 'trackpad'}
            zoomOnScroll={mode === 'mouse'}
            zoomOnPinch
            panOnDrag={[0, 1]}
            panActivationKeyCode="Space"
            selectionKeyCode="Shift"
            onEdgeContextMenu={(event, edge) => {
              event.preventDefault();
              const rect = event.currentTarget
                .closest('.react-flow')!
                .getBoundingClientRect();
              setMenu({
                id: edge.id,
                x: event.clientX - rect.left,
                y: event.clientY - rect.top,
              });
            }}
            onPaneClick={() => {
              setMenu(undefined);
              selectNode(undefined);
            }}
            onNodeClick={(event, node) => {
              if (!event.shiftKey && !event.metaKey && !event.ctrlKey)
                selectNode(node.id);
            }}
            fitView
            colorMode="dark"
            deleteKeyCode={active ? ['Backspace', 'Delete'] : null}
          >
            <Background color="#2c3037" gap={22} size={1} />
            <MiniMap
              className="border border-[#343840]! bg-[#14161a]!"
              maskColor="rgb(0 0 0 / 55%)"
              nodeColor="#ff7a1a"
            />
          </ReactFlow>
          {menu && (
            <button
              className="absolute z-50 rounded border border-[#555] bg-[#222] p-3 text-xs"
              style={{ left: menu.x, top: menu.y }}
              onClick={() => {
                onEdgesChange([{ type: 'remove', id: menu.id }]);
                setMenu(undefined);
              }}
            >
              Disconnect
            </button>
          )}
          <div className="pointer-events-none absolute left-4 top-4 max-w-64 rounded-md border border-[#373a42] bg-[#14161a]/90 px-3 py-2 backdrop-blur">
            <p className="text-xs font-semibold">{project.title}</p>
            <p className="mt-0.5 text-[10px] text-[#7c828c]">
              {nodes.length}/50 nodes ·{' '}
              {new Set(project.nodes.map((entry) => entry.pass)).size}/4 passes
            </p>
            <p className="mt-1 text-xs text-[#aaa]">
              {mode === 'mouse'
                ? 'Wheel: zoom · Drag: pan'
                : 'Two fingers: pan · Pinch: zoom'}
              <br />
              Shift + drag: select · Space + drag: pan
            </p>
            {connectionError && (
              <output className="mt-2 block text-xs text-[#ffb15f]">
                {connectionError}
              </output>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const nodeTypes = { matchbox: MatchboxNode };

function MatchboxNode({ data, selected }: NodeProps) {
  const { projectNode, definition } = data as MatchboxNodeData;
  return (
    <div
      className={`min-w-40 rounded-lg border bg-[#1c1f24] shadow-lg ${selected ? 'border-[#ff7a1a] shadow-[0_0_0_2px_rgb(255_122_26/15%)]' : 'border-[#3a3e46]'}`}
    >
      <div className="flex items-center justify-between border-b border-[#343840] px-3 py-2">
        <span className="text-xs font-semibold">{definition.label.en}</span>
        <span className="rounded bg-[#292c32] px-1.5 py-0.5 text-[8px] uppercase text-[#8d929c]">
          P{projectNode.pass}
        </span>
      </div>
      <div className="relative min-h-10 px-3 py-2">
        {definition.inputs.map((input) => (
          <div
            key={input.id}
            className="relative flex h-5 items-center text-[9px] text-[#8d929c]"
          >
            <Handle
              id={input.id}
              type="target"
              position={Position.Left}
              className="-left-[17px]! size-2.5! border-[#17191d]! bg-[#74b9d4]!"
              style={{ top: '50%' }}
              title={`${input.id} input · ${input.type}`}
            />
            {input.id}
          </div>
        ))}
        {definition.outputs.map((output) => (
          <div
            key={output.id}
            className="relative flex h-5 items-center justify-end text-[9px] text-[#8d929c]"
          >
            {output.id}
            <Handle
              id={output.id}
              type="source"
              position={Position.Right}
              className="-right-[17px]! size-2.5! border-[#17191d]! bg-[#ff8a3d]!"
              style={{ top: '50%' }}
              title={`${output.id} output · ${output.type}`}
            />
          </div>
        ))}
        {!definition.inputs.length && !definition.outputs.length && (
          <span className="text-[9px] text-[#666c76]">No ports</span>
        )}
      </div>
    </div>
  );
}
