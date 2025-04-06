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

    activeGames[gameId].players[playerIndex].disconnected = false;

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
          isHost: p.isHost || false,
          isReady: p.isReady || false,
          isDead: p.isDead || false
        })),
        bossHealth: activeGames[gameId].bossHealth || 0,
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

    // Add player to the game
    const normalizedPlayerName = playerName || 'Guest_' + Math.floor(Math.random() * 1000);
    const playerId = uuidv4();

    activeGames[gameId].players.push({
      id: playerId,
      socketId: socket.id,
      name: normalizedPlayerName,
      isHost: false,
      joinedAt: new Date(),
      isReady: false,
      isDead: false
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
        isHost: p.isHost || false,
        isReady: p.isReady || false,
        isDead: p.isDead || false
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
      status: 'setup', // setup, calibration, active, finished
      players: [], // Will include the host and other players
      settings: {
        timeLimit: 600, // 10 minutes in seconds
        private: false
      },
      bossHealth: 0, // Will be set when the game starts
      gameTimers: {} // To store interval IDs for game mechanics
    };

    // Add host as first player
    activeGames[gameId].players.push({
      id: hostId,
      socketId: socket.id,
      name: normalizedHostName,
      isHost: true,
      joinedAt: new Date(),
      isReady: false,
      isDead: false
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
        isHost: p.isHost || false,
        isReady: p.isReady || false,
        isDead: p.isDead || false
      })),
      bossHealth: activeGames[gameId].bossHealth || 0,
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

  // Listen for start game requests (begins calibration phase)
  socket.on('startGame', ({ gameId, playerId }) => {
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

    // Update game status to calibration phase
    activeGames[gameId].status = 'calibration';

    // Initialize boss health based on player count
    activeGames[gameId].bossHealth = activeGames[gameId].players.length * 30;

    // Notify all players to go to calibration page
    io.to(gameId).emit('goToCalibrationPage', {});

    console.log(`Game ${gameId} entered calibration phase by host ${hostPlayer.name}`);
  });

  // Player is ready after calibration
  socket.on('playerReady', ({ gameId, playerId }) => {
    if (!activeGames[gameId] || activeGames[gameId].status !== 'calibration') {
      socket.emit('readyError', { message: 'Game not found or not in calibration phase' });
      return;
    }

    // Find the player
    const playerIndex = activeGames[gameId].players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) {
      socket.emit('readyError', { message: 'Player not found in this game' });
      return;
    }

    // Mark the player as ready
    activeGames[gameId].players[playerIndex].isReady = true;


    // Check if all players are ready
    const allReady = activeGames[gameId].players.every(p => p.isReady);
    if (allReady) {
      console.log("EVERYONE IS READY!!");
      // If all players are ready, start the actual game
      startActualGame(gameId);
    }

    console.log(`Player ${playerId} is ready in game ${gameId}`);
  });

  // Handle player attacks
  socket.on('playerAttack', ({ gameId, playerId, hit }) => {
    if (!activeGames[gameId] || activeGames[gameId].status !== 'active') {
      return;
    }

    // Find the player
    const player = activeGames[gameId].players.find(p => p.id === playerId);
    if (!player || player.isDead) {
      return;
    }

    // Broadcast the attack to all players
    io.to(gameId).emit('playerAttacked', {
      playerId: playerId,
      hit: hit
    });

    // If the attack hit, reduce boss health
    if (hit) {
      activeGames[gameId].bossHealth -= 1;

      // Broadcast updated boss health
      io.to(gameId).emit('bossHealthUpdated', {
        health: activeGames[gameId].bossHealth
      });

      // Check if boss is defeated
      if (activeGames[gameId].bossHealth <= 0) {
        endGame(gameId, true); // Players win
      }
    }
  });

  // Handle player death notification
  socket.on('playerDied', ({ gameId, playerId }) => {
    if (!activeGames[gameId] || activeGames[gameId].status !== 'active') {
      return;
    }

    // Find the player
    const playerIndex = activeGames[gameId].players.findIndex(p => p.id === playerId);
    if (playerIndex === -1) {
      return;
    }

    // Mark player as dead on the server
    activeGames[gameId].players[playerIndex].isDead = true;

    // Broadcast to all clients that this player has died
    io.to(gameId).emit('playerDied', {
      playerId: playerId
    });

    // Check if all players are dead
    const allPlayersDead = activeGames[gameId].players.every(p => p.isDead || p.disconnected);
    if (allPlayersDead) {
      endGame(gameId, false); // Dragon wins
    }
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
                  isHost: p.isHost || false,
                  isReady: p.isReady || false,
                  isDead: p.isDead || false
                }))
              });

              // If in active game, check if all players are dead or disconnected
              if (activeGames[gameId].status === 'active') {
                const allPlayersDead = activeGames[gameId].players.every(p => p.isDead || p.disconnected);
                if (allPlayersDead) {
                  endGame(gameId, false); // Dragon wins
                }
              }
            }
          }
        }, 60000); // Wait 1 minute for reconnection
      }
    }
  });
});

