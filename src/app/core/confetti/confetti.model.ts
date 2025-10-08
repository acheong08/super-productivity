export interface ConfettiConfig {
  particleCount?: number;
  angel?: number;
  spread?: number;
  startVelocity?: number;
  decay?: number;
  gravity?: number;
  drift?: number;
  flat?: boolean;
  ticks?: number;
  origin?: { x?: number; y?: number };
  colors?: string[];
  shapes?: (string | Shape)[];
  scalar?: number;
  zIndex?: number;
}

interface Shape {
  type: 'path' | 'bitmap';
  path?: string;
  matrix: DOMMatrix;
  bitmap?: ImageBitmap;
}

export type CanvasConfetti = (props: ConfettiConfig) => Promise<void> | null;
