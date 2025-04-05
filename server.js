// server.js
import express from 'express';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { v4 as uuidv4 } from 'uuid'; // For generating unique game IDs

// Get current file directory with ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = createServer(app);

// Middleware
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// In-memory game storage (in a production environment, use a database)
const activeGames = {};

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

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default server; // For testing purposes