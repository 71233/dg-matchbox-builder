import type { NodeDefinition, NodeCategory, PortType } from './types';

const node = (definition: NodeDefinition) => definition;
const io = (
  id: string,
  ja: string,
  en: string,
  output?: PortType,
  input?: PortType,
) =>
  node({
    id,
    version: 1,
    category: 'io',
    label: { ja, en },
    description: { ja: `${ja}ノードです。`, en: `${en} node.` },
    inputs: input ? [{ id: 'image', type: input, required: true }] : [],
    outputs: output ? [{ id: output, type: output }] : [],
    parameters: [],
    cost: 'low',
  });
const simpleImage = (
  id: string,
  category: NodeCategory,
  ja: string,
  en: string,
  parameters: NodeDefinition['parameters'] = [],
  cost: NodeDefinition['cost'] = 'low',
) =>
  node({
    id,
    version: 1,
    category,
    label: { ja, en },
    description: {
      ja: `${ja}を適用します。`,
      en: `Applies ${en.toLowerCase()}.`,
    },
    inputs: [{ id: 'image', type: 'image', required: true }],
    outputs: [{ id: 'image', type: 'image' }],
    parameters,
    cost,
  });
const floatParam = (
  id: string,
  ja: string,
  en: string,
  defaultValue: number,
  min: number,
  max: number,
  step: number,
) => ({
  id,
  label: { ja, en },
  tooltip: { ja: `${ja}を調整します。`, en: `Adjusts ${en.toLowerCase()}.` },
  kind: 'float' as const,
  defaultValue,
  min,
  max,
  step,
});

