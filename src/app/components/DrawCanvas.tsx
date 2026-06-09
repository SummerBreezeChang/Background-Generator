import { useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import type { ImageDensityMap } from "../App";

const MAP_SIZE = 64;

export interface DrawCanvasHandle {
  clearCanvas:   () => void;
  loadPreset:    (imageDataUrl: string) => void;
  buildSnapshot: () => { thumbnail: string; map: ImageDensityMap } | null;
}

interface Props {
  onDraw:    (map: ImageDensityMap) => void;
  brushSize: number;
}

export const DrawCanvas = forwardRef<DrawCanvasHandle, Props>(
  function DrawCanvas({ onDraw, brushSize }, ref) {
    const canvasRef   = useRef<HTMLCanvasElement>(null);
    const isDrawing   = useRef(false);
    const lastPos     = useRef<{ x: number; y: number } | null>(null);
    const brushRef    = useRef(brushSize);
    brushRef.current  = brushSize;
    const onDrawRef   = useRef(onDraw);
    onDrawRef.current = onDraw;

    // Keep canvas intrinsic size matching its CSS display size
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const sync = () => {
        const tmp = document.createElement("canvas");
        tmp.width  = canvas.width  || 1;
        tmp.height = canvas.height || 1;
        if (canvas.width > 1) tmp.getContext("2d")!.drawImage(canvas, 0, 0);
        canvas.width  = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
        if (tmp.width > 1) canvas.getContext("2d")!.drawImage(tmp, 0, 0, canvas.width, canvas.height);
      };
      sync();
      const ro = new ResizeObserver(sync);
      ro.observe(canvas);
      return () => ro.disconnect();
    }, []);

    function computeMap(canvas: HTMLCanvasElement): ImageDensityMap {
      const off = document.createElement("canvas");
      off.width = MAP_SIZE; off.height = MAP_SIZE;
      const octx = off.getContext("2d")!;
      octx.drawImage(canvas, 0, 0, MAP_SIZE, MAP_SIZE);
      const px   = octx.getImageData(0, 0, MAP_SIZE, MAP_SIZE).data;
      const data: number[] = [];
      for (let i = 0; i < px.length; i += 4) data.push(px[i + 3] / 255);
      return { data, w: MAP_SIZE, h: MAP_SIZE };
    }

    useImperativeHandle(ref, () => ({
      clearCanvas() {
        const c = canvasRef.current;
        if (c) c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
      },
      loadPreset(imageDataUrl: string) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d")!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          onDrawRef.current(computeMap(canvas));
        };
        img.src = imageDataUrl;
      },
      buildSnapshot() {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        // Reject empty canvas
        const px = canvas.getContext("2d")!.getImageData(0, 0, canvas.width, canvas.height).data;
        const hasContent = Array.from(px).some((v, i) => i % 4 === 3 && v > 10);
        if (!hasContent) return null;
        return { thumbnail: canvas.toDataURL("image/png", 0.6), map: computeMap(canvas) };
      },
    }));

    function getPos(e: React.MouseEvent<HTMLCanvasElement>) {
      const c = canvasRef.current!;
      const r = c.getBoundingClientRect();
      return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
    }

    function paint(ctx: CanvasRenderingContext2D, x: number, y: number) {
      const r = brushRef.current;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0,    "rgba(255,255,255,0.70)");
      g.addColorStop(0.45, "rgba(255,255,255,0.30)");
      g.addColorStop(1,    "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    function paintLine(ctx: CanvasRenderingContext2D, a: { x: number; y: number }, b: { x: number; y: number }) {
      const dist  = Math.hypot(b.x - a.x, b.y - a.y);
      const steps = Math.max(1, Math.ceil(dist / (brushRef.current * 0.35)));
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        paint(ctx, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);
      }
    }

    function stopDrawing() {
      if (!isDrawing.current || !canvasRef.current) return;
      isDrawing.current = false;
      lastPos.current   = null;
      onDrawRef.current(computeMap(canvasRef.current));
    }

    function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
      isDrawing.current = true;
      const p = getPos(e);
      lastPos.current = p;
      paint(canvasRef.current!.getContext("2d")!, p.x, p.y);
    }

    function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
      if (!isDrawing.current || !canvasRef.current) return;
      const ctx = canvasRef.current.getContext("2d")!;
      const p   = getPos(e);
      if (lastPos.current) paintLine(ctx, lastPos.current, p);
      else paint(ctx, p.x, p.y);
      lastPos.current = p;
    }

    return (
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", cursor: "crosshair", zIndex: 50 }}
      />
    );
  }
);
