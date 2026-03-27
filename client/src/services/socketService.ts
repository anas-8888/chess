import { io, Socket } from 'socket.io-client';
import { SOCKET_BASE_URL } from '@/config/urls';

type ClockUpdatePayload = {
  whiteTimeLeft: number;
  blackTimeLeft: number;
  currentTurn: string;
};

type TurnUpdatePayload = {
  currentTurn: string;
};

type GameEndPayload = {
  reason: string;
  winner?: string;
  winnerId?: number;
  loserId?: number;
  ratingChanges?: {
    white?: {
      userId: number;
      delta: number;
      oldRating: number;
      newRating: number;
      isPlacement?: boolean;
      kFactor?: number;
      gamesPlayed?: number;
    };
    black?: {
      userId: number;
      delta: number;
      oldRating: number;
      newRating: number;
      isPlacement?: boolean;
      kFactor?: number;
      gamesPlayed?: number;
    };
  } | null;
};

type GameTimeoutPayload = {
  winner: string;
  reason?: string;
};

type MoveConfirmedPayload = {
  gameId: string;
  move: string;
  timestamp: number;
};

type MoveMadePayload = {
  gameId?: string;
  move?: string;
  san?: string;
  fen?: string;
  movedBy?: string;
  currentTurn?: string;
  timestamp?: number;
};

type ResignAck = {
  success: boolean;
  message?: string;
};

type QuickMatchJoinedPayload = {
  joined: boolean;
  alreadyQueued: boolean;
  range: number;
  waitSeconds: number;
  timeMinutes: number;
  incrementSeconds: number;
};

type QuickMatchSearchProgressPayload = {
  range: number;
  waitSeconds: number;
  timeMinutes: number;
  incrementSeconds: number;
};

type QuickMatchFoundPayload = {
  gameId: number;
  playerColor: 'white' | 'black';
  opponent: {
    id: number;
    username: string;
    rank: number;
    thumbnail?: string;
  };
  timeMinutes: number;
  incrementSeconds: number;
  initialTime: number;
  countdownSeconds: number;
};

type QuickMatchErrorPayload = {
  message: string;
};

type RejoinGamePayload = {
  gameId: string | number;
  status?: string;
  gameType?: string;
};

type GameChatMessagePayload = {
  id: number;
  gameId: number;
  userId: number;
  username: string;
  thumbnail?: string | null;
  message: string;
  createdAt: string;
};

class SocketService {
  private static readonly MOVE_MADE_DEDUP_WINDOW_MS = 1800;

  private socket: Socket | null = null;
  private isConnected = false;
  private activeGameRoomId: string | null = null;
  private connectionCallbacks = new Set<(connected: boolean) => void>();
  private recentMoveMadeEvents = new Map<string, number>();

  private clockUpdateCallback: ((data: ClockUpdatePayload) => void) | null = null;
  private turnUpdateCallback: ((data: TurnUpdatePayload) => void) | null = null;
  private moveMadeCallback: ((data: unknown) => void) | null = null;
  private gameTimeoutCallback: ((data: GameTimeoutPayload) => void) | null = null;
  private gameEndCallback: ((data: GameEndPayload) => void) | null = null;
  private moveConfirmedCallback: ((data: MoveConfirmedPayload) => void) | null = null;
  private quickMatchJoinedCallback: ((data: QuickMatchJoinedPayload) => void) | null = null;
  private quickMatchSearchProgressCallback: ((data: QuickMatchSearchProgressPayload) => void) | null = null;
  private quickMatchFoundCallback: ((data: QuickMatchFoundPayload) => void) | null = null;
  private quickMatchErrorCallback: ((data: QuickMatchErrorPayload) => void) | null = null;
  private quickMatchCancelledCallback: ((data: { removed: boolean }) => void) | null = null;
  private quickMatchNotFoundCallback: ((data: { message: string; waitSeconds?: number }) => void) | null = null;
  private gameChatMessageCallback: ((data: GameChatMessagePayload) => void) | null = null;
  private rejoinGameCallback: ((data: RejoinGamePayload) => void) | null = null;

  private toMoveMadePayload(data: unknown): MoveMadePayload | null {
    if (!data || typeof data !== 'object') return null;
    return data as MoveMadePayload;
  }

  private buildMoveMadeKey(payload: MoveMadePayload): string | null {
    const gameId = typeof payload.gameId === 'string' ? payload.gameId : '';
    const fen = typeof payload.fen === 'string' ? payload.fen : '';
    const san = typeof payload.san === 'string'
      ? payload.san
      : typeof payload.move === 'string'
        ? payload.move
        : '';
    const movedBy = typeof payload.movedBy === 'string' ? payload.movedBy : '';

    if (!gameId || !fen || !san || !movedBy) {
      return null;
    }

    return `${gameId}::${movedBy}::${san}::${fen}`;
  }

