import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
  private isConnected = false;
  private onConnectionChange: ((connected: boolean) => void) | null = null;
  private clockUpdateCallback: ((data: any) => void) | null = null;
  private turnUpdateCallback: ((data: any) => void) | null = null;
  private moveMadeCallback: ((data: any) => void) | null = null;
  private gameTimeoutCallback: ((data: any) => void) | null = null;

  connect(token: string) {
    if (this.socket && this.isConnected) {
      return this.socket;
    }

    // Connect directly to the namespace
    this.socket = io('http://localhost:3000/friends', {
      auth: {
        token
      },
      query: {
        token
      },
      transports: ['websocket', 'polling']
    });

    this.socket.on('connect', () => {
      console.log('Connected to WebSocket server (friends namespace)');
      this.isConnected = true;
      if (this.onConnectionChange) {
        this.onConnectionChange(true);
      }
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from WebSocket server (friends namespace)');
      this.isConnected = false;
      if (this.onConnectionChange) {
        this.onConnectionChange(false);
      }
    });

    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    // Add event listeners for debugging
    this.socket.on('clockUpdate', (data) => {
      console.log('=== SOCKET SERVICE: Received clockUpdate ===');
      console.log('SocketService received clockUpdate:', data);
      console.log('=== SOCKET SERVICE: Data type check ===', {
        whiteTimeLeft: typeof data.whiteTimeLeft,
        blackTimeLeft: typeof data.blackTimeLeft,
        currentTurn: typeof data.currentTurn
      });
      console.log('=== SOCKET SERVICE: Socket connection status ===', {
        connected: this.socket?.connected,
        id: this.socket?.id
      });
      if (this.clockUpdateCallback) {
        console.log('=== SOCKET SERVICE: Calling onClockUpdate callback ===');
        this.clockUpdateCallback(data);
        console.log('=== SOCKET SERVICE: onClockUpdate callback executed ===');
      } else {
        console.log('=== SOCKET SERVICE: No onClockUpdate callback registered ===');
      }
    });

    this.socket.on('turnUpdate', (data) => {
      console.log('=== SOCKET SERVICE: Received turnUpdate ===');
      console.log('SocketService received turnUpdate:', data);
      if (this.turnUpdateCallback) {
        console.log('=== SOCKET SERVICE: Calling onTurnUpdate callback ===');
        this.turnUpdateCallback(data);
        console.log('=== SOCKET SERVICE: onTurnUpdate callback executed ===');
      } else {
        console.log('=== SOCKET SERVICE: No onTurnUpdate callback registered ===');
      }
    });

    this.socket.on('moveMade', (data) => {
      console.log('=== SOCKET SERVICE: Received moveMade ===');
      console.log('SocketService received moveMade:', data);
      if (this.moveMadeCallback) {
        console.log('=== SOCKET SERVICE: Calling onMoveMade callback ===');
        this.moveMadeCallback(data);
        console.log('=== SOCKET SERVICE: onMoveMade callback executed ===');
      } else {
        console.log('=== SOCKET SERVICE: No onMoveMade callback registered ===');
      }
    });

    this.socket.on('gameTimeout', (data) => {
      console.log('=== SOCKET SERVICE: Received gameTimeout ===');
      console.log('SocketService received gameTimeout:', data);
      if (this.gameTimeoutCallback) {
        console.log('=== SOCKET SERVICE: Calling onGameTimeout callback ===');
        this.gameTimeoutCallback(data);
        console.log('=== SOCKET SERVICE: onGameTimeout callback executed ===');
      } else {
        console.log('=== SOCKET SERVICE: No onGameTimeout callback registered ===');
      }
    });

    return this.socket;
  }

  setConnectionCallback(callback: (connected: boolean) => void) {
    this.onConnectionChange = callback;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  isSocketConnected(): boolean {
    return this.isConnected;
  }

  // Game events
  joinGameRoom(gameId: string) {
    if (this.socket) {
      console.log('=== SOCKET SERVICE: Joining game room ===');
      console.log('SocketService: Joining game room:', gameId);
      this.socket.emit('joinGameRoom', { gameId });
      console.log('=== SOCKET SERVICE: Join game room request sent ===');
    } else {
      console.error('SocketService: Cannot join game room, socket not connected');
    }
  }

  leaveGameRoom(gameId: string) {
    if (this.socket) {
      console.log('=== SOCKET SERVICE: Leaving game room ===');
      console.log('SocketService: Leaving game room:', gameId);
      this.socket.emit('leaveGameRoom', { gameId });
      console.log('=== SOCKET SERVICE: Leave game room request sent ===');
    } else {
      console.error('SocketService: Cannot leave game room, socket not connected');
    }
  }

  sendMove(moveData: {
    gameId: string;
    from: string;
    to: string;
    promotion?: string;
    san: string;
    fen: string;
    movedBy: string;
  }) {
    if (this.socket) {
      console.log('=== SOCKET SERVICE: Sending move ===');
      console.log('SocketService: Sending move:', moveData);
      this.socket.emit('move', moveData);
      console.log('=== SOCKET SERVICE: Move sent ===');
    } else {
      console.error('SocketService: Cannot send move, socket not connected');
    }
  }

  // Event listeners
  onClockUpdate(callback: (data: { whiteTimeLeft: number; blackTimeLeft: number; currentTurn: string }) => void) {
    console.log('=== SOCKET SERVICE: Setting up onClockUpdate listener ===');
    this.clockUpdateCallback = callback;
    console.log('=== SOCKET SERVICE: onClockUpdate listener set up ===');
  }

  onTurnUpdate(callback: (data: { currentTurn: string }) => void) {
    console.log('=== SOCKET SERVICE: Setting up onTurnUpdate listener ===');
    this.turnUpdateCallback = callback;
    console.log('=== SOCKET SERVICE: onTurnUpdate listener set up ===');
  }

  onMoveMade(callback: (data: { san: string; fen: string; movedBy: string; isPhysicalMove?: boolean; from?: string; to?: string; uci?: string }) => void) {
    console.log('=== SOCKET SERVICE: Setting up onMoveMade listener ===');
    this.moveMadeCallback = callback;
    console.log('=== SOCKET SERVICE: onMoveMade listener set up ===');
  }

  onGameTimeout(callback: (data: { winner: string; reason?: string }) => void) {
    console.log('=== SOCKET SERVICE: Setting up onGameTimeout listener ===');
    this.gameTimeoutCallback = callback;
    console.log('=== SOCKET SERVICE: onGameTimeout listener set up ===');
  }

  // Remove event listeners
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
}

export const socketService = new SocketService(); 