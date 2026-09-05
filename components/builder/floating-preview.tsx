import { useEffect, useRef, useState, type ReactNode } from 'react';

type Bounds = { x: number; y: number; width: number; height: number };
const initial: Bounds = { x: 100000, y: 72, width: 320, height: 260 };

export function FloatingPreview({
  floating,
  children,
}: {
  floating: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [bounds, setBounds] = useState<Bounds>(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem('dgmb-preview-window') ?? 'null',
      );
      if (
        saved &&
        ['x', 'y', 'width', 'height'].every((k) => Number.isFinite(saved[k]))
      )
        return saved;
    } catch {
      /* optional preference */
    }
    return initial;
  });
  const gesture = useRef<{
    x: number;
    y: number;
    bounds: Bounds;
    resize: boolean;
  } | null>(null);
  const clamp = (b: Bounds): Bounds => {
    const parent = ref.current?.parentElement;
    if (!parent) return b;
    const width = Math.min(parent.clientWidth, Math.max(280, b.width));
    const height = Math.min(parent.clientHeight, Math.max(220, b.height));
    return {
      width,
      height,
      x: Math.max(0, Math.min(b.x, parent.clientWidth - width)),
      y: Math.max(0, Math.min(b.y, parent.clientHeight - height)),
    };
  };
  useEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent) return;
    const observer = new ResizeObserver(() => setBounds((b) => clamp(b)));
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem('dgmb-preview-window', JSON.stringify(bounds));
    } catch {
      /* optional preference */
    }
  }, [bounds]);
  const keyboard = (event: React.KeyboardEvent, resize: boolean) => {
    const delta = event.shiftKey ? 40 : 10;
    const dx =
      event.key === 'ArrowLeft'
        ? -delta
        : event.key === 'ArrowRight'
          ? delta
          : 0;
    const dy =
      event.key === 'ArrowUp' ? -delta : event.key === 'ArrowDown' ? delta : 0;
    if (!dx && !dy) return;
    event.preventDefault();
    setBounds((b) =>
      clamp(
        resize
          ? { ...b, width: b.width + dx, height: b.height + dy }
          : { ...b, x: b.x + dx, y: b.y + dy },
      ),
    );
  };
  return (
    <div
      ref={ref}
      data-testid="preview-window"
      className="absolute z-20 flex min-h-0 flex-col overflow-hidden rounded-lg border border-[#484039] bg-[#15171b] shadow-xl"
      style={
        floating
          ? {
              left: bounds.x,
              top: bounds.y,
              width: bounds.width,
              height: bounds.height,
            }
          : { inset: 0 }
      }
    >
      <button
        hidden={!floating}
        aria-label="Move preview"
        className="shrink-0 cursor-move touch-none bg-[#29231f] px-3 py-2 text-left text-xs"
        onKeyDown={(e) => keyboard(e, false)}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          gesture.current = {
            x: e.clientX,
            y: e.clientY,
            bounds,
            resize: false,
          };
        }}
        onPointerMove={(e) => {
          const g = gesture.current;
          if (!g || g.resize) return;
          setBounds(
            clamp({
              ...g.bounds,
              x: g.bounds.x + e.clientX - g.x,
              y: g.bounds.y + e.clientY - g.y,
            }),
          );
        }}
        onPointerUp={() => {
          gesture.current = null;
        }}
        onPointerCancel={() => {
          gesture.current = null;
        }}
      >
        Preview · Drag to move
      </button>
      <div className="min-h-0 flex-1">{children}</div>
      <button
        hidden={!floating}
        aria-label="Resize preview"
        className="absolute bottom-0 right-0 z-30 size-5 cursor-nwse-resize touch-none bg-[#b8612a] text-xs"
        onKeyDown={(e) => keyboard(e, true)}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          gesture.current = {
            x: e.clientX,
            y: e.clientY,
            bounds,
            resize: true,
          };
        }}
        onPointerMove={(e) => {
          const g = gesture.current;
          if (!g?.resize) return;
          setBounds(
            clamp({
              ...g.bounds,
              width: g.bounds.width + e.clientX - g.x,
              height: g.bounds.height + e.clientY - g.y,
            }),
          );
        }}
        onPointerUp={() => {
          gesture.current = null;
        }}
        onPointerCancel={() => {
          gesture.current = null;
        }}
      >
        ↘
      </button>
    </div>
  );
}
