import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Chess, Square, Piece } from 'chess.js';

interface ChessBoardProps {
  game: Chess;
  onMove: (from: Square, to: Square) => boolean;
  orientation: 'white' | 'black';
  allowMoves: boolean;
}

const pieceSymbols: Record<Uppercase<Piece['type']>, string> = {
  K: '♚',
  Q: '♛',
  R: '♜',
  B: '♝',
  N: '♞',
  P: '♟',
};

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const RANKS = [8, 7, 6, 5, 4, 3, 2, 1] as const;
const MOVE_ANIMATION_MS = 620;
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

type MoveAnimation = {
  symbol: string;
  pieceClass: string;
  fromLeftClass: string;
  fromTopClass: string;
  deltaXClass: string;
  deltaYClass: string;
  toSquare: Square;
  active: boolean;
};

type BoardSnapshot = Record<Square, Piece | undefined>;

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

  // Prefer exact same type+color target, fallback to same color (promotion/capture cases).
  const exactTarget = toCandidates.find((square) => isSamePiece(next[square], movedPiece));
  const colorTarget = toCandidates.find((square) => next[square]?.color === movedPiece.color);
  const toSquare = exactTarget ?? colorTarget ?? toCandidates[0];

  return { fromSquare, toSquare, movedPiece };
};


