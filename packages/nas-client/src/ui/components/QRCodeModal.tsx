import React, { useEffect, useRef } from 'react';

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  value: string;
  title?: string;
}

export function QRCodeModal({ isOpen, onClose, value, title = 'Scan to Connect' }: QRCodeModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;

    // Simple QR code generation (simplified version)
    // In production, you'd use a proper QR library
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 200;
    const cellSize = Math.floor(size / 25);
    canvas.width = size;
    canvas.height = size;

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, size, size);

    // Generate a simple pattern based on the value
    // This is a placeholder - real QR codes need proper encoding
    ctx.fillStyle = '#000000';
    const hash = simpleHash(value);

    // Draw QR-like pattern
    for (let y = 0; y < 21; y++) {
      for (let x = 0; x < 21; x++) {
        // Position detection patterns (corners)
        const isCornerPattern =
          (x < 7 && y < 7) ||
          (x > 13 && y < 7) ||
          (x < 7 && y > 13);

        if (isCornerPattern) {
          const inOuter = (x < 2 || x > 4) && (y < 2 || y > 4);
          const inInner = x >= 2 && x <= 4 && y >= 2 && y <= 4;

          if (!inOuter && !inInner) {
            ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
          }
        } else {
          // Data bits based on hash
          const bitIndex = y * 21 + x;
          const bit = (hash >> (bitIndex % 32)) & 1;
          if (bit) {
            ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
          }
        }
      }
    }
  }, [isOpen, value]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <canvas ref={canvasRef} className="qr-canvas" />
          <p className="qr-value">{value}</p>
          <p className="qr-instruction">Scan this code with the mobile app</p>
        </div>
      </div>
    </div>
  );
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}
