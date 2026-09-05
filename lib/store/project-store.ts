'use client';

import { create } from 'zustand';
import type { Connection, EdgeChange, NodeChange } from '@xyflow/react';
import { TEMPLATES } from '@/lib/matchbox/templates';
import { instantiateProject } from '@/lib/matchbox/project';
import type {
  ExposedParameter,
  Locale,
  ProjectEdge,
  ProjectV1,
} from '@/lib/matchbox/types';
import { NODE_BY_ID } from '@/lib/matchbox/catalog';

interface ProjectStore {
  past: ProjectV1[];
  future: ProjectV1[];
  editing: boolean;
  editStart?: ProjectV1;
  beginEdit: () => void;
  endEdit: () => void;
  undo: () => void;
  redo: () => void;
  selectedEdgeIds: string[];
  selectedNodeIds: string[];
  connectionError?: string;
  connect: (connection: Connection, replacingId?: string) => void;
  project: ProjectV1;
  locale: Locale;
  selectedNodeId?: string;
  chooseTemplate: (templateId: string) => void;
  setProject: (project: ProjectV1) => void;
  setLocale: (locale: Locale) => void;
  selectNode: (id?: string) => void;
  addNode: (definitionId: string) => void;
  updateParameter: (
    nodeId: string,
    parameterId: string,
    value: number | boolean | string,
  ) => void;
  setNodePass: (nodeId: string, pass: number) => void;
  toggleExposed: (nodeId: string, parameterId: string) => void;
  updateExposedParameter: (
    id: string,
    patch: Partial<Omit<ExposedParameter, 'id' | 'nodeId' | 'parameterId'>>,
  ) => void;
  updateMetadata: (
    patch: Partial<Pick<ProjectV1, 'title' | 'description' | 'category'>>,
  ) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
}

