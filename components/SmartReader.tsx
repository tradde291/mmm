import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { 
  PenTool, Eraser, Move, 
  ZoomIn, ZoomOut, RotateCcw, Highlighter, Maximize2,
  ArrowLeftRight, Maximize
} from 'lucide-react';
import { PDFDocumentProxy, DrawingPath, DrawingPoint, PDFTextItem } from '../types';

// --- Types ---
interface SmartReaderProps {
  file: File;
  onFrameCapture: (base64: string) => void;
  onPageText: (text: string) => void;
  isLive: boolean;
}

interface PageAnnotation {
  pageIndex: number;
  path: DrawingPath;
}

// --- Sub-Component: Single PDF Page ---
interface PDFPageProps {
  pdfDoc: PDFDocumentProxy;
  pageIndex: number; // 0-based index
  scale: number;
  mode: 'pen' | 'move' | 'highlighter';
  annotation: DrawingPath | null;
  penColor: string;
  penWidth: number;
  highlighterColor: string;
  highlighterWidth: number;
  onStartDraw: () => void;
  onFinishDraw: (pageIndex: number, path: DrawingPath) => void;
  onVisible: (pageIndex: number) => void;
  registerCanvas: (pageIndex: number, canvas: HTMLCanvasElement | null) => void;
}

const PDFPage: React.FC<PDFPageProps> = ({
  pdfDoc, pageIndex, scale, mode, annotation,
  penColor, penWidth, highlighterColor, highlighterWidth,
  onStartDraw, onFinishDraw, onVisible, registerCanvas
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<DrawingPoint[]>([]);

  // Notify parent when canvas is mounted/unmounted
  useEffect(() => {
    registerCanvas(pageIndex, canvasRef.current);
    return () => registerCanvas(pageIndex, null);
  }, [pageIndex, registerCanvas]);

  // Visibility Observer (Lazy Loading)
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
        if (entry.isIntersecting) {
          onVisible(pageIndex);
        }
      },
      { threshold: 0.1, rootMargin: '200px' } // Load a bit before it comes into view
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [pageIndex, onVisible]);

  // Render PDF Page
  useEffect(() => {
    if (!isVisible || !canvasRef.current) return;

    let renderTask: any = null;
    let isCancelled = false;

    const render = async () => {
      try {
        const page = await pdfDoc.getPage(pageIndex + 1);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        // Resize canvas if needed
        if (canvas.width !== viewport.width || canvas.height !== viewport.height) {
          canvas.width = viewport.width;
          canvas.height = viewport.height;
        }

        // Render PDF content
        renderTask = page.render({ canvasContext: context, viewport });
        await renderTask.promise;

        if (isCancelled) return;

        // Render Annotation (Stored)
        context.lineCap = 'round';
        context.lineJoin = 'round';

        if (annotation) {
          context.strokeStyle = annotation.color;
          context.lineWidth = annotation.width * scale;
          drawSmoothPath(context, annotation.points, viewport.width, viewport.height);
        }

        // Render Current Stroke (Being drawn)
        if (currentPath.length > 0) {
            context.strokeStyle = mode === 'pen' ? penColor : highlighterColor;
            context.lineWidth = (mode === 'pen' ? penWidth : highlighterWidth) * scale;
            drawSmoothPath(context, currentPath, 1, 1); // Current path is already raw pixels
        }

      } catch (error: any) {
        if (error.name !== 'RenderingCancelledException') {
          console.error(`Error rendering page ${pageIndex + 1}:`, error);
        }
      }
    };

    render();

    return () => {
      isCancelled = true;
      if (renderTask) renderTask.cancel();
    };
  }, [pdfDoc, pageIndex, scale, isVisible, annotation, currentPath, mode, penColor, penWidth, highlighterColor, highlighterWidth]);

  // Helper: Draw Path
  const drawSmoothPath = (context: CanvasRenderingContext2D, points: DrawingPoint[], scaleX: number, scaleY: number) => {
    if (points.length === 0) return;
    context.beginPath();
    context.moveTo(points[0].x * scaleX, points[0].y * scaleY);

    if (points.length < 2) {
      context.lineTo(points[0].x * scaleX, points[0].y * scaleY);
      context.stroke();
      return;
    }

    for (let i = 1; i < points.length - 1; i++) {
      const mid = {
        x: (points[i].x + points[i + 1].x) / 2,
        y: (points[i].y + points[i + 1].y) / 2
      };
      context.quadraticCurveTo(points[i].x * scaleX, points[i].y * scaleY, mid.x * scaleX, mid.y * scaleY);
    }
    const last = points[points.length - 1];
    context.lineTo(last.x * scaleX, last.y * scaleY);
    context.stroke();
  };

  // Drawing Handlers
  const getPoint = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (mode === 'move') return;
    // Tell parent to clear other pages
    onStartDraw();
    setIsDrawing(true);
    setCurrentPath([getPoint(e)]);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || mode === 'move') return;
    if ('touches' in e && e.cancelable) {
      // e.preventDefault(); // Prevent scrolling while drawing
    }
    const point = getPoint(e);
    setCurrentPath(prev => [...prev, point]);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentPath.length > 0 && canvasRef.current) {
      const w = canvasRef.current.width;
      const h = canvasRef.current.height;
      
      // Normalize points (0-1)
      const normalizedPoints = currentPath.map(p => ({ x: p.x / w, y: p.y / h }));
      
      const newPath: DrawingPath = {
        points: normalizedPoints,
        color: mode === 'pen' ? penColor : highlighterColor,
        width: mode === 'pen' ? penWidth : highlighterWidth
      };

      onFinishDraw(pageIndex, newPath);
    }
    setCurrentPath([]);
  };

  // Styles based on mode
  const cursorClass = mode === 'move' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair';
  const touchAction = mode === 'move' ? 'auto' : 'none';

  return (
    <div 
      ref={containerRef} 
      className="bg-white shadow-lg mb-4 transition-shadow relative min-h-[400px]"
      style={{ width: 'fit-content', margin: '0 auto 20px auto' }}
    >
        <div className="absolute top-2 left-2 bg-black/10 text-black/50 px-2 py-1 text-xs rounded pointer-events-none">
            Page {pageIndex + 1}
        </div>
        <canvas
            ref={canvasRef}
            className={cursorClass}
            style={{ touchAction, display: 'block' }}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
        />
        {!isVisible && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-50 text-slate-400">
                Loading Page {pageIndex + 1}...
            </div>
        )}
    </div>
  );
};


