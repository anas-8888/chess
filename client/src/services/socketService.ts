import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
  private isConnected = false;
  private onConnectionChange: ((connected: boolean) => void) | null = null;

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
            id: this.socket?.id,
            rooms: this.socket?.rooms
          });
          if (this.onClockUpdate) {
            console.log('=== SOCKET SERVICE: Calling onClockUpdate callback ===');
            this.onClockUpdate(data);
            console.log('=== SOCKET SERVICE: onClockUpdate callback executed ===');
          } else {
            console.log('=== SOCKET SERVICE: No onClockUpdate callback registered ===');
          }
        });

            this.socket.on('turnUpdate', (data) => {
          console.log('=== SOCKET SERVICE: Received turnUpdate ===');
          console.log('SocketService received turnUpdate:', data);
          if (this.onTurnUpdate) {
            console.log('=== SOCKET SERVICE: Calling onTurnUpdate callback ===');
            this.onTurnUpdate(data);
            console.log('=== SOCKET SERVICE: onTurnUpdate callback executed ===');
          } else {
            console.log('=== SOCKET SERVICE: No onTurnUpdate callback registered ===');
          }
        });

        this.socket.on('moveMade', (data) => {
          console.log('=== SOCKET SERVICE: Received moveMade ===');
          console.log('SocketService received moveMade:', data);
          if (this.onMoveMade) {
            console.log('=== SOCKET SERVICE: Calling onMoveMade callback ===');
            this.onMoveMade(data);
            console.log('=== SOCKET SERVICE: onMoveMade callback executed ===');
          } else {
            console.log('=== SOCKET SERVICE: No onMoveMade callback registered ===');
          }
        });

        this.socket.on('gameTimeout', (data) => {
          console.log('=== SOCKET SERVICE: Received gameTimeout ===');
          console.log('SocketService received gameTimeout:', data);
          if (this.onGameTimeout) {
            console.log('=== SOCKET SERVICE: Calling onGameTimeout callback ===');
            this.onGameTimeout(data);
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
    if (this.socket) {
      console.log('=== SOCKET SERVICE: Setting up onClockUpdate listener ===');
      this.socket.on('clockUpdate', callback);
      console.log('=== SOCKET SERVICE: onClockUpdate listener set up ===');
    } else {
      console.error('SocketService: Cannot set up onClockUpdate, socket not connected');
    }
  }

  onTurnUpdate(callback: (data: { currentTurn: string }) => void) {
    if (this.socket) {
      console.log('=== SOCKET SERVICE: Setting up onTurnUpdate listener ===');
      this.socket.on('turnUpdate', callback);
      console.log('=== SOCKET SERVICE: onTurnUpdate listener set up ===');
    } else {
      console.error('SocketService: Cannot set up onTurnUpdate, socket not connected');
    }
  }

  onMoveMade(callback: (data: { san: string; fen: string; movedBy: string; isPhysicalMove?: boolean }) => void) {
    if (this.socket) {
      console.log('=== SOCKET SERVICE: Setting up onMoveMade listener ===');
      this.socket.on('moveMade', callback);
      console.log('=== SOCKET SERVICE: onMoveMade listener set up ===');
    } else {
      console.error('SocketService: Cannot set up onMoveMade, socket not connected');
    }
  }

  onGameTimeout(callback: (data: { winner: string; reason?: string }) => void) {
    if (this.socket) {
      console.log('=== SOCKET SERVICE: Setting up onGameTimeout listener ===');
      this.socket.on('gameTimeout', callback);
      console.log('=== SOCKET SERVICE: onGameTimeout listener set up ===');
    } else {
      console.error('SocketService: Cannot set up onGameTimeout, socket not connected');
    }
  }

  // Remove event listeners
  offClockUpdate() {
    if (this.socket) {
      this.socket.off('clockUpdate');
    }
  }

  offTurnUpdate() {
    if (this.socket) {
      this.socket.off('turnUpdate');
    }
  }

  offMoveMade() {
    if (this.socket) {
      this.socket.off('moveMade');
    }
  }

  offGameTimeout() {
    if (this.socket) {
      this.socket.off('gameTimeout');
    }
  }
}

export const socketService = new SocketService(); 