const ChessBoard: React.FC<ChessBoardProps> = ({ game, onMove, orientation, allowMoves }) => {
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<Square[]>([]);
  const [moveAnimation, setMoveAnimation] = useState<MoveAnimation | null>(null);
  const previousBoardRef = useRef<BoardSnapshot | null>(null);
  const animationTimeoutRef = useRef<number | null>(null);
  const skipDetectedMoveRef = useRef<string | null>(null);

  const files = useMemo(
    () => (orientation === 'white' ? [...FILES] : [...FILES].reverse()),
    [orientation]
  );
  const ranks = useMemo(
    () => (orientation === 'white' ? [...RANKS] : [...RANKS].reverse()),
    [orientation]
  );

  const getSquareColor = (fileIndex: number, rankIndex: number) => {
    const isLight = (fileIndex + rankIndex) % 2 === 0;
    return isLight ? 'bg-chess-light' : 'bg-chess-dark';
  };

  const getSquareClasses = (square: Square, fileIndex: number, rankIndex: number) => {
    const baseClasses = `aspect-square flex items-center justify-center text-4xl cursor-pointer select-none transition-all duration-200 ${getSquareColor(fileIndex, rankIndex)}`;
    
    if (selectedSquare === square) {
      return `${baseClasses} bg-chess-highlight ring-2 ring-primary`;
    }
    
    if (possibleMoves.includes(square)) {
      return `${baseClasses} relative before:absolute before:inset-2 before:bg-primary/40 before:rounded-full before:content-['']`;
    }
    
    if (game.inCheck() && game.get(square)?.type === 'k' && game.get(square)?.color === game.turn()) {
      return `${baseClasses} bg-chess-check animate-pulse`;
    }
    
    return `${baseClasses} hover:bg-primary/10`;
  };

  const getPieceSymbol = (piece: Piece | null | undefined) => {
    if (!piece) return '';
    return pieceSymbols[piece.type.toUpperCase() as Uppercase<Piece['type']>] || '';
  };

  const getPieceClasses = (piece: Piece | null | undefined) => {
    if (!piece) return '';
    return piece.color === 'w'
      ? 'text-primary drop-shadow-[0_1px_1px_rgba(15,23,42,0.6)]'
      : 'text-slate-900 drop-shadow-[0_1px_0_rgba(226,232,240,0.25)]';
  };

  const startMoveAnimation = useCallback(
    (fromSquare: Square, toSquare: Square, movedPiece: Piece | null | undefined) => {
      if (!movedPiece) return;
      const from = toVisualPosition(fromSquare, orientation);
      const to = toVisualPosition(toSquare, orientation);

      setMoveAnimation({
        symbol: getPieceSymbol(movedPiece),
        pieceClass: getPieceClasses(movedPiece),
        fromLeftClass: getPositionClass(from.x, 'left'),
        fromTopClass: getPositionClass(from.y, 'top'),
        deltaXClass: getDeltaClass(to.x - from.x, 'x'),
        deltaYClass: getDeltaClass(to.y - from.y, 'y'),
        toSquare,
        active: false,
      });

      requestAnimationFrame(() => {
        setMoveAnimation(current => (current ? { ...current, active: true } : current));
      });

      if (animationTimeoutRef.current) {
        window.clearTimeout(animationTimeoutRef.current);
      }
      animationTimeoutRef.current = window.setTimeout(() => {
        setMoveAnimation(null);
      }, MOVE_ANIMATION_MS + 50);
    },
    [orientation]
  );

  const handleSquareClick = useCallback((square: Square) => {
    if (!allowMoves) return;

    if (selectedSquare) {
      if (selectedSquare === square) {
        // Clicking same square deselects
        setSelectedSquare(null);
        setPossibleMoves([]);
      } else if (possibleMoves.includes(square)) {
        // Valid move
        const movingPiece = game.get(selectedSquare);
        const moveResult = onMove(selectedSquare, square);
        if (moveResult) {
          skipDetectedMoveRef.current = `${selectedSquare}-${square}`;
          startMoveAnimation(selectedSquare, square, movingPiece);
          setSelectedSquare(null);
          setPossibleMoves([]);
        }
      } else {
        // Select new piece
        const piece = game.get(square);
        if (piece && piece.color === game.turn()) {
          setSelectedSquare(square);
          const moves = game.moves({ square, verbose: true });
          setPossibleMoves(moves.map(move => move.to as Square));
        } else {
          setSelectedSquare(null);
          setPossibleMoves([]);
        }
      }
    } else {
      // First selection
      const piece = game.get(square);
      if (piece && piece.color === game.turn()) {
        setSelectedSquare(square);
        const moves = game.moves({ square, verbose: true });
        setPossibleMoves(moves.map(move => move.to as Square));
      }
    }
  }, [selectedSquare, possibleMoves, allowMoves, game, onMove, startMoveAnimation]);

  const fen = game.fen();

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

    startMoveAnimation(detected.fromSquare, detected.toSquare, detected.movedPiece);
  }, [game, fen, startMoveAnimation]);

  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) {
        window.clearTimeout(animationTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className="aspect-square w-full max-w-2xl mx-auto bg-border p-2 rounded-lg shadow-elegant">
      <div className="relative grid grid-cols-8 gap-0 rounded overflow-hidden [direction:ltr]">
        {ranks.map((rank, rankIndex) =>
          files.map((file, fileIndex) => {
            const square = (file + rank) as Square;
            const piece = game.get(square);
            
            return (
              <div
                key={square}
                className={getSquareClasses(square, fileIndex, rankIndex)}
                onClick={() => handleSquareClick(square)}
              >
                <span
                  className={`${getPieceClasses(piece)} ${
                    moveAnimation?.toSquare === square ? 'opacity-0' : ''
                  }`}
                >
                  {piece && getPieceSymbol(piece)}
                </span>
                
                {/* Square label */}
                <div className="absolute bottom-0 left-0 text-xs font-mono opacity-30 p-1">
                  {square}
                </div>
              </div>
            );
          })
        )}

        {moveAnimation && (
          <div
            className={`pointer-events-none absolute z-20 flex h-[12.5%] w-[12.5%] items-center justify-center text-4xl transition-transform duration-[620ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${moveAnimation.fromLeftClass} ${moveAnimation.fromTopClass} ${
              moveAnimation.active ? `${moveAnimation.deltaXClass} ${moveAnimation.deltaYClass}` : ''
            }`}
          >
            <span className={moveAnimation.pieceClass}>
              {moveAnimation.symbol}
            </span>
          </div>
        )}
      </div>
      
      {/* Board coordinates */}
      <div className="flex justify-between mt-2 px-2 text-sm text-muted-foreground font-mono [direction:ltr]">
        {files.map(file => (
          <span key={file}>{file}</span>
        ))}
      </div>
    </div>
  );
};

export default ChessBoard;