// --- Main Component ---
export const SmartReader: React.FC<SmartReaderProps> = ({ file, onFrameCapture, onPageText, isLive }) => {
  // PDF State
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // View State
  const [scale, setScale] = useState(1.2);
  const [visiblePageIndex, setVisiblePageIndex] = useState(0);

  // Drawing State (Global Single Annotation)
  const [mode, setMode] = useState<'pen' | 'move' | 'highlighter'>('pen');
  const [activeAnnotation, setActiveAnnotation] = useState<PageAnnotation | null>(null);
  
  // Tools Settings
  const [penColor, setPenColor] = useState('#ef4444');
  const [penWidth, setPenWidth] = useState(4);
  const [highlighterColor, setHighlighterColor] = useState('rgba(255, 226, 8, 0.5)');
  const [highlighterWidth, setHighlighterWidth] = useState(20);

  // References to canvases for screen capture
  const canvasRefs = useRef<{ [key: number]: HTMLCanvasElement | null }>({});
  const captureTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // --- Logic: Load PDF ---
  useEffect(() => {
    let objectUrl: string | null = null;
    let isActive = true;

    const loadPdf = async () => {
      setLoading(true);
      try {
        objectUrl = URL.createObjectURL(file);
        const loadingTask = window.pdfjsLib.getDocument(objectUrl);
        const doc = await loadingTask.promise;
        
        if (!isActive) return;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setLoading(false);
        // Initial fit for mobile
        if (window.innerWidth < 768) {
             // small delay to let render
             setTimeout(() => handleFit('width'), 200);
        }
      } catch (error) {
        console.error("Error loading PDF", error);
        if (isActive) setLoading(false);
      }
    };

    loadPdf();
    return () => {
        isActive = false;
        if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file]);


  // --- Logic: Text Extraction (Context Aware with Layout Preservation) ---
  const extractTextTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!pdfDoc) return;

    if (extractTextTimeout.current) clearTimeout(extractTextTimeout.current);

    extractTextTimeout.current = setTimeout(async () => {
        try {
            // Helper to fetch text for a specific page index with robust layout handling
            const getPageText = async (idx: number) => {
                if (idx < 0 || idx >= numPages) return null;
                const page = await pdfDoc.getPage(idx + 1);
                const content = await page.getTextContent();
                const items = content.items as PDFTextItem[];

                if (items.length === 0) return '';

                const lines: { y: number; items: PDFTextItem[] }[] = [];
                const yTolerance = 6; 

                for (const item of items) {
                    if (!item.transform || item.transform.length < 6) {
                        lines.push({ y: 0, items: [item] });
                        continue;
                    }
                    const y = item.transform[5];
                    let line = lines.find(l => Math.abs(l.y - y) < yTolerance);
                    if (!line) {
                        line = { y, items: [] };
                        lines.push(line);
                    }
                    line.items.push(item);
                }

                lines.sort((a, b) => b.y - a.y);

                const textLines = lines.map(line => {
                    line.items.sort((a, b) => {
                         const xa = a.transform ? a.transform[4] : 0;
                         const xb = b.transform ? b.transform[4] : 0;
                         return xa - xb;
                    });

                    let lineText = '';
                    let lastEnd = -1;

                    for (const item of line.items) {
                        const tx = item.transform || [0,0,0,0,0,0];
                        const x = tx[4];
                        const width = item.width || 0;
                        const str = item.str;

                        if (lastEnd !== -1) {
                             if (x > lastEnd + 3) {
                                 lineText += ' ';
                             }
                        }
                        lineText += str;
                        lastEnd = x + width;
                    }
                    return lineText;
                });

                return `--- [Page ${idx + 1}] ---\n${textLines.join('\n')}\n`;
            };

            const pagesToFetch = [visiblePageIndex - 1, visiblePageIndex, visiblePageIndex + 1];
            const promises = pagesToFetch.map(idx => getPageText(idx));
            const results = await Promise.all(promises);
            
            const combinedContext = results
                .filter(Boolean)
                .join('\n');
                
            onPageText(combinedContext);
        } catch (e) {
            console.error("Context text extract failed", e);
        }
    }, 500);

    return () => {
        if (extractTextTimeout.current) clearTimeout(extractTextTimeout.current);
    }
  }, [pdfDoc, visiblePageIndex, onPageText, numPages]);


  // --- Logic: Screen Capture ---
  const captureFrame = useCallback(() => {
    if (!isLive) return;
    
    const currentCanvas = canvasRefs.current[visiblePageIndex];
    if (!currentCanvas) return;

    if (captureTimeoutRef.current) clearTimeout(captureTimeoutRef.current);

    captureTimeoutRef.current = setTimeout(() => {
        try {
            const base64 = currentCanvas.toDataURL('image/jpeg', 0.8);
            onFrameCapture(base64);
        } catch(e) {}
    }, 500);
  }, [isLive, visiblePageIndex, onFrameCapture]);

  useEffect(() => {
      if (!isLive) return;
      const id = setInterval(captureFrame, 2000);
      return () => clearInterval(id);
  }, [isLive, captureFrame]);


  // --- Handlers ---
  const handleStartDraw = () => {
    setActiveAnnotation(null); 
  };

  const handleFinishDraw = (pageIndex: number, path: DrawingPath) => {
    setActiveAnnotation({ pageIndex, path });
    captureFrame(); 
  };

  const handleRegisterCanvas = useCallback((index: number, canvas: HTMLCanvasElement | null) => {
      if (canvas) canvasRefs.current[index] = canvas;
      else delete canvasRefs.current[index];
  }, []);

  const clearDrawings = () => {
      setActiveAnnotation(null);
      captureFrame();
  };

  const handleFit = async (type: 'width' | 'page') => {
      if (!pdfDoc || !scrollContainerRef.current) return;
      try {
          const pageIndexToUse = visiblePageIndex >= 0 ? visiblePageIndex : 0;
          const page = await pdfDoc.getPage(pageIndexToUse + 1);
          const viewport = page.getViewport({ scale: 1 });
          const container = scrollContainerRef.current;
          
          const padding = 32; 
          const availableWidth = container.clientWidth - padding; 
          const availableHeight = container.clientHeight - padding;

          let newScale = 1;
          if (type === 'width') {
              newScale = availableWidth / viewport.width;
          } else {
              newScale = availableHeight / viewport.height;
          }
          
          newScale = Math.min(Math.max(newScale, 0.4), 4.0);
          
          setScale(newScale);
      } catch (e) {
          console.error("Fit calculation failed", e);
      }
  };

  // --- Render ---
  return (
    <div className="flex flex-col h-full bg-slate-100 relative">
      
      {/* Toolbar: Responsive Scrollable Horizontal Layout */}
      <div className="sticky top-0 z-20 px-3 py-2 md:px-4 md:py-3 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm flex items-center justify-between gap-4 overflow-x-auto no-scrollbar">
        
        {/* Left: Info */}
        <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-1.5 text-slate-600 font-mono text-xs md:text-sm shrink-0 whitespace-nowrap">
           <span>Page {visiblePageIndex + 1} / {numPages}</span>
        </div>

        {/* Center: Tools */}
        <div className="flex items-center gap-2 md:gap-4 shrink-0">
            <div className="flex items-center bg-slate-100 rounded-lg p-1 shadow-inner shrink-0">
                <button 
                onClick={() => setMode('move')}
                className={`flex items-center gap-2 px-2 py-1.5 md:px-3 rounded-md transition-all text-sm font-medium ${mode === 'move' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}
                >
                <Move size={18} />
                <span className="hidden lg:inline">Scroll</span>
                </button>
                <button 
                onClick={() => setMode('pen')}
                className={`flex items-center gap-2 px-2 py-1.5 md:px-3 rounded-md transition-all text-sm font-medium ${mode === 'pen' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}
                >
                <PenTool size={18} />
                <span className="hidden lg:inline">Pen</span>
                </button>
                <button 
                onClick={() => setMode('highlighter')}
                className={`flex items-center gap-2 px-2 py-1.5 md:px-3 rounded-md transition-all text-sm font-medium ${mode === 'highlighter' ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-black/5' : 'text-slate-500 hover:text-slate-700'}`}
                >
                <Highlighter size={18} />
                <span className="hidden lg:inline">Highlight</span>
                </button>
            </div>

            {/* Inline Palette */}
            {mode === 'pen' && (
                <div className="flex items-center gap-2 animate-in fade-in zoom-in-95 bg-white border border-slate-200 px-3 py-1.5 rounded-full shadow-sm shrink-0">
                    {['#ef4444', '#22c55e', '#3b82f6', '#0f172a'].map(c => (
                        <button key={c} onClick={() => setPenColor(c)} className={`w-4 h-4 md:w-5 md:h-5 rounded-full ${penColor === c ? 'scale-125 ring-2 ring-indigo-500' : ''}`} style={{ backgroundColor: c }} />
                    ))}
                    <div className="w-px h-4 bg-slate-300 mx-1 hidden sm:block" />
                    <div className="hidden sm:flex items-center gap-2">
                      {[2, 4, 8].map(w => (
                          <button key={w} onClick={() => setPenWidth(w)} className={`w-6 h-6 flex items-center justify-center rounded-full ${penWidth === w ? 'bg-indigo-100 text-indigo-600' : 'text-slate-300'}`}>
                              <div className="bg-current rounded-full" style={{ width: w+2, height: w+2 }} />
                          </button>
                      ))}
                    </div>
                </div>
            )}

            {mode === 'highlighter' && (
                 <div className="flex items-center gap-2 animate-in fade-in zoom-in-95 bg-white border border-slate-200 px-3 py-1.5 rounded-full shadow-sm shrink-0">
                    {['rgba(255, 226, 8, 0.5)', 'rgba(74, 222, 128, 0.5)', 'rgba(96, 165, 250, 0.5)', 'rgba(244, 114, 182, 0.5)'].map(c => (
                        <button key={c} onClick={() => setHighlighterColor(c)} className={`w-4 h-4 md:w-5 md:h-5 rounded-full ${highlighterColor === c ? 'scale-125 ring-2 ring-indigo-500' : ''}`} style={{ backgroundColor: c }} />
                    ))}
                </div>
            )}
            
            <button onClick={clearDrawings} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg shrink-0">
                <Eraser size={20} />
            </button>
        </div>

        {/* Right: Zoom & Fit */}
        <div className="flex items-center bg-slate-100 rounded-lg p-1 shrink-0">
           <button onClick={() => setScale(s => Math.max(0.5, s - 0.2))} className="p-2 hover:bg-white rounded-md text-slate-600"><ZoomOut size={18} /></button>
           <span className="min-w-[3rem] md:min-w-[4rem] text-center text-xs md:text-sm font-mono text-slate-600">{Math.round(scale * 100)}%</span>
           <button onClick={() => setScale(s => Math.min(4.0, s + 0.2))} className="p-2 hover:bg-white rounded-md text-slate-600"><ZoomIn size={18} /></button>
           
           <div className="w-px h-4 bg-slate-300 mx-1 hidden sm:block" />
           
           <button onClick={() => handleFit('width')} className="p-2 hover:bg-white rounded-md text-slate-600" title="Fit Width">
               <ArrowLeftRight size={18} />
           </button>
           <button onClick={() => handleFit('page')} className="p-2 hover:bg-white rounded-md text-slate-600" title="Fit Page">
               <Maximize size={18} />
           </button>
           <button onClick={() => setScale(1.2)} className="p-2 hover:bg-white rounded-md text-slate-600" title="Reset Zoom">
               <RotateCcw size={18} />
           </button>
        </div>
      </div>

      {/* Main Content (Scrollable List of Pages) */}
      <div 
        ref={scrollContainerRef}
        className={`flex-1 overflow-y-auto bg-slate-100 p-2 md:p-4 ${mode === 'move' ? 'touch-pan-y' : 'touch-none'}`}
      >
        {loading && (
             <div className="flex flex-col items-center justify-center h-full">
                <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-slate-500">Processing PDF...</p>
             </div>
        )}
        
        {!loading && pdfDoc && (
             <div className="flex flex-col items-center gap-4">
                 {Array.from({ length: numPages }).map((_, i) => (
                     <PDFPage
                        key={i}
                        pageIndex={i}
                        pdfDoc={pdfDoc}
                        scale={scale}
                        mode={mode}
                        annotation={activeAnnotation?.pageIndex === i ? activeAnnotation.path : null}
                        penColor={penColor}
                        penWidth={penWidth}
                        highlighterColor={highlighterColor}
                        highlighterWidth={highlighterWidth}
                        onStartDraw={handleStartDraw}
                        onFinishDraw={handleFinishDraw}
                        onVisible={setVisiblePageIndex}
                        registerCanvas={handleRegisterCanvas}
                     />
                 ))}
             </div>
        )}
      </div>
    </div>
  );
};