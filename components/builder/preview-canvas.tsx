'use client';
/* oxlint-disable react/react-compiler */

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  AlertTriangle,
  GripVertical,
  ImagePlus,
  Pause,
  Play,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { generateShader } from '@/lib/matchbox/generator';
import type { ProjectV1 } from '@/lib/matchbox/types';

export interface PreviewCanvasHandle {
  thumbnail: () => Promise<Blob | null>;
}

interface PreviewCanvasProps {
  project: ProjectV1;
  onCompileState?: (state: 'passed' | 'failed' | 'unavailable') => void;
}

const VERTEX = `#version 300 es
in vec2 position;
void main(){ gl_Position=vec4(position,0.0,1.0); }`;
type TestPattern = 'gradient' | 'black' | 'white' | 'bars' | 'transparent';

export const PreviewCanvas = forwardRef<
  PreviewCanvasHandle,
  PreviewCanvasProps
>(function PreviewCanvas({ project, onCompileState }, ref) {
  const previewRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const frameRef = useRef<number | null>(null);
  const startRef = useRef(performance.now());
  const [playing, setPlaying] = useState(false);
  const [wipe, setWipe] = useState(0.5);
  const [dragging, setDragging] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pattern, setPattern] = useState<TestPattern>('gradient');
  const [error, setError] = useState<string>();

  useImperativeHandle(
    ref,
    () => ({
      thumbnail: () => {
        const source = canvasRef.current;
        if (!source) return Promise.resolve(null);
        const thumbnail = document.createElement('canvas');
        thumbnail.width = 126;
        thumbnail.height = 92;
        thumbnail
          .getContext('2d')
          ?.drawImage(source, 0, 0, thumbnail.width, thumbnail.height);
        return new Promise((resolve) => thumbnail.toBlob(resolve, 'image/png'));
      },
    }),
    [],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      antialias: false,
      preserveDrawingBuffer: true,
    });
    if (!gl) {
      setError('WebGL 2 is unavailable. Export remains available.');
      onCompileState?.('unavailable');
      return;
    }
    const generated = generateShader(project);
    try {
      const program = createProgram(gl, VERTEX, generated.webgl);
      const position = gl.getAttribLocation(program, 'position');
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, 3, -1, -1, 3]),
        gl.STATIC_DRAW,
      );
      gl.useProgram(program);
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      const textures = [
        createPatternTexture(gl, imageRef.current, 0, pattern),
        createPatternTexture(gl, null, 1, 'gradient'),
        createMatteTexture(gl),
      ];
      ['frontTex', 'backTex', 'matteTex'].forEach((name, index) =>
        gl.uniform1i(gl.getUniformLocation(program, name), index),
      );
      for (const [name, value] of Object.entries(generated.uniformValues)) {
        const location = gl.getUniformLocation(program, name);
        if (!location) continue;
        if (Array.isArray(value)) gl.uniform3fv(location, value);
        else if (typeof value === 'boolean')
          gl.uniform1i(location, value ? 1 : 0);
        else gl.uniform1f(location, value);
      }
      const render = () => {
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
        const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
        if (canvas.width !== width || canvas.height !== height) {
          canvas.width = width;
          canvas.height = height;
        }
        gl.viewport(0, 0, width, height);
        gl.uniform2f(
          gl.getUniformLocation(program, 'u_resolution'),
          width,
          height,
        );
        gl.uniform1f(
          gl.getUniformLocation(program, 'u_time'),
          (performance.now() - startRef.current) / 1000,
        );
        gl.uniform1f(gl.getUniformLocation(program, 'u_wipe'), wipe);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        if (playing) frameRef.current = requestAnimationFrame(render);
      };
      render();
      setError(undefined);
      onCompileState?.('passed');
      return () => {
        if (frameRef.current) cancelAnimationFrame(frameRef.current);
        textures.forEach((texture) => gl.deleteTexture(texture));
        gl.deleteProgram(program);
        gl.deleteBuffer(buffer);
      };
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setError(message);
      onCompileState?.('failed');
    }
  }, [project, playing, wipe, pattern, onCompileState]);

  const loadImage = (file?: File) => {
    if (!file || !file.type.startsWith('image/')) return;
    const image = new Image();
    const url = URL.createObjectURL(file);
    image.onload = () => {
      imageRef.current = image;
      setPattern('gradient');
      setPlaying((value) => !value);
      setTimeout(() => setPlaying((value) => !value), 0);
      URL.revokeObjectURL(url);
    };
    image.src = url;
  };

  const updateWipeFromClientX = useCallback((clientX: number) => {
    const preview = previewRef.current;
    if (!preview) return;
    const bounds = preview.getBoundingClientRect();
    const nextWipe = (clientX - bounds.left) / bounds.width;
    setWipe(Math.min(1, Math.max(0, nextWipe)));
  }, []);

  return (
    <div
      ref={previewRef}
      className="checkerboard relative h-full min-h-[360px] overflow-hidden rounded-xl border border-[#31343b] shadow-2xl"
    >
      <canvas
        ref={canvasRef}
        className="h-full w-full transition-transform duration-200"
        style={{ transform: `scale(${zoom})` }}
        aria-label="Matchbox WebGL preview"
      />
      <button
        type="button"
        className={`group absolute inset-y-0 z-10 w-8 -translate-x-1/2 cursor-col-resize touch-none focus-visible:outline-none ${dragging ? 'cursor-grabbing' : ''}`}
        style={{ left: `${wipe * 100}%` }}
        aria-label="Move before after boundary"
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
          updateWipeFromClientX(event.clientX);
        }}
        onPointerMove={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
          updateWipeFromClientX(event.clientX);
        }}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          setDragging(false);
        }}
        onPointerCancel={() => setDragging(false)}
        onKeyDown={(event) => {
          const step = event.shiftKey ? 0.1 : 0.02;
          if (event.key === 'ArrowLeft') {
            event.preventDefault();
            setWipe((value) => Math.max(0, value - step));
          } else if (event.key === 'ArrowRight') {
            event.preventDefault();
            setWipe((value) => Math.min(1, value + step));
          } else if (event.key === 'Home') {
            event.preventDefault();
            setWipe(0);
          } else if (event.key === 'End') {
            event.preventDefault();
            setWipe(1);
          }
        }}
      >
        <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/90 shadow-[0_0_0_1px_rgb(0_0_0/60%)] transition-colors group-hover:bg-[#ffb15f] group-focus-visible:bg-[#ffb15f]" />
        <span className="absolute left-1/2 top-1/2 flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/25 bg-black/75 text-white/80 shadow-lg transition group-hover:border-[#ffb15f] group-hover:text-[#ffb15f] group-focus-visible:border-[#ffb15f] group-focus-visible:text-[#ffb15f]">
          <GripVertical className="size-4" aria-hidden="true" />
        </span>
      </button>
      <div className="absolute left-3 top-3 rounded bg-black/65 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/80">
        Before
      </div>
      <div className="absolute right-3 top-3 rounded bg-[#ff7a1a] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-black">
        After
      </div>
      {error && (
        <div className="absolute inset-x-6 top-1/2 flex -translate-y-1/2 items-center gap-2 rounded-lg border border-[#6f3f25] bg-[#271811]/95 p-3 text-xs text-[#ffb17c]">
          <AlertTriangle className="size-4 shrink-0" /> {error}
        </div>
      )}
      <div className="absolute bottom-3 left-1/2 z-20 flex w-[min(92%,520px)] -translate-x-1/2 items-center gap-3 rounded-lg border border-white/10 bg-black/75 p-2 backdrop-blur">
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => setPlaying((value) => !value)}
          aria-label={playing ? 'Pause preview' : 'Play preview'}
        >
          {playing ? <Pause /> : <Play />}
        </Button>
        <select
          value={pattern}
          onChange={(event) => {
            imageRef.current = null;
            setPattern(event.target.value as TestPattern);
          }}
          aria-label="Test input"
          className="h-7 rounded border border-white/15 bg-[#17191d] px-1 text-[10px] text-white/75"
        >
          <option value="gradient">Gradient</option>
          <option value="black">Black</option>
          <option value="white">White</option>
          <option value="bars">Color bars</option>
          <option value="transparent">Transparent</option>
        </select>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => setZoom((value) => Math.max(1, value - 0.25))}
          aria-label="Zoom out"
        >
          <ZoomOut />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => setZoom((value) => Math.min(3, value + 0.25))}
          aria-label="Zoom in"
        >
          <ZoomIn />
        </Button>
        <label className="cursor-pointer rounded px-2 py-1 text-[10px] text-white/70 hover:bg-white/10">
          <ImagePlus className="mr-1 inline size-3" />
          素材
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => loadImage(event.target.files?.[0])}
          />
        </label>
      </div>
    </div>
  );
});

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('Could not create a WebGL shader.');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const error = gl.getShaderInfoLog(shader) ?? 'Shader compilation failed.';
    gl.deleteShader(shader);
    throw new Error(error);
  }
  return shader;
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string,
) {
  const program = gl.createProgram();
  if (!program) throw new Error('Could not create a WebGL program.');
  const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const error = gl.getProgramInfoLog(program) ?? 'Shader link failed.';
    gl.deleteProgram(program);
    throw new Error(error);
  }
  return program;
}

