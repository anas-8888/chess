import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;
  private isConnected = false;
  private onConnectionChange: ((connected: boolean) => void) | null = null;
  
  // Callback properties
  private clockUpdateCallback: ((data: { whiteTimeLeft: number; blackTimeLeft: number; currentTurn: string }) => void) | null = null;
  private turnUpdateCallback: ((data: { currentTurn: string }) => void) | null = null;
  private moveMadeCallback: ((data: any) => void) | null = null;
  private gameTimeoutCallback: ((data: { winner: string; reason?: string }) => void) | null = null;
  private moveConfirmedCallback: ((data: { gameId: string; move: string; timestamp: number }) => void) | null = null;

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

    // Set up event listeners that call the stored callbacks
    this.socket.on('clockUpdate', (data) => {
      console.log('=== SOCKET SERVICE: Received clockUpdate ===');
      console.log('SocketService received clockUpdate:', data);
      if (this.clockUpdateCallback) {
        console.log('=== SOCKET SERVICE: Calling onClockUpdate callback ===');
        this.clockUpdateCallback(data);
        console.log('=== SOCKET SERVICE: onClockUpdate callback executed ===');
      }
    });

    this.socket.on('turnUpdate', (data) => {
      console.log('=== SOCKET SERVICE: Received turnUpdate ===');
      console.log('SocketService received turnUpdate:', data);
      if (this.turnUpdateCallback) {
        console.log('=== SOCKET SERVICE: Calling onTurnUpdate callback ===');
        this.turnUpdateCallback(data);
        console.log('=== SOCKET SERVICE: onTurnUpdate callback executed ===');
      }
    });

    this.socket.on('moveMade', (data) => {
      console.log('=== SOCKET SERVICE: Received moveMade ===');
      console.log('SocketService received moveMade:', data);
      console.log('=== SOCKET SERVICE: Socket connected:', this.socket?.connected);
      console.log('=== SOCKET SERVICE: Socket ID:', this.socket?.id);
      console.log('=== SOCKET SERVICE: moveMadeCallback exists:', !!this.moveMadeCallback);
      
      if (this.moveMadeCallback) {
        console.log('=== SOCKET SERVICE: Calling onMoveMade callback ===');
        this.moveMadeCallback(data);
        console.log('=== SOCKET SERVICE: onMoveMade callback executed ===');
      } else {
        console.log('=== SOCKET SERVICE: No moveMadeCallback registered ===');
      }
      
      console.log('=== SOCKET SERVICE: moveMade event handled successfully ===');
    });

    this.socket.on('gameTimeout', (data) => {
      console.log('=== SOCKET SERVICE: Received gameTimeout ===');
      console.log('SocketService received gameTimeout:', data);
      if (this.gameTimeoutCallback) {
        console.log('=== SOCKET SERVICE: Calling onGameTimeout callback ===');
        this.gameTimeoutCallback(data);
        console.log('=== SOCKET SERVICE: onGameTimeout callback executed ===');
      }
    });

    this.socket.on('moveConfirmed', (data) => {
      console.log('=== FULL SYNC: SocketService received moveConfirmed ===');
      console.log('SocketService received moveConfirmed:', data);
      console.log('=== FULL SYNC: SocketService socket connected:', this.socket?.connected);
      console.log('=== FULL SYNC: SocketService socket ID:', this.socket?.id);
      if (this.moveConfirmedCallback) {
        console.log('=== FULL SYNC: Calling onMoveConfirmed callback ===');
        this.moveConfirmedCallback(data);
        console.log('=== FULL SYNC: onMoveConfirmed callback executed ===');
      }
      console.log('=== FULL SYNC: MoveConfirmed event handled successfully ===');
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

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  getSocketId(): string | undefined {
    return this.socket?.id;
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
    currentTurn: string;
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
      this.clockUpdateCallback = callback; // Store the callback
      this.socket.on('clockUpdate', callback); // Set up the listener
      console.log('=== SOCKET SERVICE: onClockUpdate listener set up ===');
    } else {
      console.error('SocketService: Cannot set up onClockUpdate, socket not connected');
    }
  }

  onTurnUpdate(callback: (data: { currentTurn: string }) => void) {
    if (this.socket) {
      console.log('=== SOCKET SERVICE: Setting up onTurnUpdate listener ===');
      this.turnUpdateCallback = callback; // Store the callback
      this.socket.on('turnUpdate', callback); // Set up the listener
      console.log('=== SOCKET SERVICE: onTurnUpdate listener set up ===');
    } else {
      console.error('SocketService: Cannot set up onTurnUpdate, socket not connected');
    }
  }

  onMoveMade(callback: (data: any) => void) {
    if (this.socket) {
      console.log('=== FULL SYNC: Setting up onMoveMade listener ===');
      this.moveMadeCallback = callback; // Store the callback
      console.log('=== FULL SYNC: onMoveMade listener set up ===');
    } else {
      console.error('SocketService: Cannot set up onMoveMade, socket not connected');
    }
  }

  onGameTimeout(callback: (data: { winner: string; reason?: string }) => void) {
    if (this.socket) {
      console.log('=== SOCKET SERVICE: Setting up onGameTimeout listener ===');
      this.gameTimeoutCallback = callback; // Store the callback
      this.socket.on('gameTimeout', callback); // Set up the listener
      console.log('=== SOCKET SERVICE: onGameTimeout listener set up ===');
    } else {
      console.error('SocketService: Cannot set up onGameTimeout, socket not connected');
    }
  }

  onMoveConfirmed(callback: (data: { gameId: string; move: string; timestamp: number }) => void) {
    if (this.socket) {
      console.log('=== FULL SYNC: Setting up onMoveConfirmed listener ===');
      this.moveConfirmedCallback = callback; // Store the callback
      this.socket.on('moveConfirmed', callback); // Set up the listener
      console.log('=== FULL SYNC: onMoveConfirmed listener set up ===');
    } else {
      console.error('SocketService: Cannot set up onMoveConfirmed, socket not connected');
    }
  }

  // Remove event listeners
  offClockUpdate() {
    if (this.socket) {
      this.socket.off('clockUpdate');
      this.clockUpdateCallback = null; // Clear the stored callback
    }
  }

  offTurnUpdate() {
    if (this.socket) {
      this.socket.off('turnUpdate');
      this.turnUpdateCallback = null; // Clear the stored callback
    }
  }

  offMoveMade() {
    if (this.socket) {
      this.socket.off('moveMade');
      this.moveMadeCallback = null; // Clear the stored callback
    }
  }

  offGameTimeout() {
    if (this.socket) {
      this.socket.off('gameTimeout');
      this.gameTimeoutCallback = null; // Clear the stored callback
    }
  }

  offMoveConfirmed() {
    if (this.socket) {
      this.socket.off('moveConfirmed');
      this.moveConfirmedCallback = null; // Clear the stored callback
    }
  }

  // Test connection
  testConnection() {
    if (this.socket && this.socket.connected) {
      console.log('=== SOCKET SERVICE: Testing connection ===');
      this.socket.emit('ping', { 
        timestamp: Date.now(),
        test: 'connection'
      });
      console.log('=== SOCKET SERVICE: Connection test sent ===');
    } else {
      console.error('=== SOCKET SERVICE: Cannot test connection - socket not connected ===');
    }
  }

  // Test room membership
  testRoomMembership(gameId: string) {
    if (this.socket && this.socket.connected) {
      console.log('=== SOCKET SERVICE: Testing room membership ===');
      console.log('=== SOCKET SERVICE: Game ID:', gameId);
      console.log('=== SOCKET SERVICE: Socket connected:', this.socket.connected);
      console.log('=== SOCKET SERVICE: Socket ID:', this.socket.id);
      
      // Send a test message to the room
      this.socket.emit('ping', { 
        timestamp: Date.now(),
        gameId: gameId,
        test: 'room_membership'
      });
      console.log('=== SOCKET SERVICE: Room membership test sent ===');
    } else {
      console.error('=== SOCKET SERVICE: Cannot test room membership - socket not connected ===');
    }
  }
}

export const socketService = new SocketService(); 