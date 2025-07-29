import React, { useState, useCallback } from 'react';
import { Chess, Square } from 'chess.js';

interface ChessBoardProps {
  game: Chess;
  onMove: (from: Square, to: Square) => boolean;
  orientation: 'white' | 'black';
  allowMoves: boolean;
}

const pieceSymbols: { [key: string]: string } = {
  wK: '♔', wQ: '♕', wR: '♖', wB: '♗', wN: '♘', wP: '♙',
  bK: '♚', bQ: '♛', bR: '♜', bB: '♝', bN: '♞', bP: '♟'
};

const ChessBoard: React.FC<ChessBoardProps> = ({ game, onMove, orientation, allowMoves }) => {
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [possibleMoves, setPossibleMoves] = useState<Square[]>([]);

  const board = game.board();
  // دائماً نستخدم الإحداثيات الحقيقية
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = [8, 7, 6, 5, 4, 3, 2, 1];

  const handleSquareClick = useCallback((square: Square) => {
    if (!allowMoves) return;

    if (selectedSquare) {
      if (selectedSquare === square) {
        // Clicking same square deselects
        setSelectedSquare(null);
        setPossibleMoves([]);
      } else if (possibleMoves.includes(square)) {
        // Valid move
        const moveResult = onMove(selectedSquare, square);
        if (moveResult) {
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
  }, [selectedSquare, possibleMoves, allowMoves, game, onMove]);

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

  const getPieceSymbol = (piece: any) => {
    if (!piece) return '';
    const key = piece.color + piece.type.toUpperCase();
    return pieceSymbols[key] || '';
  };

  return (
    <div className="aspect-square w-full max-w-2xl mx-auto bg-border p-2 rounded-lg shadow-elegant">
      <div className={`grid grid-cols-8 gap-0 rounded overflow-hidden transform ${orientation === 'black' ? 'rotate-180' : ''}`}>
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
                <span className={`drop-shadow-sm transform ${orientation === 'black' ? 'rotate-180' : ''}`}>
                  {piece && getPieceSymbol(piece)}
                </span>
                
                {/* Square label */}
                <div className={`absolute bottom-0 left-0 text-xs font-mono opacity-30 p-1 transform ${orientation === 'black' ? 'rotate-180' : ''}`}>
                  {square}
                </div>
              </div>
            );
          })
        )}
      </div>
      
      {/* Board coordinates */}
      <div className={`flex justify-between mt-2 px-2 text-sm text-muted-foreground font-mono transform ${orientation === 'black' ? 'rotate-180' : ''}`}>
        {files.map(file => (
          <span key={file}>{file}</span>
        ))}
      </div>
    </div>
  );
};

export default ChessBoard;