// server.js
import express from 'express';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { v4 as uuidv4 } from 'uuid'; // For generating unique game IDs
import { Server } from 'socket.io';

// Get current file directory with ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);
const io = new Server(server);

// Middleware
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// In-memory game storage (in a production environment, use a database)
const activeGames = {};

// Map to track player IDs to socket IDs
const playerSocketMap = {};

// Socket connection handler
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Handle player reconnection
  socket.on('reconnectPlayer', ({ gameId, playerId }) => {
    console.log(`Attempting to reconnect player ${playerId} to game ${gameId} with socket ${socket.id}`);

    if (!gameId || !playerId || !activeGames[gameId]) {
      console.log(`Reconnection failed: Game ${gameId} not found or invalid player ID`);
      return;
    }

    // Find the player in the game
    const playerIndex = activeGames[gameId].players.findIndex(p => p.id === playerId);

    if (playerIndex !== -1) {
      // Update socket ID mapping
      const oldSocketId = activeGames[gameId].players[playerIndex].socketId;
      console.log(`Updating socket ID from ${oldSocketId} to ${socket.id} for player ${playerId}`);

      // Update the socket ID for this player
      activeGames[gameId].players[playerIndex].socketId = socket.id;

      // If this player is the host, update the host socketId too
      if (activeGames[gameId].players[playerIndex].isHost) {
        activeGames[gameId].host.socketId = socket.id;
        console.log(`Updated host socket ID to ${socket.id} for game ${gameId}`);
      }

      // Update the player socket map
      playerSocketMap[playerId] = socket.id;

      // Join this socket to the game room
      socket.join(gameId);

      console.log(`Player ${playerId} successfully reconnected to game ${gameId}`);

      // Send game status to the reconnected player
      socket.emit('gameStatus', {
        id: activeGames[gameId].id,
        status: activeGames[gameId].status,
        players: activeGames[gameId].players.map(p => ({
          id: p.id,
          name: p.name,
          isHost: p.isHost || false
        })),
        maxPlayers: activeGames[gameId].maxPlayers,
        createdAt: activeGames[gameId].createdAt
      });
    } else {
      console.log(`Player ${playerId} not found in game ${gameId}`);
    }
  });

  // Listen for a player joining a game
  socket.on('joinGame', ({ gameId, playerName }) => {
    console.log(`Player ${playerName} attempting to join game ${gameId}`);

    // Validate input
    if (!gameId) {
      socket.emit('joinError', { message: 'Game ID is required.' });
      return;
    }

    // Check if game exists
    if (!activeGames[gameId]) {
      socket.emit('joinError', { message: 'Game not found. Please check the code and try again.' });
      return;
    }

    // Check if game is full
    if (activeGames[gameId].players.length >= activeGames[gameId].maxPlayers) {
      socket.emit('joinError', { message: 'This game is full. Please join another game.' });
      return;
    }

    // Add player to the game
    const normalizedPlayerName = playerName || 'Guest_' + Math.floor(Math.random() * 1000);
    const playerId = uuidv4();

    activeGames[gameId].players.push({
      id: playerId,
      socketId: socket.id,
      name: normalizedPlayerName,
      isHost: false,
      joinedAt: new Date()
    });

    // Update the player socket map
    playerSocketMap[playerId] = socket.id;

    // Join socket to the game room
    socket.join(gameId);

    // Send success response to the player
    socket.emit('joinSuccess', {
      gameId: gameId,
      playerId: playerId,
      isHost: false,
      message: 'Successfully joined the game'
    });

    // Notify all players in the game about the updated player list
    io.to(gameId).emit('playerListUpdated', {
      players: activeGames[gameId].players.map(p => ({
        id: p.id,
        name: p.name,
        isHost: p.isHost || false
      }))
    });

    console.log(`Player ${normalizedPlayerName} (${playerId}) joined game ${gameId}`);
  });

  // Listen for a player creating a game
  socket.on('createGame', ({ hostName }) => {
    console.log(`Creating new game with host ${hostName}`);

    const gameId = uuidv4();
    const normalizedHostName = hostName || 'Anonymous Host';
    const hostId = uuidv4();

    console.log(`Generated game ID: ${gameId}, host ID: ${hostId}`);

    // Create a new game instance
    activeGames[gameId] = {
      id: gameId,
      createdAt: new Date(),
      host: {
        id: hostId,
        socketId: socket.id,
        name: normalizedHostName
      },
      status: 'setup', // setup, active, finished
      players: [], // Will include the host and other players
      maxPlayers: 4, // Default max players
      settings: {
        timeLimit: 600, // 10 minutes in seconds
        private: false
      }
    };

    // Add host as first player
    activeGames[gameId].players.push({
      id: hostId,
      socketId: socket.id,
      name: normalizedHostName,
      isHost: true,
      joinedAt: new Date()
    });

    // Update the player socket map
    playerSocketMap[hostId] = socket.id;

    // Join socket to the game room
    socket.join(gameId);

    console.log(`Game ${gameId} created, active games:`, Object.keys(activeGames));

    // Send success response to the host
    socket.emit('createSuccess', {
      gameId: gameId,
      playerId: hostId,
      isHost: true,
      message: 'Game created successfully'
    });

    console.log(`Game ${gameId} created by ${normalizedHostName} (${hostId})`);
  });

  // Listen for game status requests
  socket.on('getGameStatus', ({ gameId }) => {
    console.log(`Getting status for game ${gameId}`);
    console.log(`Active games:`, Object.keys(activeGames));

    if (!activeGames[gameId]) {
      console.log(`Game ${gameId} not found!`);
      socket.emit('gameStatusError', { message: 'Game not found' });
      return;
    }

    socket.emit('gameStatus', {
      id: activeGames[gameId].id,
      status: activeGames[gameId].status,
      players: activeGames[gameId].players.map(p => ({
        id: p.id,
        name: p.name,
        isHost: p.isHost || false
      })),
      maxPlayers: activeGames[gameId].maxPlayers,
      createdAt: activeGames[gameId].createdAt
    });
  });

  // Listen for finding a game by code
  socket.on('findGameByCode', ({ code }) => {
    const normalizedCode = code.toUpperCase();
    console.log(`Looking for game with code ${normalizedCode}`);

    // Find a game ID that ends with this code
    const gameIds = Object.keys(activeGames);
    const matchingGame = gameIds.find(id => {
      const gameCode = id.substring(id.length - 4).toUpperCase();
      return gameCode === normalizedCode;
    });

    if (matchingGame) {
      console.log(`Found matching game: ${matchingGame}`);
      socket.emit('findGameSuccess', { gameId: matchingGame });
    } else {
      console.log(`No matching game found for code ${normalizedCode}`);
      socket.emit('findGameError', { message: 'Game not found' });
    }
  });

  // Listen for start game requests
  socket.on('startGame', ({ gameId }) => {
    if (!activeGames[gameId]) {
      socket.emit('startGameError', { message: 'Game not found' });
      return;
    }

    // Check if the requesting socket is the host
    const hostPlayer = activeGames[gameId].players.find(p => p.isHost);
    if (!hostPlayer || hostPlayer.socketId !== socket.id) {
      socket.emit('startGameError', { message: 'Only the host can start the game' });
      return;
    }

    // Update game status
    activeGames[gameId].status = 'active';

    // Notify all players that the game has started
    io.to(gameId).emit('gameStarted', { gameId: gameId });

    console.log(`Game ${gameId} started by host ${hostPlayer.name}`);
  });

  // Handle disconnections
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);

    // Find games this socket is part of
    for (const gameId in activeGames) {
      const game = activeGames[gameId];
      const playerIndex = game.players.findIndex(p => p.socketId === socket.id);

      if (playerIndex !== -1) {
        const player = game.players[playerIndex];
        console.log(`Player ${player.name} disconnected from game ${gameId}`);

        // We don't immediately remove the player - they might reconnect
        // Instead, we'll mark them as disconnected for now
        game.players[playerIndex].disconnected = true;
        game.players[playerIndex].disconnectedAt = new Date();

        // After a timeout, if they haven't reconnected, remove them
        setTimeout(() => {
          // Check if the game still exists
          if (activeGames[gameId]) {
            // Find the player again (index might have changed)
            const currentPlayerIndex = activeGames[gameId].players.findIndex(p => p.id === player.id);

            // If the player is still in the game and still disconnected
            if (currentPlayerIndex !== -1 && activeGames[gameId].players[currentPlayerIndex].disconnected) {
              console.log(`Player ${player.name} did not reconnect, removing from game ${gameId}`);

              // Now remove the player
              const removedPlayer = activeGames[gameId].players.splice(currentPlayerIndex, 1)[0];

              // If it was the host who disconnected
              if (removedPlayer.isHost) {
                // If there are other players, assign a new host
                if (activeGames[gameId].players.length > 0) {
                  activeGames[gameId].players[0].isHost = true;
                  activeGames[gameId].host.id = activeGames[gameId].players[0].id;
                  activeGames[gameId].host.socketId = activeGames[gameId].players[0].socketId;
                  activeGames[gameId].host.name = activeGames[gameId].players[0].name;

                  io.to(gameId).emit('hostChanged', { newHostId: activeGames[gameId].players[0].id });
                  console.log(`New host for game ${gameId}: ${activeGames[gameId].players[0].name}`);
                } else {
                  // If no players left, remove the game
                  console.log(`No players left in game ${gameId}, removing game`);
                  delete activeGames[gameId];
                  return;
                }
              }

              // Notify remaining players about the updated player list
              io.to(gameId).emit('playerListUpdated', {
                players: activeGames[gameId].players.map(p => ({
                  id: p.id,
                  name: p.name,
                  isHost: p.isHost || false
                }))
              });
            }
          }
        }, 60000); // Wait 1 minute for reconnection
      }
    }
  });
});

