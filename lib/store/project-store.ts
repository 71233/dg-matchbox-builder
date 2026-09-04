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
  project: ProjectV1;
  locale: Locale;
  selectedNodeId?: string;
  graphOpen: boolean;
  chooseTemplate: (templateId: string) => void;
  setProject: (project: ProjectV1) => void;
  setLocale: (locale: Locale) => void;
  selectNode: (id?: string) => void;
  setGraphOpen: (open: boolean) => void;
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
export const useProjectStore = create<ProjectStore>((set, get) => ({
  project: initial,
  locale: 'en',
  graphOpen: false,
  chooseTemplate: (templateId) => {
    const template =
      TEMPLATES.find((entry) => entry.id === templateId) ?? TEMPLATES[0];
    set({
      project: instantiateProject(template.project, 'en'),
      selectedNodeId: undefined,
    });
  },
  setProject: (project) => set({ project }),
  setLocale: () =>
    set({ locale: 'en', project: { ...get().project, locale: 'en' } }),
  selectNode: (selectedNodeId) => set({ selectedNodeId }),
  setGraphOpen: (graphOpen) => set({ graphOpen }),
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
        (entry) => entry.nodeId === nodeId && entry.parameterId === parameterId,
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
      for (const change of changes) {
        if (change.type === 'position' && change.position)
          nodes = nodes.map((entry) =>
            entry.id === change.id
              ? { ...entry, position: change.position! }
              : entry,
          );
        if (change.type === 'remove')
          nodes = nodes.filter((entry) => entry.id !== change.id);
        if (change.type === 'select' && change.selected)
          set({ selectedNodeId: change.id });
      }
      return {
        project: { ...project, nodes, updatedAt: new Date().toISOString() },
      };
    }),
  onEdgesChange: (changes) =>
    set(({ project }) => {
      let edges = project.edges;
      for (const change of changes)
        if (change.type === 'remove')
          edges = edges.filter((entry) => entry.id !== change.id);
      return {
        project: { ...project, edges, updatedAt: new Date().toISOString() },
      };
    }),
  onConnect: (connection) =>
    set(({ project }) => ({
      project: {
        ...project,
        edges: [
          ...project.edges,
          {
            id: `edge-${crypto.randomUUID()}`,
            source: connection.source,
            sourceHandle: connection.sourceHandle ?? 'image',
            target: connection.target,
            targetHandle: connection.targetHandle ?? 'image',
          } as ProjectEdge,
        ],
        updatedAt: new Date().toISOString(),
      },
    })),
}));
