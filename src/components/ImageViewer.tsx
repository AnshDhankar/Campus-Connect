import React, { useState, useEffect, useRef } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, X, HelpCircle, GripHorizontal, Download } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

interface ImageViewerProps {
  src: string | null;
  onClose: () => void;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({ src, onClose }) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showInstructions, setShowInstructions] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);

  const handleDownload = () => {
    if (!src) return;
    try {
      let filename = 'attachment';
      let extension = 'png';

      if (src.startsWith('data:')) {
        const mimeTypeMatch = src.match(/data:([^;]+);/);
        if (mimeTypeMatch && mimeTypeMatch[1]) {
          const mime = mimeTypeMatch[1];
          const extMap: Record<string, string> = {
            'image/png': 'png',
            'image/jpeg': 'jpg',
            'image/jpg': 'jpg',
            'image/gif': 'gif',
            'image/webp': 'webp',
            'image/svg+xml': 'svg',
            'application/pdf': 'pdf',
          };
          extension = extMap[mime] || mime.split('/')[1] || 'png';
        }
        filename = `attachment.${extension}`;

        const link = document.createElement('a');
        link.href = src;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        const urlParts = src.split('/');
        const lastPart = urlParts[urlParts.length - 1]?.split('?')[0];
        if (lastPart && lastPart.includes('.')) {
          filename = lastPart;
        } else {
          filename = `attachment.${extension}`;
        }

        fetch(src)
          .then((resp) => resp.blob())
          .then((blob) => {
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
          })
          .catch((err) => {
            console.warn('CORS fetch failed, using fallback anchor download:', err);
            const link = document.createElement('a');
            link.href = src;
            link.target = '_blank';
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          });
      }
    } catch (err) {
      console.error('Failed to download attachment:', err);
    }
  };

  // Close on ESC key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (src) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [src]);

  if (!src) return null;

  // Zoom limits
  const MIN_SCALE = 0.5;
  const MAX_SCALE = 5;

  const handleZoomIn = () => {
    setScale((prev) => Math.min(prev + 0.25, MAX_SCALE));
  };

  const handleZoomOut = () => {
    setScale((prev) => Math.max(prev - 0.25, MIN_SCALE));
  };

  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Wheel zoom handling
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = 0.05;
    const delta = -e.deltaY;
    let newScale = scale + delta * zoomFactor * 0.01;
    newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
    setScale(newScale);
  };

  // Pointer Down (Supports Mouse & Touch)
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return; // Only left click
    e.preventDefault();
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  // Pointer Move
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    setPosition({ x: newX, y: newY });
  };

  // Pointer Up
  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  };

  // Double Click to Toggle Zoom
  const handleDoubleClick = () => {
    if (scale > 1) {
      handleReset();
    } else {
      setScale(2);
      setPosition({ x: 0, y: 0 });
    }
  };

  // Click outside image to close
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        id="full-screen-image-viewer"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[99999] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center select-none"
        onClick={handleOverlayClick}
      >
        {/* Top Controls Bar */}
        <div className="absolute top-0 inset-x-0 h-16 flex items-center justify-between px-6 bg-gradient-to-b from-black/80 to-transparent pointer-events-none z-10">
          <div className="text-white/85 text-xs font-mono tracking-wider pointer-events-auto flex items-center gap-2">
            <span className="bg-white/10 px-2 py-0.5 rounded font-bold uppercase text-[9px] tracking-widest text-emerald-400">HQ Source</span>
            <span>CampusConnect Image Sandbox</span>
          </div>

          <div className="flex items-center gap-3 pointer-events-auto">
            {/* Instruction toggle */}
            <button
              onClick={() => setShowInstructions((prev) => !prev)}
              title="Show gesture guide"
              className="w-10 h-10 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <HelpCircle className="w-5 h-5" />
            </button>

            {/* Download button */}
            <button
              onClick={handleDownload}
              title="Download Original File"
              className="w-10 h-10 rounded-full flex items-center justify-center text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-colors cursor-pointer border border-emerald-500/15 bg-emerald-500/5 shadow-md"
            >
              <Download className="w-5 h-5" />
            </button>
            
            {/* Close button */}
            <button
              onClick={onClose}
              title="Close Viewer (ESC)"
              className="w-10 h-10 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/10 transition-colors cursor-pointer border border-white/15 bg-white/5"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Gesture/Keyboard Instructions Box */}
        {showInstructions && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute top-20 right-6 z-20 max-w-xs bg-charcoal-900/90 border border-white/10 p-3.5 rounded-lg text-[11px] text-white/80 space-y-1.5 shadow-xl backdrop-blur-md"
          >
            <div className="flex justify-between items-center border-b border-white/10 pb-1 mb-1.5">
              <span className="font-bold text-white uppercase tracking-wider text-[9px]">Viewer Control Guide</span>
              <button onClick={() => setShowInstructions(false)} className="text-white/40 hover:text-white text-xs font-mono">Dismiss</button>
            </div>
            <p>💾 <strong className="text-white">Download:</strong> Save the original high-resolution file</p>
            <p>🖱️ <strong className="text-white">Mouse Drag / Touch:</strong> Drag & pan across the image</p>
            <p>🎡 <strong className="text-white">Mouse Scroll:</strong> Pinch/scroll wheel to zoom in & out</p>
            <p>⚡ <strong className="text-white">Double Tap / Click:</strong> Instantly toggle 1x / 2x zoom</p>
            <p>⌨️ <strong className="text-white">Escape Key:</strong> Exit full screen mode</p>
          </motion.div>
        )}

        {/* Interactive Image Container */}
        <div
          ref={containerRef}
          onWheel={handleWheel}
          className="w-full h-full flex items-center justify-center relative overflow-hidden cursor-grab active:cursor-grabbing"
          onClick={handleOverlayClick}
        >
          <motion.div
            style={{
              x: position.x,
              y: position.y,
              scale: scale,
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onDoubleClick={handleDoubleClick}
            className="max-w-[90%] max-h-[85%] flex items-center justify-center"
          >
            <img
              src={src}
              alt="Full Screen Preview"
              referrerPolicy="no-referrer"
              draggable="false"
              className="max-w-full max-h-full object-contain pointer-events-none rounded shadow-2xl select-none"
            />
          </motion.div>
        </div>

        {/* Bottom Navigation / Zoom Slider Bar */}
        <div className="absolute bottom-6 bg-charcoal-900/90 border border-white/10 rounded-full px-5 py-2.5 flex items-center gap-5 shadow-2xl backdrop-blur-md z-10 select-none">
          {/* Zoom Out */}
          <button
            onClick={handleZoomOut}
            disabled={scale <= MIN_SCALE}
            title="Zoom Out"
            className="text-white/70 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
          >
            <ZoomOut className="w-4.5 h-4.5" />
          </button>

          {/* Scale Slider / Bar */}
          <div className="flex items-center gap-2">
            <div className="w-20 bg-white/15 h-1 rounded-full overflow-hidden relative">
              <div
                className="bg-emerald-400 h-full transition-all duration-150"
                style={{ width: `${((scale - MIN_SCALE) / (MAX_SCALE - MIN_SCALE)) * 100}%` }}
              />
            </div>
            <span className="text-[10px] font-mono font-bold text-white tracking-widest min-w-[36px] text-right">
              {Math.round(scale * 100)}%
            </span>
          </div>

          {/* Zoom In */}
          <button
            onClick={handleZoomIn}
            disabled={scale >= MAX_SCALE}
            title="Zoom In"
            className="text-white/70 hover:text-white disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
          >
            <ZoomIn className="w-4.5 h-4.5" />
          </button>

          {/* Divider */}
          <div className="w-[1px] bg-white/15 h-4" />

          {/* Reset Zoom */}
          <button
            onClick={handleReset}
            title="Reset Zoom & Alignment"
            className="text-white/70 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider"
          >
            <RotateCcw className="w-4 h-4 text-white/50" />
            <span>Reset</span>
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