// Legacy REST endpoints (kept for backward compatibility)
// API endpoint to join a game
app.post('/api/joinGame', (req, res) => {
  const { gameId, playerName } = req.body;

  // Validate input
  if (!gameId) {
    return res.json({
      success: false,
      message: 'Game ID is required.'
    });
  }

  // Check if game exists
  if (!activeGames[gameId]) {
    return res.json({
      success: false,
      message: 'Game not found. Please check the code and try again.'
    });
  }

  // Check if game is full
  if (activeGames[gameId].players.length >= activeGames[gameId].maxPlayers) {
    return res.json({
      success: false,
      message: 'This game is full. Please join another game.'
    });
  }

  // Add player to the game
  const normalizedPlayerName = playerName || 'Guest_' + Math.floor(Math.random() * 1000);
  const playerId = uuidv4();

  activeGames[gameId].players.push({
    id: playerId,
    name: normalizedPlayerName,
    isHost: false,
    joinedAt: new Date()
  });

  return res.json({
    success: true,
    gameId: gameId,
    playerId: playerId,
    message: 'Successfully joined the game'
  });
});

// API endpoint to create a new game
app.post('/api/createGame', (req, res) => {
  const gameId = uuidv4();
  const hostName = req.body.hostName || 'Anonymous Host';

  // Create a new game instance
  activeGames[gameId] = {
    id: gameId,
    createdAt: new Date(),
    host: {
      id: uuidv4(),
      name: hostName
    },
    status: 'setup', // setup, active, finished
    players: [], // Will include the host and other players
    maxPlayers: 4, // Default max players
    settings: {
      timeLimit: 600, // 10 minutes in seconds
      private: false
    }
  };

  // Add host as first player
  activeGames[gameId].players.push({
    id: activeGames[gameId].host.id,
    name: hostName,
    isHost: true,
    joinedAt: new Date()
  });

  return res.json({
    success: true,
    gameId: gameId,
    message: 'Game created successfully'
  });
});