function createPatternTexture(
  gl: WebGL2RenderingContext,
  image: HTMLImageElement | null,
  variant: number,
  pattern: TestPattern,
) {
  const texture = gl.createTexture();
  if (!texture) throw new Error('Could not create texture.');
  gl.activeTexture(gl.TEXTURE0 + variant);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  if (image)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  else {
    const size = 256;
    const pixels = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const i = (y * size + x) * 4;
        const band = Math.sin(x * 0.05 + y * 0.025) * 0.5 + 0.5;
        const bar = Math.min(6, Math.floor((x / size) * 7));
        const barColors = [
          [191, 191, 191],
          [191, 191, 0],
          [0, 191, 191],
          [0, 191, 0],
          [191, 0, 191],
          [191, 0, 0],
          [0, 0, 191],
        ];
        const rgb =
          pattern === 'black'
            ? [0, 0, 0]
            : pattern === 'white'
              ? [255, 255, 255]
              : pattern === 'bars'
                ? barColors[bar]
                : variant
                  ? [35 + x / 2, 55 + y / 2, 110]
                  : [35 + x * 0.75, 22 + y * 0.52, 40 + band * 150];
        pixels[i] = rgb[0];
        pixels[i + 1] = rgb[1];
        pixels[i + 2] = rgb[2];
        pixels[i + 3] =
          pattern === 'transparent' ? Math.round((x / size) * 255) : 255;
      }
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      size,
      size,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels,
    );
  }
  return texture;
}

function createMatteTexture(gl: WebGL2RenderingContext) {
  const texture = gl.createTexture();
  if (!texture) throw new Error('Could not create matte texture.');
  gl.activeTexture(gl.TEXTURE2);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  const size = 128;
  const pixels = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const d = Math.hypot(x - size / 2, y - size / 2) / (size / 2);
      const v = Math.max(0, Math.min(255, (1 - d) * 320));
      pixels[i] = pixels[i + 1] = pixels[i + 2] = pixels[i + 3] = v;
    }
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    size,
    size,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    pixels,
  );
  return texture;
}
