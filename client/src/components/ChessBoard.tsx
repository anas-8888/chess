import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Chess, Square, Piece } from 'chess.js';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ChessBoardProps {
  game: Chess;
  onMove: (from: Square, to: Square, promotion?: string) => boolean;
  orientation: 'white' | 'black';
  allowMoves: boolean;
  resultSticker?: 'win' | 'loss' | 'draw' | null;
  sensorOverlay?: number[] | null; // 8 uint8 rows: rows[r] bit c = piece at rank(r+1) file(a+c)
}

const PIECE_IMAGE_NAMES: Record<'w' | 'b', Record<Uppercase<Piece['type']>, string>> = {
  w: {
    K: 'king-w.svg',
    Q: 'queen-w.svg',
    R: 'rook-w.svg',
    B: 'bishop-w.svg',
    N: 'knight-w.svg',
    P: 'pawn-w.svg',
  },
  b: {
    K: 'king-b.svg',
    Q: 'queen-b.svg',
    R: 'rook-b.svg',
    B: 'bishop-b.svg',
    N: 'knight-b.svg',
    P: 'pawn-b.svg',
  },
};

const PROMOTION_TARGETS = [
  { type: 'q', label: 'وزير' },
  { type: 'r', label: 'قلعة' },
  { type: 'b', label: 'فيل' },
  { type: 'n', label: 'حصان' },
] as const;

const PROMOTION_TO_PIECE_TYPE: Record<(typeof PROMOTION_TARGETS)[number]['type'], Uppercase<Piece['type']>> = {
  q: 'Q',
  r: 'R',
  b: 'B',
  n: 'N',
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1] as const;
const MOVE_ANIMATION_MS = 620;
const CAPTURE_FALL_MS = 520;
const LEFT_CLASS = [
  'left-[0%]',
  'left-[12.5%]',
  'left-[25%]',
  'left-[37.5%]',
  'left-[50%]',
  'left-[62.5%]',
  'left-[75%]',
  'left-[87.5%]',
] as const;
const TOP_CLASS = [
  'top-[0%]',
  'top-[12.5%]',
  'top-[25%]',
  'top-[37.5%]',
  'top-[50%]',
  'top-[62.5%]',
  'top-[75%]',
  'top-[87.5%]',
] as const;
const DELTA_X_CLASS = [
  'translate-x-[-700%]',
  'translate-x-[-600%]',
  'translate-x-[-500%]',
  'translate-x-[-400%]',
  'translate-x-[-300%]',
  'translate-x-[-200%]',
  'translate-x-[-100%]',
  'translate-x-[0%]',
  'translate-x-[100%]',
  'translate-x-[200%]',
  'translate-x-[300%]',
  'translate-x-[400%]',
  'translate-x-[500%]',
  'translate-x-[600%]',
  'translate-x-[700%]',
] as const;
const DELTA_Y_CLASS = [
  'translate-y-[-700%]',
  'translate-y-[-600%]',
  'translate-y-[-500%]',
  'translate-y-[-400%]',
  'translate-y-[-300%]',
  'translate-y-[-200%]',
  'translate-y-[-100%]',
  'translate-y-[0%]',
  'translate-y-[100%]',
  'translate-y-[200%]',
  'translate-y-[300%]',
  'translate-y-[400%]',
  'translate-y-[500%]',
  'translate-y-[600%]',
  'translate-y-[700%]',
] as const;

type PromotionType = (typeof PROMOTION_TARGETS)[number]['type'];

type MoveAnimation = {
  imageSrc: string;
  fromLeftClass: string;
  fromTopClass: string;
  deltaXClass: string;
  deltaYClass: string;
  toSquare: Square;
  active: boolean;
};

type PendingPromotion = {
  from: Square;
  to: Square;
  color: 'w' | 'b';
};

type CapturedPieceAnimation = {
  imageSrc: string;
  leftClass: string;
  topClass: string;
  active: boolean;
};

