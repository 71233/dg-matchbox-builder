import type { ProjectV1 } from './types';
import { NODE_BY_ID } from './catalog';

export interface TemplatePreset {
  id: string;
  title: { ja: string; en: string };
  description: { ja: string; en: string };
  category: ProjectV1['category'];
  accent: string;
  project: ProjectV1;
}

const stamp = new Date(0).toISOString();
const defaults: Record<string, Record<string, number>> = {
  exposure: { stops: 0.65 },
  contrast: { contrast: 1.15, pivot: 0.45 },
  saturation: { amount: 1.12 },
  blur: { radius: 6 },
  'transform-2d': { scale: 1, rotation: 2 },
  pixelate: { size: 14 },
  gradient: { angle: 35 },
  noise: { scale: 7 },
  mix: { mix: 0.5 },
  'luma-key': { threshold: 0.5 },
};

const makeProject = (
  id: string,
  title: string,
  category: ProjectV1['category'],
  chain: string[],
): ProjectV1 => ({
  schemaVersion: 1,
  generatorVersion: '0.1.0',
  id: `template-${id}`,
  title,
  description: '',
  category,
  target: 'flame-2025.1+',
  locale: 'en',
  nodes: chain.map((definitionId, index) => ({
    id: `${definitionId}-${index}`,
    definitionId,
    position: { x: 80 + index * 220, y: 120 + (index % 2) * 35 },
    pass: 1,
    parameters: defaults[definitionId] ?? {},
  })),
  edges: chain.slice(0, -1).map((_, index) => ({
    id: `edge-${index}`,
    source: `${chain[index]}-${index}`,
    sourceHandle: NODE_BY_ID.get(chain[index])?.outputs[0]?.id ?? 'image',
    target: `${chain[index + 1]}-${index + 1}`,
    targetHandle: NODE_BY_ID.get(chain[index + 1])?.inputs[0]?.id ?? 'image',
  })),
  exposedParameters: [],
  createdAt: stamp,
  updatedAt: stamp,
});

export const TEMPLATES: TemplatePreset[] = [
  {
    id: 'color',
    title: { ja: 'カラー調整', en: 'Color Grade' },
    description: {
      ja: '露出、コントラスト、彩度を整える',
      en: 'Shape exposure, contrast and saturation',
    },
    category: 'color',
    accent: '#ff8a3d',
    project: makeProject('color', 'Warm Editorial Grade', 'color', [
      'front',
      'exposure',
      'contrast',
      'saturation',
      'output',
    ]),
  },
  {
    id: 'matte',
    title: { ja: 'マット処理', en: 'Matte Tools' },
    description: {
      ja: 'ルマキーとエッジを素早く調整',
      en: 'Build and refine a luminance matte',
    },
    category: 'matte',
    accent: '#e9d5ff',
    project: makeProject('matte', 'Soft Luma Matte', 'matte', [
      'front',
      'luma-key',
      'output',
    ]),
  },
  {
    id: 'blur',
    title: { ja: 'ブラー / シャープ', en: 'Blur / Sharpen' },
    description: {
      ja: '安全な固定カーネルでぼかす',
      en: 'Use a bounded production-safe kernel',
    },
    category: 'matte',
    accent: '#7dd3fc',
    project: makeProject('blur', 'Soft Focus', 'matte', [
      'front',
      'blur',
      'output',
    ]),
  },
  {
    id: 'composite',
    title: { ja: '合成', en: 'Composite' },
    description: {
      ja: 'FrontとBackを自然に合成',
      en: 'Combine Front and Back predictably',
    },
    category: 'composite',
    accent: '#86efac',
    project: (() => {
      const project = makeProject('composite', 'Clean Composite', 'composite', [
        'front',
        'mix',
        'output',
      ]);
      project.nodes.splice(1, 0, {
        id: 'back-extra',
        definitionId: 'back',
        position: { x: 80, y: 300 },
        pass: 1,
        parameters: {},
      });
      project.edges = [
        {
          id: 'edge-a',
          source: 'front-0',
          sourceHandle: 'image',
          target: 'mix-1',
          targetHandle: 'a',
        },
        {
          id: 'edge-b',
          source: 'back-extra',
          sourceHandle: 'image',
          target: 'mix-1',
          targetHandle: 'b',
        },
        {
          id: 'edge-out',
          source: 'mix-1',
          sourceHandle: 'image',
          target: 'output-2',
          targetHandle: 'image',
        },
      ];
      return project;
    })(),
  },
  {
    id: 'distort',
    title: { ja: 'ディストーション', en: 'Distortion' },
    description: {
      ja: '変形とピクセル処理を組み合わせる',
      en: 'Combine transforms and pixel shaping',
    },
    category: 'transform',
    accent: '#fda4af',
    project: makeProject('distort', 'Digital Warp', 'transform', [
      'front',
      'transform-2d',
      'pixelate',
      'output',
    ]),
  },
  {
    id: 'generator',
    title: { ja: 'ジェネレーター', en: 'Generator' },
    description: {
      ja: '入力不要のルックを作る',
      en: 'Create an input-free procedural look',
    },
    category: 'generator',
    accent: '#fde68a',
    project: makeProject('generator', 'Signal Gradient', 'generator', [
      'gradient',
      'output',
    ]),
  },
];
