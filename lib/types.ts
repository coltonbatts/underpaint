export type OKLab = {
  L: number;
  a: number;
  b: number;
};

export type OKLCH = {
  L: number;
  C: number;
  h: number;
};

export type CIELab = {
  L: number;
  a: number;
  b: number;
};

export type RGB = {
  r: number; // 0..1
  g: number; // 0..1
  b: number; // 0..1
};

export type PaletteId = "standard-limited" | "zorn" | "custom";

export type CropRect = {
  x: number; // normalized 0..1
  y: number; // normalized 0..1
  w: number; // normalized 0..1
  h: number; // normalized 0..1
};

export type CanvasSpec = {
  widthIn: number;
  heightIn: number;
  crop: CropRect;
  groundColor?: string; // chosen imprimatura (hex)
};

export type SegmentLevel = {
  level: number;
  labels: Int32Array;
  meanColors: OKLab[];
};

export type MixPart = {
  pigmentId: string;
  parts: number; // integer parts (1..10) or 0.25 for "trace"
  isTrace?: boolean;
};

export type MixRecipe = {
  target: OKLab;
  parts: MixPart[];
  result: OKLab;
  deltaE2000: number;
  valueDelta: number; // result value - target value (0..10 scale)
  notes: string[];
};

export type KeyColor = {
  oklab: OKLab;
  hex: string;
  value: number; // 0..10 scale
  coverage: number; // 0..100 (% of image)
  recipe?: MixRecipe;
  firstStageId: string;
};

export type ImageAnalysis = {
  workingRes: { w: number; h: number };
  lightness: Float32Array; // OKLab L per pixel
  valueContinuous?: Uint8Array; // CIELAB L* quantized 0..255 -> 0..10 value scale
  valueMap3?: Uint8Array; // 3-value grouping (0..2)
  valueMap5: Uint8Array; // 5-value grouping (0..4)
  valueMap9: Uint8Array; // 9-value grouping (0..8, Munsell-style 1..9)
  segments: SegmentLevel[];
  edges: Float32Array; // edge magnitude 0..1
  keyColors: KeyColor[];
  focalPoint?: { x: number; y: number }; // normalized 0..1
  suggestedGroundColor?: string;
};

export type PigmentRole = "white" | "black" | "earth" | "chromatic";

export type Pigment = {
  id: string;
  name: string;
  colorIndex?: string;
  role?: PigmentRole;
  spectral: number[] | string;
  opacity: "opaque" | "semi" | "transparent";
  tintingStrength: "low" | "med" | "high";
  dryingSpeed: "fast" | "med" | "slow";
};

export type StageRendererId =
  | "prepared-canvas"
  | "toned-ground"
  | "drawing"
  | "monochrome-block-in"
  | "color-block-in"
  | "develop-forms"
  | "refinement-edges"
  | "accents-highlights";

export type StageGuidance = {
  goal: string;
  paints: string;
  medium: string;
  brushes: string;
  lookFor: string[];
  commonMistakes: string[];
  fatOverLean: string;
};

export type ProcessStage = {
  id: string;
  name: string;
  sliderRange: [number, number];
  render: StageRendererId;
  params: Record<string, number | string | boolean>;
  guidance: StageGuidance;
};

export type ProcessPreset = {
  id: string;
  name: string;
  description: string;
  stages: ProcessStage[];
};

export type Project = {
  id: string;
  name: string;
  sourceImage: Blob;
  sourceWidth: number;
  sourceHeight: number;
  canvas: CanvasSpec;
  palette: PaletteId;
  customPigmentIds?: string[];
  processPresetId: string;
  analysis?: ImageAnalysis;
  createdAt: number;
  updatedAt: number;
};

/**
 * Lightweight project metadata stored in the primary IndexedDB index store
 * so listing studies never loads full-resolution blobs or ~15MB analysis maps.
 */
export type ProjectSummary = Omit<Project, "sourceImage" | "analysis"> & {
  thumbnail?: Blob;
};

export type GridMode = "off" | "divisions" | "inches";

export type GridConfig = {
  mode: GridMode;
  cols: number;
  rows: number;
  inchStep: number; // e.g., 2" squares on the physical canvas
  showLabels: boolean;
  opacity: number; // 0.1..0.9
  color: "light" | "dark" | "accent";
};

export type CanvasSizePreset = {
  id: string;
  label: string;
  widthIn: number;
  heightIn: number;
};

export const CANVAS_SIZE_PRESETS: CanvasSizePreset[] = [
  { id: "9x12", label: '9 × 12"', widthIn: 9, heightIn: 12 },
  { id: "11x14", label: '11 × 14"', widthIn: 11, heightIn: 14 },
  { id: "12x16", label: '12 × 16"', widthIn: 12, heightIn: 16 },
  { id: "16x20", label: '16 × 20"', widthIn: 16, heightIn: 20 },
  { id: "18x24", label: '18 × 24"', widthIn: 18, heightIn: 24 },
];