type BoardSnapshot = Record<Square, Piece | undefined>;
type ArrowAnnotation = { from: Square; to: Square };

const getSquarePosition = (square: Square) => {
  const file = square[0] as (typeof FILES)[number];
  const rank = Number(square[1]);
  return {
    x: FILES.indexOf(file),
    y: RANKS.indexOf(rank as (typeof RANKS)[number]),
  };
};

const toVisualPosition = (square: Square, orientation: 'white' | 'black') => {
  const pos = getSquarePosition(square);
  if (orientation === 'white') return pos;
  return { x: 7 - pos.x, y: 7 - pos.y };
};

const getPositionClass = (axis: number, type: 'left' | 'top') => {
  const safeAxis = Math.max(0, Math.min(7, axis));
  return type === 'left' ? LEFT_CLASS[safeAxis] : TOP_CLASS[safeAxis];
};

const getDeltaClass = (delta: number, axis: 'x' | 'y') => {
  const safe = Math.max(-7, Math.min(7, delta));
  return axis === 'x' ? DELTA_X_CLASS[safe + 7] : DELTA_Y_CLASS[safe + 7];
};

const getPieceImageSrc = (piece: Piece | null | undefined) => {
  if (!piece) return '';
  const imageName = PIECE_IMAGE_NAMES[piece.color][piece.type.toUpperCase() as Uppercase<Piece['type']>];
  return imageName ? `/thumbnails/${imageName}` : '';
};

const getPromotionImageSrc = (color: 'w' | 'b', promotionType: PromotionType) => {
  const targetPiece = PROMOTION_TO_PIECE_TYPE[promotionType];
  const imageName = PIECE_IMAGE_NAMES[color][targetPiece];
  return `/thumbnails/${imageName}`;
};

const isPromotionMove = (_from: Square, to: Square, piece: Piece | null | undefined) => {
  if (!piece || piece.type !== 'p') return false;
  const toRank = Number(to[1]);
  return (piece.color === 'w' && toRank === 8) || (piece.color === 'b' && toRank === 1);
};

const snapshotBoard = (game: Chess): BoardSnapshot => {
  const snapshot = {} as BoardSnapshot;
  for (const rank of RANKS) {
    for (const file of FILES) {
      const square = `${file}${rank}` as Square;
      snapshot[square] = game.get(square);
    }
  }
  return snapshot;
};

const isSamePiece = (a?: Piece, b?: Piece) => {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.type === b.type && a.color === b.color;
};

const detectMoveFromSnapshots = (prev: BoardSnapshot, next: BoardSnapshot) => {
  const changed: Square[] = [];
  for (const rank of RANKS) {
    for (const file of FILES) {
      const square = `${file}${rank}` as Square;
      if (!isSamePiece(prev[square], next[square])) {
        changed.push(square);
      }
    }
  }

  if (changed.length < 2) return null;

  const fromCandidates = changed.filter((square) => !!prev[square] && !isSamePiece(prev[square], next[square]));
  const toCandidates = changed.filter((square) => !!next[square] && !isSamePiece(prev[square], next[square]));
  if (!fromCandidates.length || !toCandidates.length) return null;

  const fromSquare = fromCandidates[0];
  const movedPiece = prev[fromSquare];
  if (!movedPiece) return null;

  const exactTarget = toCandidates.find((square) => isSamePiece(next[square], movedPiece));
  const colorTarget = toCandidates.find((square) => next[square]?.color === movedPiece.color);
  const toSquare = exactTarget ?? colorTarget ?? toCandidates[0];

  return { fromSquare, toSquare, movedPiece };
};