export const NODE_CATALOG: NodeDefinition[] = [
  io('front', 'Front入力', 'Front Input', 'image'),
  io('back', 'Back入力', 'Back Input', 'image'),
  io('matte-input', 'Matte入力', 'Matte Input', 'matte'),
  io('time', '時間', 'Time', 'time'),
  io('output', '出力', 'Output', undefined, 'image'),
  simpleImage('exposure', 'color', '露出', 'Exposure', [
    floatParam('stops', '露出', 'Exposure', 0, -5, 5, 0.05),
  ]),
  simpleImage('contrast', 'color', 'コントラスト', 'Contrast / Pivot', [
    floatParam('contrast', 'コントラスト', 'Contrast', 1, 0, 3, 0.01),
    floatParam('pivot', 'ピボット', 'Pivot', 0.5, 0, 1, 0.01),
  ]),
  simpleImage('saturation', 'color', '彩度', 'Saturation', [
    floatParam('amount', '彩度', 'Saturation', 1, 0, 2, 0.01),
  ]),
  simpleImage('hue', 'color', '色相', 'Hue Rotate', [
    floatParam('degrees', '角度', 'Degrees', 0, -180, 180, 1),
  ]),
  simpleImage(
    'lift-gamma-gain',
    'color',
    'Lift / Gamma / Gain',
    'Lift / Gamma / Gain',
    [
      floatParam('lift', 'Lift', 'Lift', 0, -1, 1, 0.01),
      floatParam('gamma', 'Gamma', 'Gamma', 1, 0.1, 4, 0.01),
      floatParam('gain', 'Gain', 'Gain', 1, 0, 4, 0.01),
    ],
  ),
  simpleImage('channel-mixer', 'color', 'チャンネルミキサー', 'Channel Mixer', [
    floatParam('red', 'Red', 'Red', 1, -2, 2, 0.01),
    floatParam('green', 'Green', 'Green', 1, -2, 2, 0.01),
    floatParam('blue', 'Blue', 'Blue', 1, -2, 2, 0.01),
  ]),
  simpleImage('clamp', 'color', 'クランプ', 'Clamp', [
    floatParam('minimum', '最小', 'Minimum', 0, -1, 1, 0.01),
    floatParam('maximum', '最大', 'Maximum', 1, 0, 4, 0.01),
  ]),
  node({
    id: 'mix',
    version: 1,
    category: 'composite',
    label: { ja: 'ミックス', en: 'Mix' },
    description: { ja: '2枚の画像を混合します。', en: 'Blends two images.' },
    inputs: [
      { id: 'a', type: 'image', required: true },
      { id: 'b', type: 'image', required: true },
    ],
    outputs: [{ id: 'image', type: 'image' }],
    parameters: [floatParam('mix', 'ミックス', 'Mix', 0.5, 0, 1, 0.01)],
    cost: 'low',
  }),
  ...['over', 'add', 'multiply', 'screen'].map((id) =>
    node({
      id,
      version: 1,
      category: 'composite',
      label: { ja: id.toUpperCase(), en: id[0].toUpperCase() + id.slice(1) },
      description: {
        ja: `${id}方式で合成します。`,
        en: `Composites using ${id} mode.`,
      },
      inputs: [
        { id: 'a', type: 'image', required: true },
        { id: 'b', type: 'image', required: true },
      ],
      outputs: [{ id: 'image', type: 'image' }],
      parameters: [],
      cost: 'low',
    }),
  ),
  node({
    id: 'luma-key',
    version: 1,
    category: 'matte',
    label: { ja: 'ルマキー', en: 'Luma Key' },
    description: {
      ja: '輝度からマットを作ります。',
      en: 'Builds a matte from luminance.',
    },
    inputs: [{ id: 'image', type: 'image', required: true }],
    outputs: [{ id: 'matte', type: 'matte' }],
    parameters: [
      floatParam('threshold', 'しきい値', 'Threshold', 0.5, 0, 1, 0.01),
    ],
    cost: 'low',
  }),
  simpleImage(
    'blur',
    'matte',
    'ブラー',
    'Blur',
    [floatParam('radius', '半径', 'Radius', 4, 0, 32, 0.5)],
    'high',
  ),
  node({
    id: 'erode-dilate',
    version: 1,
    category: 'matte',
    label: { ja: '収縮 / 拡張', en: 'Erode / Dilate' },
    description: {
      ja: 'マットの輪郭を調整します。',
      en: 'Refines matte edges.',
    },
    inputs: [{ id: 'matte', type: 'matte', required: true }],
    outputs: [{ id: 'matte', type: 'matte' }],
    parameters: [floatParam('amount', '量', 'Amount', 0, -20, 20, 0.5)],
    cost: 'high',
  }),
  simpleImage('premultiply', 'matte', 'プリマルチ', 'Premultiply', [
    {
      id: 'unpremultiply',
      label: { ja: 'アンプリマルチ', en: 'Unpremultiply' },
      tooltip: {
        ja: 'ゼロ除算を保護して解除します。',
        en: 'Unpremultiplies with zero protection.',
      },
      kind: 'boolean',
      defaultValue: false,
    },
  ]),
  simpleImage('transform-2d', 'transform', '2D変形', 'Transform 2D', [
    floatParam('scale', 'スケール', 'Scale', 1, 0.01, 8, 0.01),
    floatParam('rotation', '回転', 'Rotation', 0, -180, 180, 0.1),
  ]),
  simpleImage('pixelate', 'transform', 'ピクセレート', 'Pixelate', [
    floatParam('size', 'サイズ', 'Size', 8, 1, 128, 1),
  ]),
  node({
    id: 'displace',
    version: 1,
    category: 'transform',
    label: { ja: 'ディスプレイス', en: 'Displace' },
    description: {
      ja: 'マットで画像を変形します。',
      en: 'Displaces an image with a matte.',
    },
    inputs: [
      { id: 'image', type: 'image', required: true },
      { id: 'matte', type: 'matte', required: true },
    ],
    outputs: [{ id: 'image', type: 'image' }],
    parameters: [floatParam('amount', '量', 'Amount', 12, -100, 100, 0.5)],
    cost: 'medium',
  }),
  node({
    id: 'solid',
    version: 1,
    category: 'generator',
    label: { ja: '単色', en: 'Solid' },
    description: {
      ja: '単色画像を生成します。',
      en: 'Generates a solid color.',
    },
    inputs: [],
    outputs: [{ id: 'image', type: 'image' }],
    parameters: [
      {
        id: 'color',
        label: { ja: '色', en: 'Color' },
        tooltip: { ja: '生成色です。', en: 'Generated color.' },
        kind: 'color',
        defaultValue: '#ff7a1a',
      },
    ],
    cost: 'low',
  }),
  node({
    id: 'gradient',
    version: 1,
    category: 'generator',
    label: { ja: 'グラデーション', en: 'Gradient' },
    description: {
      ja: '線形グラデーションを生成します。',
      en: 'Generates a linear gradient.',
    },
    inputs: [],
    outputs: [{ id: 'image', type: 'image' }],
    parameters: [floatParam('angle', '角度', 'Angle', 45, -180, 180, 1)],
    cost: 'low',
  }),
  node({
    id: 'noise',
    version: 1,
    category: 'generator',
    label: { ja: 'ノイズ', en: 'Noise' },
    description: {
      ja: '再現可能なノイズです。',
      en: 'Generates deterministic noise.',
    },
    inputs: [{ id: 'time', type: 'time' }],
    outputs: [{ id: 'image', type: 'image' }],
    parameters: [floatParam('scale', 'スケール', 'Scale', 6, 0.1, 64, 0.1)],
    cost: 'medium',
  }),
];

export const NODE_BY_ID = new Map(
  NODE_CATALOG.map((entry) => [entry.id, entry]),
);