// API endpoint to get game details
app.get('/api/game/:gameId', (req, res) => {
  const gameId = req.params.gameId;

  if (!activeGames[gameId]) {
    return res.status(404).json({
      success: false,
      message: 'Game not found'
    });
  }

  // Return game details (including player IDs for "you" identification)
  return res.json({
    success: true,
    game: {
      id: activeGames[gameId].id,
      status: activeGames[gameId].status,
      players: activeGames[gameId].players.map(p => ({
        id: p.id,
        name: p.name,
        isHost: p.isHost || false
      })),
      maxPlayers: activeGames[gameId].maxPlayers,
      createdAt: activeGames[gameId].createdAt
    }
  });
});

// API endpoint to find game by code
app.get('/api/findGameByCode/:code', (req, res) => {
  const code = req.params.code.toUpperCase();

  // Find a game ID that ends with this code
  // In a real implementation, you would use a more robust method for matching codes
  const gameIds = Object.keys(activeGames);
  const matchingGame = gameIds.find(id => {
    const gameCode = id.substring(id.length - 4).toUpperCase();
    return gameCode === code;
  });

  if (matchingGame) {
    return res.json({
      success: true,
      gameId: matchingGame
    });
  } else {
    return res.json({
      success: false,
      message: 'Game not found'
    });
  }
});

// Serve the home page
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

// Serve game lobby
app.get('/game-lobby', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'game-lobby.html'));
});

// Serve game setup
app.get('/game-setup', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'game-setup.html'));
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default server; // For testing purposes