const ChessBoard: React.FC<ChessBoardProps> = ({ game, onMove, orientation, allowMoves, resultSticker = null, sensorOverlay = null }) => {
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<Square[]>([]);
  const [moveAnimation, setMoveAnimation] = useState<MoveAnimation | null>(null);
  const [capturedPieceAnimation, setCapturedPieceAnimation] = useState<CapturedPieceAnimation | null>(null);
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null);
  const [hiddenSquares, setHiddenSquares] = useState<Set<Square>>(new Set());
  const [arrowAnnotations, setArrowAnnotations] = useState<ArrowAnnotation[]>([]);
  const [markedSquares, setMarkedSquares] = useState<Set<Square>>(new Set());
  const [annotationDrag, setAnnotationDrag] = useState<ArrowAnnotation | null>(null);
  const previousBoardRef = useRef<BoardSnapshot | null>(null);
  const animationTimeoutRef = useRef<number | null>(null);
  const captureAnimationTimeoutRef = useRef<number | null>(null);
  const skipDetectedMoveRef = useRef<string | null>(null);
  const annotationFromRef = useRef<Square | null>(null);
  const rightMouseActiveRef = useRef(false);
  const longPressTimeoutRef = useRef<number | null>(null);
  const longPressActiveRef = useRef(false);
  const touchTargetSquareRef = useRef<Square | null>(null);
  const suppressNextTapRef = useRef(false);
  const isMobileDevice = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  }, []);

  const files = useMemo(() => (orientation === 'white' ? [...FILES] : [...FILES].reverse()), [orientation]);
  const ranks = useMemo(() => (orientation === 'white' ? [...RANKS] : [...RANKS].reverse()), [orientation]);

  const getSquareColor = (fileIndex: number, rankIndex: number) => {
    const isLight = (fileIndex + rankIndex) % 2 === 0;
    return isLight ? 'bg-chess-light' : 'bg-chess-dark';
  };

  const getSquareClasses = (square: Square, fileIndex: number, rankIndex: number) => {
    const baseClasses = `relative aspect-square flex items-center justify-center cursor-pointer select-none transition-all duration-200 ${getSquareColor(fileIndex, rankIndex)}`;

    if (selectedSquare === square) {
      return `${baseClasses} bg-chess-highlight ring-2 ring-primary`;
    }

    if (markedSquares.has(square)) {
      return `${baseClasses} ring-2 ring-primary/85`;
    }

    if (possibleMoves.includes(square)) {
      return `${baseClasses} before:absolute before:inset-2 before:bg-primary/40 before:rounded-full before:content-['']`;
    }

    if (game.inCheck() && game.get(square)?.type === 'k' && game.get(square)?.color === game.turn()) {
      return `${baseClasses} bg-chess-check animate-pulse`;
    }

    return `${baseClasses} hover:bg-primary/10`;
  };

  const getSquareFromPoint = useCallback((x: number, y: number): Square | null => {
    const element = document.elementFromPoint(x, y);
    if (!element) return null;
    const squareElement = (element as HTMLElement).closest('[data-square]') as HTMLElement | null;
    const value = squareElement?.dataset?.square;
    if (!value || value.length !== 2) return null;
    return value as Square;
  }, []);

  const toggleMarkedSquare = useCallback((square: Square) => {
    if (isMobileDevice) return;
    setMarkedSquares((prev) => {
      const next = new Set(prev);
      if (next.has(square)) next.delete(square);
      else next.add(square);
      return next;
    });
  }, [isMobileDevice]);

  const toggleArrow = useCallback((from: Square, to: Square) => {
    if (isMobileDevice) return;
    setArrowAnnotations((prev) => {
      const existingIndex = prev.findIndex((arrow) => arrow.from === from && arrow.to === to);
      if (existingIndex >= 0) {
        const next = [...prev];
        next.splice(existingIndex, 1);
        return next;
      }
      return [...prev, { from, to }];
    });
  }, [isMobileDevice]);

  const resetAnnotationGesture = useCallback(() => {
    annotationFromRef.current = null;
    rightMouseActiveRef.current = false;
    longPressActiveRef.current = false;
    touchTargetSquareRef.current = null;
    setAnnotationDrag(null);
  }, []);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimeoutRef.current) {
      window.clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
  }, []);

  const finalizeAnnotation = useCallback((target: Square | null) => {
    const from = annotationFromRef.current;
    if (!from) {
      resetAnnotationGesture();
      return;
    }

    const to = target || from;
    if (from === to) {
      toggleMarkedSquare(from);
    } else {
      toggleArrow(from, to);
    }
    resetAnnotationGesture();
  }, [resetAnnotationGesture, toggleArrow, toggleMarkedSquare]);

  const handleSquareContextMenu = useCallback((e: React.MouseEvent) => {
    if (isMobileDevice) return;
    e.preventDefault();
  }, [isMobileDevice]);

  const handleSquareMouseDown = useCallback((e: React.MouseEvent, square: Square) => {
    if (isMobileDevice) return;
    if (e.button !== 2) return;
    e.preventDefault();
    annotationFromRef.current = square;
    rightMouseActiveRef.current = true;
    setAnnotationDrag({ from: square, to: square });
  }, [isMobileDevice]);

  const handleSquareMouseEnter = useCallback((square: Square) => {
    if (isMobileDevice) return;
    if (!rightMouseActiveRef.current || !annotationFromRef.current) return;
    setAnnotationDrag({ from: annotationFromRef.current, to: square });
  }, [isMobileDevice]);

  const handleSquareMouseUp = useCallback((e: React.MouseEvent, square: Square) => {
    if (isMobileDevice) return;
    if (e.button !== 2) return;
    e.preventDefault();
    if (!rightMouseActiveRef.current) return;
    finalizeAnnotation(square);
  }, [finalizeAnnotation, isMobileDevice]);

  const handleSquareTouchStart = useCallback((square: Square) => {
    if (isMobileDevice) return;
    clearLongPressTimer();
    annotationFromRef.current = square;
    touchTargetSquareRef.current = square;
    longPressActiveRef.current = false;
    longPressTimeoutRef.current = window.setTimeout(() => {
      longPressActiveRef.current = true;
      suppressNextTapRef.current = true;
      const from = annotationFromRef.current;
      if (from) {
        setAnnotationDrag({ from, to: from });
      }
    }, 340);
  }, [clearLongPressTimer, isMobileDevice]);

  const handleSquareTouchMove = useCallback((e: React.TouchEvent) => {
    if (isMobileDevice) return;
    if (!annotationFromRef.current) return;
    const point = e.touches[0];
    if (!point) return;
    const hoveredSquare = getSquareFromPoint(point.clientX, point.clientY);
    if (hoveredSquare) {
      touchTargetSquareRef.current = hoveredSquare;
      if (longPressActiveRef.current && annotationFromRef.current) {
        setAnnotationDrag({ from: annotationFromRef.current, to: hoveredSquare });
      }
    }
  }, [getSquareFromPoint, isMobileDevice]);

  const handleSquareTouchEnd = useCallback(() => {
    if (isMobileDevice) return;
    clearLongPressTimer();
    if (longPressActiveRef.current) {
      suppressNextTapRef.current = true;
      finalizeAnnotation(touchTargetSquareRef.current || annotationFromRef.current);
      return;
    }
    annotationFromRef.current = null;
    touchTargetSquareRef.current = null;
    longPressActiveRef.current = false;
  }, [clearLongPressTimer, finalizeAnnotation, isMobileDevice]);

  const handleSquareTouchCancel = useCallback(() => {
    if (isMobileDevice) return;
    clearLongPressTimer();
    resetAnnotationGesture();
  }, [clearLongPressTimer, resetAnnotationGesture, isMobileDevice]);

  const startCapturedPieceFall = useCallback(
    (square: Square, capturedPiece: Piece) => {
      const imageSrc = getPieceImageSrc(capturedPiece);
      if (!imageSrc) return;

      const pos = toVisualPosition(square, orientation);
      setCapturedPieceAnimation({
        imageSrc,
        leftClass: getPositionClass(pos.x, 'left'),
        topClass: getPositionClass(pos.y, 'top'),
        active: false,
      });

      requestAnimationFrame(() => {
        setCapturedPieceAnimation((current) => (current ? { ...current, active: true } : current));
      });

      if (captureAnimationTimeoutRef.current) {
        window.clearTimeout(captureAnimationTimeoutRef.current);
      }
      captureAnimationTimeoutRef.current = window.setTimeout(() => {
        setCapturedPieceAnimation(null);
      }, CAPTURE_FALL_MS + 40);
    },
    [orientation]
  );

  const startMoveAnimation = useCallback(
    (fromSquare: Square, toSquare: Square, movedPiece: Piece | null | undefined, capturedPiece?: Piece | null) => {
      if (!movedPiece) return;
      const imageSrc = getPieceImageSrc(movedPiece);
      if (!imageSrc) return;

      const from = toVisualPosition(fromSquare, orientation);
      const to = toVisualPosition(toSquare, orientation);

      if (capturedPiece) {
        startCapturedPieceFall(toSquare, capturedPiece);
      }

      setHiddenSquares(new Set([fromSquare, toSquare]));
      setMoveAnimation({
        imageSrc,
        fromLeftClass: getPositionClass(from.x, 'left'),
        fromTopClass: getPositionClass(from.y, 'top'),
        deltaXClass: getDeltaClass(to.x - from.x, 'x'),
        deltaYClass: getDeltaClass(to.y - from.y, 'y'),
        toSquare,
        active: false,
      });

      requestAnimationFrame(() => {
        setMoveAnimation((current) => (current ? { ...current, active: true } : current));
      });

      if (animationTimeoutRef.current) {
        window.clearTimeout(animationTimeoutRef.current);
      }
      animationTimeoutRef.current = window.setTimeout(() => {
        setMoveAnimation(null);
        setHiddenSquares(new Set());
      }, MOVE_ANIMATION_MS + 50);
    },
    [orientation, startCapturedPieceFall]
  );

  const performMove = useCallback(
    (from: Square, to: Square, promotion?: PromotionType) => {
      const movingPiece = game.get(from);
      const targetBeforeMove = game.get(to);
      const isCapture = !!targetBeforeMove && !!movingPiece && targetBeforeMove.color !== movingPiece.color;
      const capturedPiece = isCapture ? targetBeforeMove : null;

      const moveResult = onMove(from, to, promotion);
      if (!moveResult) return false;

      skipDetectedMoveRef.current = `${from}-${to}`;
      startMoveAnimation(from, to, movingPiece, capturedPiece);
      setSelectedSquare(null);
      setPossibleMoves([]);
      return true;
    },
    [game, onMove, startMoveAnimation]
  );

  const handleSquareClick = useCallback((square: Square) => {
    if (suppressNextTapRef.current) {
      suppressNextTapRef.current = false;
      return;
    }

    if (!allowMoves) return;

    if (selectedSquare) {
      if (selectedSquare === square) {
        setSelectedSquare(null);
        setPossibleMoves([]);
      } else if (possibleMoves.includes(square)) {
        const movingPiece = game.get(selectedSquare);

        if (isPromotionMove(selectedSquare, square, movingPiece)) {
          setPendingPromotion({
            from: selectedSquare,
            to: square,
            color: movingPiece!.color,
          });
          setSelectedSquare(null);
          setPossibleMoves([]);
          return;
        }

        performMove(selectedSquare, square);
      } else {
        const piece = game.get(square);
        if (piece && piece.color === game.turn()) {
          setSelectedSquare(square);
          const moves = game.moves({ square, verbose: true });
          setPossibleMoves(moves.map((move) => move.to as Square));
        } else {
          setSelectedSquare(null);
          setPossibleMoves([]);
        }
      }
    } else {
      const piece = game.get(square);
      if (piece && piece.color === game.turn()) {
        setSelectedSquare(square);
        const moves = game.moves({ square, verbose: true });
        setPossibleMoves(moves.map((move) => move.to as Square));
      }
    }
  }, [selectedSquare, possibleMoves, allowMoves, game, performMove]);

  const handlePromotionChoice = useCallback((promotionType: PromotionType) => {
    if (!pendingPromotion) return;
    performMove(pendingPromotion.from, pendingPromotion.to, promotionType);
    setPendingPromotion(null);
  }, [pendingPromotion, performMove]);

  const fen = game.fen();
  const renderedArrows = useMemo(() => {
    if (isMobileDevice) return [];
    if (!annotationDrag) return arrowAnnotations;
    return [...arrowAnnotations.filter((arrow) => !(arrow.from === annotationDrag.from && arrow.to === annotationDrag.to)), annotationDrag];
  }, [annotationDrag, arrowAnnotations, isMobileDevice]);

  const stickerConfig = useMemo(() => {
    if (!resultSticker) return null;

    if (resultSticker === 'win') {
      return {
        label: 'فوز',
        textClass: 'text-emerald-900/30',
        bgClass: 'from-emerald-100/35 to-transparent',
      };
    }

    if (resultSticker === 'loss') {
      return {
        label: 'هزيمة',
        textClass: 'text-rose-900/28',
        bgClass: 'from-rose-100/35 to-transparent',
      };
    }

    return {
      label: 'تعادل',
      textClass: 'text-sky-950/28',
      bgClass: 'from-sky-100/35 to-transparent',
    };
  }, [resultSticker]);

  useEffect(() => {
    const nextBoard = snapshotBoard(game);
    const prevBoard = previousBoardRef.current;
    if (!prevBoard) {
      previousBoardRef.current = nextBoard;
      return;
    }

    const detected = detectMoveFromSnapshots(prevBoard, nextBoard);
    previousBoardRef.current = nextBoard;
    if (!detected) {
      return;
    }

    const detectedKey = `${detected.fromSquare}-${detected.toSquare}`;
    if (skipDetectedMoveRef.current === detectedKey) {
      skipDetectedMoveRef.current = null;
      return;
    }

    const targetBeforeMove = prevBoard[detected.toSquare];
    const isCapture = !!targetBeforeMove && !!detected.movedPiece && targetBeforeMove.color !== detected.movedPiece.color;
    const capturedPiece = isCapture ? targetBeforeMove : null;

    startMoveAnimation(detected.fromSquare, detected.toSquare, detected.movedPiece, capturedPiece);
  }, [game, fen, startMoveAnimation]);

  useEffect(() => {
    if (!isMobileDevice) return;
    setArrowAnnotations([]);
    setMarkedSquares(new Set());
    resetAnnotationGesture();
  }, [isMobileDevice, resetAnnotationGesture]);

  useEffect(() => {
    const onMouseUp = (event: MouseEvent) => {
      if (isMobileDevice) return;
      if (!rightMouseActiveRef.current) return;
      const targetSquare = getSquareFromPoint(event.clientX, event.clientY) || annotationDrag?.to || annotationFromRef.current;
      finalizeAnnotation(targetSquare);
    };

    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mouseup', onMouseUp);
      if (animationTimeoutRef.current) {
        window.clearTimeout(animationTimeoutRef.current);
      }
      if (captureAnimationTimeoutRef.current) {
        window.clearTimeout(captureAnimationTimeoutRef.current);
      }
      clearLongPressTimer();
    };
  }, [annotationDrag, clearLongPressTimer, finalizeAnnotation, getSquareFromPoint, isMobileDevice]);

  return (
    <>
      <div className="aspect-square w-full max-w-2xl mx-auto bg-border p-2 rounded-lg shadow-elegant">
        <div className="relative [direction:ltr]">
          <div className="pointer-events-none absolute inset-y-0 -left-3 z-10 flex w-4 flex-col items-center justify-between text-[11px] font-mono text-muted-foreground md:hidden">
            {ranks.map((rank) => (
              <span key={`left-rank-${rank}`} className="flex h-[12.5%] items-center">
                {rank}
              </span>
            ))}
          </div>

          <div className="pointer-events-none absolute inset-y-0 -right-3 z-10 flex w-4 flex-col items-center justify-between text-[11px] font-mono text-muted-foreground md:hidden">
            {ranks.map((rank) => (
              <span key={`right-rank-${rank}`} className="flex h-[12.5%] items-center">
                {rank}
              </span>
            ))}
          </div>

          <div className="relative grid grid-cols-8 gap-0 rounded overflow-hidden">
          {!isMobileDevice && renderedArrows.length > 0 && (
            <svg className="pointer-events-none absolute inset-0 z-10 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <marker id="board-arrow-head" markerWidth="4" markerHeight="4" refX="3.2" refY="2" orient="auto">
                  <path d="M0,0 L0,4 L4,2 z" fill="rgba(214, 177, 95, 0.9)" />
                </marker>
              </defs>
              {renderedArrows.map((arrow, idx) => {
                const from = toVisualPosition(arrow.from, orientation);
                const to = toVisualPosition(arrow.to, orientation);
                const x1 = from.x * 12.5 + 6.25;
                const y1 = from.y * 12.5 + 6.25;
                const x2 = to.x * 12.5 + 6.25;
                const y2 = to.y * 12.5 + 6.25;
                return (
                  <line
                    key={`${arrow.from}-${arrow.to}-${idx}`}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="rgba(214, 177, 95, 0.82)"
                    strokeWidth="1.15"
                    strokeLinecap="round"
                    markerEnd="url(#board-arrow-head)"
                  />
                );
              })}
            </svg>
          )}

          {ranks.map((rank, rankIndex) =>
            files.map((file, fileIndex) => {
              const square = (file + rank) as Square;
              const piece = game.get(square);
              const pieceImageSrc = getPieceImageSrc(piece);

              const chessFileIdx = FILES.indexOf(file as (typeof FILES)[number]);
              const chessRankIdx = rank - 1;
              const sensorActive = sensorOverlay != null && ((sensorOverlay[chessRankIdx] >> chessFileIdx) & 1) === 1;

              return (
                <div
                  key={square}
                  className={getSquareClasses(square, fileIndex, rankIndex)}
                  data-square={square}
                  onClick={() => handleSquareClick(square)}
                  onContextMenu={handleSquareContextMenu}
                  onMouseDown={(e) => handleSquareMouseDown(e, square)}
                  onMouseEnter={() => handleSquareMouseEnter(square)}
                  onMouseUp={(e) => handleSquareMouseUp(e, square)}
                  onTouchStart={() => handleSquareTouchStart(square)}
                  onTouchMove={handleSquareTouchMove}
                  onTouchEnd={handleSquareTouchEnd}
                  onTouchCancel={handleSquareTouchCancel}
                >
                  {piece && pieceImageSrc && !hiddenSquares.has(square) && (
                    <img
                      src={pieceImageSrc}
                      alt={`${piece.color}-${piece.type}`}
                      draggable={false}
                      loading="eager"
                      decoding="async"
                      className="h-[74%] w-[74%] object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)] transition-transform duration-150"
                    />
                  )}

                  {sensorOverlay != null && sensorActive && (
                    <div className="pointer-events-none absolute inset-0 z-10 transition-all duration-150 bg-emerald-400/20 shadow-[inset_0_0_0_2px_rgba(52,211,153,0.6)]" />
                  )}

                  <div className="absolute bottom-0 left-0 p-1 text-xs font-mono opacity-30 hidden md:block">
                    {square}
                  </div>
                </div>
              );
            })
          )}

          {capturedPieceAnimation && (
            <div
              className={`pointer-events-none absolute z-20 flex h-[12.5%] w-[12.5%] items-center justify-center ${capturedPieceAnimation.leftClass} ${capturedPieceAnimation.topClass}`}
              style={{
                transition: `transform ${CAPTURE_FALL_MS}ms cubic-bezier(0.1,0.9,0.24,1), opacity ${Math.max(260, CAPTURE_FALL_MS - 60)}ms ease, filter ${Math.max(260, CAPTURE_FALL_MS - 80)}ms ease`,
                transform: capturedPieceAnimation.active
                  ? 'translateY(260%) rotate(48deg) scale(0.66)'
                  : 'translateY(0%) rotate(0deg) scale(1)',
                opacity: capturedPieceAnimation.active ? 0 : 1,
                filter: capturedPieceAnimation.active ? 'blur(3.2px) saturate(0.75)' : 'blur(0px) saturate(1)',
              }}
            >
              <img
                src={capturedPieceAnimation.imageSrc}
                alt="captured-piece"
                draggable={false}
                loading="eager"
                decoding="async"
                className="h-[74%] w-[74%] object-contain drop-shadow-[0_8px_18px_rgba(0,0,0,0.6)]"
              />
            </div>
          )}

          {stickerConfig && (
            <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center">
              <div
                className={`rounded-xl border border-white/40 bg-gradient-to-r ${stickerConfig.bgClass} px-10 py-5 shadow-[0_10px_40px_rgba(0,0,0,0.18)]`}
                style={{ transform: 'none' }}
              >
                <span
                  className={`font-amiri text-[clamp(3.8rem,14vw,7.8rem)] font-extrabold tracking-normal ${stickerConfig.textClass}`}
                  style={{ textShadow: '0 2px 10px rgba(0,0,0,0.08)' }}
                >
                  {stickerConfig.label}
                </span>
              </div>
            </div>
          )}

          {moveAnimation && (
            <div
              className={`pointer-events-none absolute z-30 flex h-[12.5%] w-[12.5%] items-center justify-center will-change-transform transition-transform duration-[620ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${moveAnimation.fromLeftClass} ${moveAnimation.fromTopClass} ${
                moveAnimation.active ? `${moveAnimation.deltaXClass} ${moveAnimation.deltaYClass}` : ''
              }`}
            >
              <img
                src={moveAnimation.imageSrc}
                alt="moving-piece"
                draggable={false}
                loading="eager"
                decoding="async"
                className="h-[74%] w-[74%] object-contain drop-shadow-[0_2px_4px_rgba(0,0,0,0.35)]"
              />
            </div>
          )}

          {!isMobileDevice && (arrowAnnotations.length > 0 || markedSquares.size > 0) && (
            <div className="pointer-events-none absolute top-2 left-2 z-50">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="pointer-events-auto h-7 px-2 text-[11px] font-cairo"
                onClick={() => {
                  setArrowAnnotations([]);
                  setMarkedSquares(new Set());
                  resetAnnotationGesture();
                }}
              >
                مسح الرسم
              </Button>
            </div>
          )}
          </div>
        </div>

        <div className="flex justify-between mt-1 px-1.5 text-[11px] leading-none text-muted-foreground font-mono [direction:ltr]">
          {files.map((file) => (
            <span key={file}>{file}</span>
          ))}
        </div>
      </div>

      <Dialog
        open={!!pendingPromotion}
        onOpenChange={(open) => {
          if (!open) setPendingPromotion(null);
        }}
      >
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="font-cairo">اختيار ترقية البيدق</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            {PROMOTION_TARGETS.map((target) => (
              <Button
                key={target.type}
                variant="outline"
                className="h-24 flex flex-col gap-2"
                onClick={() => handlePromotionChoice(target.type)}
              >
                <img
                  src={getPromotionImageSrc(pendingPromotion?.color || 'w', target.type)}
                  alt={target.label}
                  className="h-10 w-10 object-contain"
                />
                <span className="font-cairo">{target.label}</span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ChessBoard;