// Helper function to start the actual game after calibration
function startActualGame(gameId) {
  if (!activeGames[gameId]) return;

  // Update game status
  activeGames[gameId].status = 'active';

  // Reset player readiness for game mechanics
  activeGames[gameId].players.forEach(player => {
    player.isReady = false;
  });

  // Notify all players that the game has started
  io.to(gameId).emit('gameStarted', {
    gameId: gameId,
    bossHealth: activeGames[gameId].bossHealth,
    players: activeGames[gameId].players.map(p => ({
      id: p.id,
      name: p.name,
      isDead: p.isDead || false
    }))
  });

  // Start dragon attack timer (every 10 seconds)
  activeGames[gameId].gameTimers.dragonAttack = setInterval(() => {
    dragonAttack(gameId);
  }, 10000);

  // Set game end timer (90 seconds)
  activeGames[gameId].gameTimers.gameEnd = setTimeout(() => {
    // If time runs out, dragon wins
    endGame(gameId, false);
  }, 90000);

  console.log(`Game ${gameId} fully started, dragon will attack every 10 seconds, game will end in 90 seconds`);
}

// Dragon attack function
function dragonAttack(gameId) {
  if (!activeGames[gameId] || activeGames[gameId].status !== 'active') return;

  const game = activeGames[gameId];
  const activePlayers = game.players.filter(p => !p.isDead && !p.disconnected);

  // If no active players, end the game
  if (activePlayers.length === 0) {
    endGame(gameId, false);
    return;
  }

  // Select up to 5 random players to attack
  const targetCount = Math.min(5, activePlayers.length);
  const targetPlayers = [];

  // Fisher-Yates shuffle for random selection
  const shuffled = [...activePlayers];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  // Take the first 'targetCount' players
  for (let i = 0; i < targetCount; i++) {
    targetPlayers.push(shuffled[i].id);
  }

  // Notify all players about the dragon attack - just send IDs of attacked players
  io.to(gameId).emit('dragonAttacked', {
    targetPlayerIds: targetPlayers
  });

  console.log(`Dragon attacked in game ${gameId}, targeting ${targetPlayers.length} players`);
}

// End game function
function endGame(gameId, playersWin) {
  if (!activeGames[gameId]) return;

  // Clear all timers
  clearInterval(activeGames[gameId].gameTimers.dragonAttack);
  clearTimeout(activeGames[gameId].gameTimers.gameEnd);

  // Update game status
  activeGames[gameId].status = 'finished';

  // Notify all players about game end
  io.to(gameId).emit('gameEnded', {
    playersWin: playersWin,
    players: activeGames[gameId].players.map(p => ({
      id: p.id,
      name: p.name,
      isDead: p.isDead || false
    })),
    bossHealth: activeGames[gameId].bossHealth
  });

  console.log(`Game ${gameId} ended, players ${playersWin ? 'won' : 'lost'}`);

  // Keep the game data for some time before cleaning up
  setTimeout(() => {
    if (activeGames[gameId]) {
      delete activeGames[gameId];
      console.log(`Game ${gameId} data removed after end`);
    }
  }, 300000); // Clean up after 5 minutes
}

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

  // Add player to the game
  const normalizedPlayerName = playerName || 'Guest_' + Math.floor(Math.random() * 1000);
  const playerId = uuidv4();

  activeGames[gameId].players.push({
    id: playerId,
    name: normalizedPlayerName,
    isHost: false,
    joinedAt: new Date(),
    isReady: false,
    isDead: false
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
  const hostId = uuidv4();

  // Create a new game instance
  activeGames[gameId] = {
    id: gameId,
    createdAt: new Date(),
    host: {
      id: hostId,
      name: hostName
    },
    status: 'setup', // setup, calibration, active, finished
    players: [], // Will include the host and other players
    settings: {
      timeLimit: 600, // 10 minutes in seconds
      private: false
    },
    bossHealth: 0, // Will be set when the game starts
    gameTimers: {} // To store interval IDs for game mechanics
  };

  // Add host as first player
  activeGames[gameId].players.push({
    id: hostId,
    name: hostName,
    isHost: true,
    joinedAt: new Date(),
    isReady: false,
    isDead: false
  });

  return res.json({
    success: true,
    gameId: gameId,
    playerId: hostId,
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
        isHost: p.isHost || false,
        isReady: p.isReady || false,
        isDead: p.isDead || false
      })),
      bossHealth: activeGames[gameId].bossHealth || 0,
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

// Serve game calibration page
app.get('/game-calibration', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'game-calibration.html'));
});

// Serve game play page
app.get('/game-play', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'game-play.html'));
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default server; // For testing purposes
