import { Chess } from 'chess.js';

/**
 * إنشاء لعبة شطرنج جديدة
 */
export function createNewGame() {
  return new Chess();
}

/**
 * التحقق من صحة الحركة
 */
export function isValidMove(game, from, to, promotion = null) {
  try {
    const moves = game.moves({ square: from, verbose: true });
    return moves.some(move => 
      move.to === to && 
      (!promotion || move.promotion === promotion)
    );
  } catch (error) {
    console.error('Error validating move:', error);
    return false;
  }
}

/**
 * تنفيذ حركة في اللعبة
 */
export function makeMove(game, from, to, promotion = null) {
  try {
    const move = {
      from,
      to,
      promotion: promotion || 'q' // ترقية افتراضية إلى وزير
    };

    const result = game.move(move);
    return result;
  } catch (error) {
    console.error('Error making move:', error);
    return null;
  }
}

/**
 * التحقق من حالة اللعبة
 */
export function getGameStatus(game) {
  if (game.isCheckmate()) {
    return 'checkmate';
  } else if (game.isDraw()) {
    return 'draw';
  } else if (game.isCheck()) {
    return 'check';
  } else if (game.isStalemate()) {
    return 'stalemate';
  } else if (game.isThreefoldRepetition()) {
    return 'threefold';
  } else if (game.isInsufficientMaterial()) {
    return 'insufficient';
  }
  return 'ongoing';
}

/**
 * الحصول على الحركات القانونية
 */
export function getLegalMoves(game, square = null) {
  try {
    if (square) {
      return game.moves({ square, verbose: true });
    }
    return game.moves({ verbose: true });
  } catch (error) {
    console.error('Error getting legal moves:', error);
    return [];
  }
}

/**
 * الحصول على FEN الحالي
 */
export function getCurrentFEN(game) {
  return game.fen();
}

/**
 * تحميل موقف من FEN
 */
export function loadFromFEN(fen) {
  try {
    const game = new Chess(fen);
    return game;
  } catch (error) {
    console.error('Error loading FEN:', error);
    return null;
  }
}

/**
 * الحصول على تاريخ الحركات
 */
export function getMoveHistory(game) {
  return game.history({ verbose: true });
}

/**
 * التراجع عن آخر حركة
 */
export function undoLastMove(game) {
  try {
    return game.undo();
  } catch (error) {
    console.error('Error undoing move:', error);
    return null;
  }
}

/**
 * إعادة تعيين اللعبة
 */
export function resetGame(game) {
  game.reset();
  return game;
}

/**
 * الحصول على القطع في المربع
 */
export function getPieceAt(game, square) {
  return game.get(square);
}

/**
 * التحقق من دور اللاعب
 */
export function getCurrentTurn(game) {
  return game.turn();
}

/**
 * الحصول على معلومات المربع
 */
export function getSquareInfo(game, square) {
  const piece = game.get(square);
  if (!piece) return null;

  const moves = game.moves({ square, verbose: true });
  return {
    piece,
    legalMoves: moves,
    isAttacked: game.isAttacked(square, piece.color === 'w' ? 'b' : 'w')
  };
} 