  private pruneRecentMoveMadeEvents(now: number) {
    for (const [key, seenAt] of this.recentMoveMadeEvents.entries()) {
      if (now - seenAt > SocketService.MOVE_MADE_DEDUP_WINDOW_MS) {
        this.recentMoveMadeEvents.delete(key);
      }
    }
  }

  private shouldDropDuplicateMoveMade(data: unknown): boolean {
    const payload = this.toMoveMadePayload(data);
    if (!payload) return false;

    const key = this.buildMoveMadeKey(payload);
    if (!key) return false;

    const now = Date.now();
    this.pruneRecentMoveMadeEvents(now);

    const lastSeen = this.recentMoveMadeEvents.get(key);
    if (typeof lastSeen === 'number' && now - lastSeen <= SocketService.MOVE_MADE_DEDUP_WINDOW_MS) {
      return true;
    }

    this.recentMoveMadeEvents.set(key, now);
    return false;
  }

  connect(token: string) {
    if (this.socket) {
      if (!this.socket.connected) {
        this.socket.auth = { token };
        this.socket.io.opts.query = { token };
        this.socket.connect();
      }
      return this.socket;
    }

    this.socket = io(`${SOCKET_BASE_URL}/friends`, {
      auth: { token },
      query: { token },
      path: '/socket.io',
      transports: ['polling'],
      upgrade: false,
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      forceNew: false,
    });

    this.socket.on('connect', () => {
      this.isConnected = true;
      for (const callback of this.connectionCallbacks) {
        callback(true);
      }
      if (this.activeGameRoomId) {
        this.socket?.emit('joinGameRoom', { gameId: this.activeGameRoomId });
      }
    });

    this.socket.on('disconnect', () => {
      this.isConnected = false;
      for (const callback of this.connectionCallbacks) {
        callback(false);
      }
    });

    this.socket.on('clockUpdate', (data: ClockUpdatePayload) => {
      this.clockUpdateCallback?.(data);
    });

    this.socket.on('turnUpdate', (data: TurnUpdatePayload) => {
      this.turnUpdateCallback?.(data);
    });

    this.socket.on('moveMade', (data: unknown) => {
      if (this.shouldDropDuplicateMoveMade(data)) {
        return;
      }
      this.moveMadeCallback?.(data);
    });

    this.socket.on('gameTimeout', (data: GameTimeoutPayload) => {
      this.gameTimeoutCallback?.(data);
    });

    this.socket.on('gameEnd', (data: GameEndPayload) => {
      this.gameEndCallback?.(data);
    });

    this.socket.on('moveConfirmed', (data: MoveConfirmedPayload) => {
      this.moveConfirmedCallback?.(data);
    });

    this.socket.on('quickMatch:joined', (data: QuickMatchJoinedPayload) => {
      this.quickMatchJoinedCallback?.(data);
    });

    this.socket.on('quickMatch:searchProgress', (data: QuickMatchSearchProgressPayload) => {
      this.quickMatchSearchProgressCallback?.(data);
    });

    this.socket.on('quickMatch:found', (data: QuickMatchFoundPayload) => {
      this.quickMatchFoundCallback?.(data);
    });

    this.socket.on('quickMatch:error', (data: QuickMatchErrorPayload) => {
      this.quickMatchErrorCallback?.(data);
    });

    this.socket.on('quickMatch:cancelled', (data: { removed: boolean }) => {
      this.quickMatchCancelledCallback?.(data);
    });

    this.socket.on('quickMatch:notFound', (data: { message: string; waitSeconds?: number }) => {
      this.quickMatchNotFoundCallback?.(data);
    });

    this.socket.on('rejoin_game', (data: RejoinGamePayload) => {
      this.rejoinGameCallback?.(data);
    });

    this.socket.on('gameChatMessage', (data: GameChatMessagePayload) => {
      this.gameChatMessageCallback?.(data);
    });

    return this.socket;
  }

  setConnectionCallback(callback: (connected: boolean) => void) {
    this.connectionCallbacks.add(callback);
    return () => {
      this.connectionCallbacks.delete(callback);
    };
  }

