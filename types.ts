// PDF.js types workaround since we are using CDN
export interface PDFDocumentProxy {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PDFPageProxy>;
}

export interface PDFPageProxy {
  getViewport: (params: { scale: number }) => PDFPageViewport;
  render: (params: { canvasContext: CanvasRenderingContext2D; viewport: PDFPageViewport }) => PDFRenderTask;
  getTextContent: () => Promise<PDFTextContent>;
}

export interface PDFTextItem {
  str: string;
  hasEOL: boolean;
  // properties available in standard pdf.js textContent items
  transform: number[]; // [scaleX, skewY, skewX, scaleY, translateX, translateY]
  width: number;
  height: number;
  dir?: string;
  fontName?: string;
}

export interface PDFTextContent {
  items: Array<PDFTextItem>;
}

export interface PDFPageViewport {
  width: number;
  height: number;
}

export interface PDFRenderTask {
  promise: Promise<void>;
}

declare global {
  interface Window {
    pdfjsLib: {
      getDocument: (src: string | Uint8Array) => { promise: Promise<PDFDocumentProxy> };
      GlobalWorkerOptions: {
        workerSrc: string;
      };
    };
    webkitAudioContext: typeof AudioContext;
  }
}

export enum AppState {
  HOME = 'HOME',
  CLASSROOM = 'CLASSROOM',
  ADMIN = 'ADMIN'
}

export interface DrawingPoint {
  x: number;
  y: number;
}

export interface DrawingPath {
  points: DrawingPoint[];
  color: string;
  width: number;
}

export interface PageAnnotation {
  pageIndex: number;
  path: DrawingPath;
}

export interface Textbook {
  id: number;
  className: string;
  subject: string;
  file: File | Blob;
  uploadedAt: number;
}