const initial = instantiateProject(TEMPLATES[0].project);
export const useProjectStore = create<ProjectStore>((rawSet, get) => {
  const set: typeof rawSet = (update) => {
    const before = get();
    const patch = typeof update === 'function' ? update(before) : update;
    if (patch.project && patch.project !== before.project && !before.editing) {
      rawSet({
        ...patch,
        past: [...before.past, before.project].slice(-100),
        future: [],
      });
    } else rawSet(patch);
  };
  return {
    past: [],
    future: [],
    editing: false,
    selectedEdgeIds: [],
    selectedNodeIds: [],
    beginEdit: () => {
      if (!get().editing) rawSet({ editing: true, editStart: get().project });
    },
    endEdit: () => {
      const s = get();
      rawSet({
        editing: false,
        editStart: undefined,
        ...(s.editStart && s.editStart !== s.project
          ? { past: [...s.past, s.editStart].slice(-100), future: [] }
          : {}),
      });
    },
    undo: () => {
      const s = get();
      const project = s.past.at(-1);
      if (project)
        rawSet({
          project,
          past: s.past.slice(0, -1),
          future: [s.project, ...s.future],
          selectedEdgeIds: [],
        });
    },
    redo: () => {
      const s = get();
      const project = s.future[0];
      if (project)
        rawSet({
          project,
          past: [...s.past, s.project],
          future: s.future.slice(1),
          selectedEdgeIds: [],
        });
    },
    project: initial,
    locale: 'en',
    chooseTemplate: (templateId) => {
      const template =
        TEMPLATES.find((entry) => entry.id === templateId) ?? TEMPLATES[0];
      rawSet({
        project: instantiateProject(template.project, 'en'),
        selectedNodeId: undefined,
        selectedEdgeIds: [],
        selectedNodeIds: [],
        past: [],
        future: [],
        editing: false,
        editStart: undefined,
      });
    },
    setProject: (project) =>
      rawSet({
        project: englishProject(project),
        past: [],
        future: [],
        selectedNodeId: undefined,
        selectedNodeIds: [],
        selectedEdgeIds: [],
        editing: false,
        editStart: undefined,
      }),
    setLocale: () =>
      set({ locale: 'en', project: { ...get().project, locale: 'en' } }),
    selectNode: (selectedNodeId) =>
      set({
        selectedNodeId,
        selectedNodeIds: selectedNodeId ? [selectedNodeId] : [],
      }),
    addNode: (definitionId) =>
      set(({ project }) => {
        if (project.nodes.length >= 50) return { project };
        const id = `${definitionId}-${crypto.randomUUID().slice(0, 8)}`;
        return {
          project: {
            ...project,
            nodes: [
              ...project.nodes,
              {
                id,
                definitionId,
                position: {
                  x: 260 + project.nodes.length * 24,
                  y: 120 + project.nodes.length * 18,
                },
                pass: 1,
                parameters: {},
              },
            ],
            updatedAt: new Date().toISOString(),
          },
          selectedNodeId: id,
          selectedNodeIds: [id],
        };
      }),
    updateParameter: (nodeId, parameterId, value) =>
      set(({ project }) => ({
        project: {
          ...project,
          updatedAt: new Date().toISOString(),
          nodes: project.nodes.map((entry) =>
            entry.id === nodeId
              ? {
                  ...entry,
                  parameters: { ...entry.parameters, [parameterId]: value },
                }
              : entry,
          ),
        },
      })),
    setNodePass: (nodeId, pass) =>
      set(({ project }) => ({
        project: {
          ...project,
          updatedAt: new Date().toISOString(),
          nodes: project.nodes.map((entry) =>
            entry.id === nodeId
              ? { ...entry, pass: Math.max(1, Math.min(4, Math.round(pass))) }
              : entry,
          ),
        },
      })),
    toggleExposed: (nodeId, parameterId) =>
      set(({ project }) => {
        const existing = project.exposedParameters.find(
          (entry) =>
            entry.nodeId === nodeId && entry.parameterId === parameterId,
        );
        if (existing)
          return {
            project: {
              ...project,
              exposedParameters: project.exposedParameters.filter(
                (entry) => entry !== existing,
              ),
              updatedAt: new Date().toISOString(),
            },
          };
        const projectNode = project.nodes.find((entry) => entry.id === nodeId);
        const parameter =
          projectNode &&
          NODE_BY_ID.get(projectNode.definitionId)?.parameters.find(
            (entry) => entry.id === parameterId,
          );
        if (!projectNode || !parameter) return { project };
        const index = project.exposedParameters.length;
        return {
          project: {
            ...project,
            exposedParameters: [
              ...project.exposedParameters,
              {
                id: `${nodeId}:${parameterId}`,
                nodeId,
                parameterId,
                displayName: parameter.label.en,
                tooltip: parameter.tooltip.en,
                page: Math.floor(index / 30),
                column: Math.floor((index % 30) / 5),
                row: index % 5,
                min: parameter.min,
                max: parameter.max,
                step: parameter.step,
              },
            ],
            updatedAt: new Date().toISOString(),
          },
        };
      }),
    updateExposedParameter: (id, patch) =>
      set(({ project }) => ({
        project: {
          ...project,
          exposedParameters: project.exposedParameters.map((entry) =>
            entry.id === id ? { ...entry, ...patch } : entry,
          ),
          updatedAt: new Date().toISOString(),
        },
      })),
    updateMetadata: (patch) =>
      set(({ project }) => ({
        project: { ...project, ...patch, updatedAt: new Date().toISOString() },
      })),
    onNodesChange: (changes) =>
      set(({ project }) => {
        let nodes = project.nodes;
        let selectedNodeIds = get().selectedNodeIds;
        for (const change of changes) {
          if (change.type === 'position' && change.position)
            nodes = nodes.map((entry) =>
              entry.id === change.id
                ? { ...entry, position: change.position! }
                : entry,
            );
          if (change.type === 'remove')
            nodes = nodes.filter((entry) => entry.id !== change.id);
          if (change.type === 'select') {
            selectedNodeIds = change.selected
              ? [...new Set([...selectedNodeIds, change.id])]
              : selectedNodeIds.filter((id) => id !== change.id);
          }
        }
        return {
          selectedNodeIds: selectedNodeIds.filter((id) =>
            nodes.some((n) => n.id === id),
          ),
          selectedNodeId: selectedNodeIds
            .filter((id) => nodes.some((n) => n.id === id))
            .at(-1),
          project:
            nodes === project.nodes
              ? project
              : {
                  ...project,
                  nodes,
                  edges: project.edges.filter(
                    (e) =>
                      nodes.some((n) => n.id === e.source) &&
                      nodes.some((n) => n.id === e.target),
                  ),
                  exposedParameters: project.exposedParameters.filter((e) =>
                    nodes.some((n) => n.id === e.nodeId),
                  ),
                  updatedAt: new Date().toISOString(),
                },
        };
      }),
    onEdgesChange: (changes) =>
      set(({ project }) => {
        let edges = project.edges;
        let selectedEdgeIds = get().selectedEdgeIds;
        for (const change of changes)
          if (change.type === 'remove')
            edges = edges.filter((entry) => entry.id !== change.id);
          else if (change.type === 'select')
            selectedEdgeIds = change.selected
              ? [...new Set([...selectedEdgeIds, change.id])]
              : selectedEdgeIds.filter((id) => id !== change.id);
        return {
          selectedEdgeIds: selectedEdgeIds.filter((id) =>
            edges.some((e) => e.id === id),
          ),
          project:
            edges === project.edges
              ? project
              : { ...project, edges, updatedAt: new Date().toISOString() },
        };
      }),
    onConnect: (connection) => get().connect(connection),
    connect: (connection, replacingId) => {
      const project = get().project;
      const error = connectionProblem(project, connection, replacingId);
      if (error) {
        rawSet({ connectionError: error });
        return;
      }
      const edges = project.edges.filter(
        (e) =>
          e.id !== replacingId &&
          !(
            e.target === connection.target &&
            e.targetHandle === connection.targetHandle
          ),
      );
      edges.push({
        ...connection,
        id: replacingId ?? `edge-${crypto.randomUUID()}`,
      } as ProjectEdge);
      set({
        project: { ...project, edges, updatedAt: new Date().toISOString() },
        connectionError: undefined,
      });
    },
  };
});

