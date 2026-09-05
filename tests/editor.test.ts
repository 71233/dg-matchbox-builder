import { beforeEach, expect, test } from 'vitest';
import {
  useProjectStore as store,
  connectionProblem,
  englishProject,
} from '../lib/store/project-store';
import { NODE_BY_ID } from '../lib/matchbox/catalog';
import { instantiateProject } from '../lib/matchbox/project';
import { TEMPLATES } from '../lib/matchbox/templates';

beforeEach(() =>
  store.getState().setProject(instantiateProject(TEMPLATES[0].project)),
);
const state = () => store.getState();

test('occupied inputs are replaced atomically and undo restores the old edge', () => {
  const p = state().project;
  const edge = p.edges.at(-1)!;
  const front = p.nodes.find((n) => n.definitionId === 'front')!;
  state().connect({ ...edge, source: front.id });
  expect(state().project.edges).toHaveLength(p.edges.length);
  expect(state().project.edges.at(-1)?.source).toBe(front.id);
  state().undo();
  expect(state().project).toEqual(p);
  state().redo();
  expect(state().project.edges.at(-1)?.source).toBe(front.id);
});

test('invalid connections leave the entire project and history intact', () => {
  const p = state().project;
  const n = p.nodes.find((n) => n.definitionId === 'exposure')!;
  state().connect({
    source: n.id,
    target: n.id,
    sourceHandle: 'image',
    targetHandle: 'image',
  });
  expect(state().project).toBe(p);
  expect(state().connectionError).toMatch(/cycle/);
  expect(state().past).toHaveLength(0);
  state().addNode('time');
  const time = state().project.nodes.at(-1)!;
  const outputPort = NODE_BY_ID.get('time')!.outputs[0].id;
  expect(
    connectionProblem(state().project, {
      source: time.id,
      target: n.id,
      sourceHandle: outputPort,
      targetHandle: 'image',
    }),
  ).toMatch(/types/);
});

test('later passes cannot connect to earlier passes', () => {
  const p = structuredClone(state().project);
  const edge = p.edges[0];
  p.nodes.find((n) => n.id === edge.source)!.pass = 2;
  expect(connectionProblem(p, edge)).toMatch(/earlier/);
});

test('node removal includes edges and exposed controls in a single undo', () => {
  const p = state().project;
  const n = p.nodes.find((n) => n.definitionId === 'exposure')!;
  state().onNodesChange([{ type: 'remove', id: n.id }]);
  expect(
    state().project.edges.some((e) => e.source === n.id || e.target === n.id),
  ).toBe(false);
  expect(state().project.exposedParameters.some((e) => e.nodeId === n.id)).toBe(
    false,
  );
  state().undo();
  expect(state().project).toEqual(p);
});

test('edge selection is transient, disconnection is undoable', () => {
  const p = state().project;
  const id = p.edges[0].id;
  state().onEdgesChange([{ type: 'select', id, selected: true }]);
  expect(state().selectedEdgeIds).toEqual([id]);
  expect(state().past).toHaveLength(0);
  state().onEdgesChange([{ type: 'remove', id }]);
  state().undo();
  expect(state().project.edges).toEqual(p.edges);
});

test('slider gestures and graph moves form one undo step', () => {
  const p = state().project;
  const id = p.nodes.find((n) => n.definitionId === 'exposure')!.id;
  state().beginEdit();
  for (let v = 1; v <= 4; v++) state().updateParameter(id, 'stops', v);
  state().endEdit();
  expect(state().past).toHaveLength(1);
  state().undo();
  expect(state().project).toEqual(p);
  state().beginEdit();
  for (let x = 1; x <= 4; x++)
    state().onNodesChange([{ type: 'position', id, position: { x, y: 10 } }]);
  state().endEdit();
  expect(state().past).toHaveLength(1);
});

test('history is limited to 100 edits and new edits discard redo', () => {
  for (let i = 0; i < 110; i++) state().updateMetadata({ title: `Edit ${i}` });
  expect(state().past).toHaveLength(100);
  state().undo();
  state().updateMetadata({ title: 'New edit' });
  expect(state().future).toHaveLength(0);
  state().chooseTemplate('color');
  expect(state().past).toHaveLength(0);
});

test('old default Japanese labels migrate but custom text survives', () => {
  const p = instantiateProject(TEMPLATES[0].project, 'ja');
  p.title = '作品名';
  p.exposedParameters[0].displayName = 'カスタム';
  const migrated = englishProject(p);
  expect(migrated.locale).toBe('en');
  expect(migrated.title).toBe('作品名');
  expect(migrated.exposedParameters[0].displayName).toBe('カスタム');
  expect(migrated.exposedParameters[1].displayName).not.toMatch(
    /[ぁ-んァ-ン一-龥]/,
  );
  expect(migrated.exposedParameters[0].tooltip).not.toMatch(
    /[ぁ-んァ-ン一-龥]/,
  );
  expect(englishProject(migrated)).toEqual(migrated);
});