  disconnect() {
    if (!this.socket) return;
    this.socket.disconnect();
    this.socket = null;
    this.isConnected = false;
    this.recentMoveMadeEvents.clear();
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  isSocketConnected(): boolean {
    return this.isConnected;
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  getSocketId(): string | undefined {
    return this.socket?.id;
  }

  joinGameRoom(gameId: string) {
    this.activeGameRoomId = gameId;
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('joinGameRoom', { gameId });
  }

  leaveGameRoom(gameId: string) {
    if (this.activeGameRoomId === gameId) {
      this.activeGameRoomId = null;
    }
    this.recentMoveMadeEvents.clear();
    if (!this.socket || !this.socket.connected) return;
    this.socket.emit('leaveGameRoom', { gameId });
  }

  sendMove(moveData: {
    gameId: string;
    from: string;
    to: string;
    promotion?: string;
    san: string;
    fen: string;
    movedBy: string;
    currentTurn: string;
  }) {
    if (!this.socket || !this.socket.connected) return false;
    this.socket.emit('move', moveData);
    return true;
  }

  sendResign(gameId: string): Promise<ResignAck> {
    return new Promise((resolve) => {
      if (!this.socket || !this.socket.connected) {
        resolve({ success: false, message: 'Socket is not connected' });
        return;
      }

      this.socket.emit('resign', { gameId }, (ack?: ResignAck) => {
        if (!ack) {
          resolve({ success: false, message: 'No response from server' });
          return;
        }
        resolve(ack);
      });
    });
  }

  sendGameChatMessage(payload: { gameId: string; message: string }): Promise<{ success: boolean; data?: GameChatMessagePayload; message?: string }> {
    return new Promise((resolve) => {
      if (!this.socket || !this.socket.connected) {
        resolve({ success: false, message: 'Socket is not connected' });
        return;
      }
      this.socket.emit('gameChat:send', payload, (ack?: { success: boolean; data?: GameChatMessagePayload; message?: string }) => {
        if (!ack) {
          resolve({ success: false, message: 'No response from server' });
          return;
        }
        resolve(ack);
      });
    });
  }

  onClockUpdate(callback: (data: ClockUpdatePayload) => void) {
    this.clockUpdateCallback = callback;
  }

  onTurnUpdate(callback: (data: TurnUpdatePayload) => void) {
    this.turnUpdateCallback = callback;
  }

  onMoveMade(callback: (data: unknown) => void) {
    this.moveMadeCallback = callback;
  }

  onGameTimeout(callback: (data: GameTimeoutPayload) => void) {
    this.gameTimeoutCallback = callback;
  }

  onGameEnd(callback: (data: GameEndPayload) => void) {
    this.gameEndCallback = callback;
  }

  onMoveConfirmed(callback: (data: MoveConfirmedPayload) => void) {
    this.moveConfirmedCallback = callback;
  }

  onQuickMatchJoined(callback: (data: QuickMatchJoinedPayload) => void) {
    this.quickMatchJoinedCallback = callback;
  }

  onQuickMatchSearchProgress(callback: (data: QuickMatchSearchProgressPayload) => void) {
    this.quickMatchSearchProgressCallback = callback;
  }

  onQuickMatchFound(callback: (data: QuickMatchFoundPayload) => void) {
    this.quickMatchFoundCallback = callback;
  }

  onQuickMatchError(callback: (data: QuickMatchErrorPayload) => void) {
    this.quickMatchErrorCallback = callback;
  }

  onQuickMatchCancelled(callback: (data: { removed: boolean }) => void) {
    this.quickMatchCancelledCallback = callback;
  }

  onQuickMatchNotFound(callback: (data: { message: string; waitSeconds?: number }) => void) {
    this.quickMatchNotFoundCallback = callback;
  }

  onRejoinGame(callback: (data: RejoinGamePayload) => void) {
    this.rejoinGameCallback = callback;
  }

  onGameChatMessage(callback: (data: GameChatMessagePayload) => void) {
    this.gameChatMessageCallback = callback;
  }

  offClockUpdate() {
    this.clockUpdateCallback = null;
  }

  offTurnUpdate() {
    this.turnUpdateCallback = null;
  }

  offMoveMade() {
    this.moveMadeCallback = null;
  }

  offGameTimeout() {
    this.gameTimeoutCallback = null;
  }

  offGameEnd() {
    this.gameEndCallback = null;
  }

  offMoveConfirmed() {
    this.moveConfirmedCallback = null;
  }

  offQuickMatchJoined() {
    this.quickMatchJoinedCallback = null;
  }

  offQuickMatchSearchProgress() {
    this.quickMatchSearchProgressCallback = null;
  }

  offQuickMatchFound() {
    this.quickMatchFoundCallback = null;
  }

  offQuickMatchError() {
    this.quickMatchErrorCallback = null;
  }

  offQuickMatchCancelled() {
    this.quickMatchCancelledCallback = null;
  }

  offQuickMatchNotFound() {
    this.quickMatchNotFoundCallback = null;
  }

  offRejoinGame() {
    this.rejoinGameCallback = null;
  }

  offGameChatMessage() {
    this.gameChatMessageCallback = null;
  }

  joinQuickMatchQueue(payload: {
    rating?: number;
    timeMinutes: number;
    incrementSeconds?: number;
    playMethod?: 'phone' | 'physical_board';
  }) {
    if (!this.socket || !this.socket.connected) return false;
    this.socket.emit('quickMatch:join', payload);
    return true;
  }

  cancelQuickMatchQueue() {
    if (!this.socket || !this.socket.connected) return false;
    this.socket.emit('quickMatch:cancel');
    return true;
  }
}

export const socketService = new SocketService();