export function englishProject(project: ProjectV1): ProjectV1 {
  return {
    ...project,
    locale: 'en',
    exposedParameters: project.exposedParameters.map((e) => {
      const node = project.nodes.find((n) => n.id === e.nodeId);
      const p =
        node &&
        NODE_BY_ID.get(node.definitionId)?.parameters.find(
          (p) => p.id === e.parameterId,
        );
      return p
        ? {
            ...e,
            displayName:
              e.displayName === p.label.ja ? p.label.en : e.displayName,
            tooltip: e.tooltip === p.tooltip.ja ? p.tooltip.en : e.tooltip,
          }
        : e;
    }),
  };
}

export function connectionProblem(
  project: ProjectV1,
  c: Connection,
  replacingId?: string,
): string | undefined {
  const source = project.nodes.find((n) => n.id === c.source);
  const target = project.nodes.find((n) => n.id === c.target);
  const output =
    source &&
    NODE_BY_ID.get(source.definitionId)?.outputs.find(
      (p) => p.id === c.sourceHandle,
    );
  const input =
    target &&
    NODE_BY_ID.get(target.definitionId)?.inputs.find(
      (p) => p.id === c.targetHandle,
    );
  if (!source || !target || !output || !input)
    return 'Choose an output and an input socket.';
  if (
    output.type !== input.type &&
    !(output.type === 'matte' && input.type === 'image')
  )
    return 'These socket types are not compatible.';
  if (source.pass > target.pass)
    return 'Connections cannot go to an earlier render pass.';
  const edges = project.edges.filter(
    (e) =>
      e.id !== replacingId &&
      !(e.target === c.target && e.targetHandle === c.targetHandle),
  );
  const visited = new Set<string>();
  const reaches = (id: string): boolean => {
    if (id === source.id) return true;
    if (visited.has(id)) return false;
    visited.add(id);
    return edges.filter((e) => e.source === id).some((e) => reaches(e.target));
  };
  if (reaches(target.id)) return 'This connection would create a cycle.';
}
