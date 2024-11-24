const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const path = require('path');
const os = require('os');
const { PokerGameHandler } = require('../poker/server/poker-handler');
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ 
    server,
    path: '/',  // This ensures the WebSocket server listens on the root path
    clientTracking: true
});

// Get local IP address
function getLocalIPAddress() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

// Game state management
const gameState = {
    players: new Map(),
    tvClients: new Set(),
    games: new Map([
        ['Poker', {
            id: 'Poker',
            name: 'Poker',
            maxPlayers: 8,
            players: new Set(),
            status: 'waiting',
            handler: null
        }],
        ['Blackjack', {
            id: 'Blackjack',
            name: 'Blackjack',
            maxPlayers: 8,
            players: new Set(),
            status: 'waiting'
        }],
        // ... rest of your games
    ])
};

// Serve static files
app.use('/', express.static(path.join(__dirname, '../tv-client/public')));
app.use('/join', express.static(path.join(__dirname, '../mobile-client/public')));
app.use('/game-project/poker', express.static(path.join(__dirname, '../poker/public/mobile')));
app.use('/game-project/poker/tv', express.static(path.join(__dirname, '../poker/public/tv')));

// HTML routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../tv-client/public/index.html'));
});

app.get('/join', (req, res) => {
    res.sendFile(path.join(__dirname, '../mobile-client/public/index.html'));
});

app.get('/game-project/poker', (req, res) => {
    res.sendFile(path.join(__dirname, '../poker/public/mobile/index.html'));
});

app.get('/game-project/poker/tv', (req, res) => {
    res.sendFile(path.join(__dirname, '../poker/public/tv/index.html'));
});

// API endpoints
app.get('/api/network-info', (req, res) => {
    const ipAddress = getLocalIPAddress();
    const port = server.address().port;
    const joinUrl = `http://${ipAddress}:${port}/join`;
    
    res.json({
        ipAddress,
        port,
        joinUrl
    });
});
    


// Broadcast utilities
function broadcastToTV(message) {
    gameState.tvClients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(JSON.stringify(message));
            } catch (error) {
                console.error('Error broadcasting to TV:', error);
            }
        }
    });
}

function broadcastToGame(gameId, message) {
    const game = gameState.games.get(gameId);
    if (game) {
        game.players.forEach(playerId => {
            const player = gameState.players.get(playerId);
            if (player && player.ws && player.ws.readyState === WebSocket.OPEN) {
                try {
                    player.ws.send(JSON.stringify(message));
                } catch (error) {
                    console.error('Error broadcasting to player:', error);
                }
            }
        });
    }
}

function getGamesList() {
    return Array.from(gameState.games.values())
        .map(game => ({
            id: game.id,
            name: game.name,
            players: game.players.size,
            maxPlayers: game.maxPlayers,
            status: game.status
        }));
}

function isSocketHealthy(ws) {
    return ws && ws.readyState === WebSocket.OPEN;
}

function getPlayersList() {
    return Array.from(gameState.players.values())
        .filter(player => player != null)
        .map(player => ({
            id: player.id,
            name: player.name,
            gameId: player.gameId
        }));
}

// WebSocket connection handler
wss.on('connection', (ws) => {
    let clientId = null;
    let clientType = null;

    const sendError = (message) => {
        try {
            ws.send(JSON.stringify({
                type: 'error',
                message
            }));
        } catch (error) {
            console.error('Error sending error message:', error);
        }
    };

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            console.log('Received message:', data);

            switch (data.type) {
                case 'tvClient':
                    clientType = 'tv';
                    gameState.tvClients.add(ws);
                    ws.send(JSON.stringify({
                        type: 'playerUpdate',
                        players: getPlayersList()
                    }));
                    ws.send(JSON.stringify({
                        type: 'gameUpdate',
                        games: getGamesList()
                    }));
                    console.log('TV client connected');
                    break;

                case 'join':
                    if (!data.username?.trim()) {
                        sendError('Username is required');
                        return;
                    }

                    clientType = 'player';
                    clientId = `player-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
                    
                    gameState.players.set(clientId, {
                        id: clientId,
                        name: data.username.trim(),
                        ws: ws,
                        gameId: null,
                        isAI: false
                    });

                    ws.send(JSON.stringify({
                        type: 'joined',
                        playerId: clientId,
                        username: data.username.trim()
                    }));

                    ws.send(JSON.stringify({
                        type: 'gameList',
                        games: getGamesList()
                    }));

                    broadcastToTV({
                        type: 'playerUpdate',
                        players: getPlayersList()
                    });
                    break;
                    case 'selectGame':
                    console.log('Received selectGame message:', data);
                    
                    if (!clientId || !gameState.players.has(clientId)) {
                        console.log('Select game failed: Invalid client', { clientId });
                        sendError('Not registered as a player');
                        return;
                    }

                    const player = gameState.players.get(clientId);
                    
                    // Leave current game if in one
                    if (player.gameId) {
                        const currentGame = gameState.games.get(player.gameId);
                        if (currentGame) {
                            currentGame.players.delete(clientId);
                            if (currentGame.players.size === 0) {
                                currentGame.status = 'waiting';
                                currentGame.handler = null;
                            }
                        }
                    }

                    // Handle case where player is leaving game (gameId is null)
                    if (!data.gameId) {
                        player.gameId = null;
                        broadcastToTV({
                            type: 'gameUpdate',
                            games: getGamesList()
                        });
                        broadcastToTV({
                            type: 'playerUpdate',
                            players: getPlayersList()
                        });
                        return;
                    }

                    const game = gameState.games.get(data.gameId);
                    if (!game) {
                        console.log('Invalid game selection:', data.gameId);
                        sendError('Invalid game selection');
                        return;
                    }

                    if (game.players.size >= game.maxPlayers) {
                        console.log('Game is full:', {
                            gameId: data.gameId,
                            currentPlayers: game.players.size,
                            maxPlayers: game.maxPlayers
                        });
                        sendError('Game is full');
                        return;
                    }

                    // Add player to game
                    game.players.add(clientId);
                    player.gameId = data.gameId;

                    console.log('Player joined game:', {
                        playerId: clientId,
                        playerName: player.name,
                        gameId: data.gameId,
                        currentPlayers: game.players.size
                    });

                    // Send join confirmation
                    ws.send(JSON.stringify({
                        type: 'gameJoined',
                        gameId: data.gameId,
                        playerId: clientId,
                        players: Array.from(game.players).map(id => ({
                            id,
                            name: gameState.players.get(id).name
                        }))
                    }));

                    // Auto-start the game if it's Poker
                    if (data.gameId === 'Poker') {
                        // Add AI dealer if not already present
                        const dealerId = 'dealer-ai';
                        if (!game.players.has(dealerId)) {
                            gameState.players.set(dealerId, {
                                id: dealerId,
                                name: 'Dealer',
                                isAI: true,
                                gameId: 'Poker'
                            });
                            game.players.add(dealerId);
                        }

                        // Initialize game handler and start immediately
                        game.status = 'active';
                        game.handler = new PokerGameHandler(
                            data.gameId,
                            {
                                getPlayers: () => game.players,
                                addPlayer: (id, name) => game.players.add(id)
                            },
                            broadcastToTV,
                            (msg) => broadcastToGame(data.gameId, msg),
                            gameState.players
                        );

                        // Redirect players to game UI
                        game.players.forEach(playerId => {
                            const gamePlayer = gameState.players.get(playerId);
                            if (gamePlayer && !gamePlayer.isAI && gamePlayer.ws?.readyState === WebSocket.OPEN) {
                                gamePlayer.ws.send(JSON.stringify({
                                    type: 'gameRedirect',
                                    url: '/game-project/poker',
                                    gameId: data.gameId
                                }));
                            }
                        });

                        // Redirect TV
                        broadcastToTV({
                            type: 'gameRedirect',
                            url: '/game-project/poker/tv',
                            gameId: data.gameId
                        });
                    }

                    // Broadcast updates
                    broadcastToTV({
                        type: 'gameUpdate',
                        games: getGamesList()
                    });

                    broadcastToTV({
                        type: 'playerUpdate',
                        players: getPlayersList()
                    });
                    break;

                case 'pokerAction':
                    if (!clientId || !data.gameId) {
                        sendError('Invalid game or player');
                        return;
                    }

                    const pokerGame = gameState.games.get('Poker');
                    if (!pokerGame || !pokerGame.handler) {
                        sendError('Poker game not found or not started');
                        return;
                    }

                    const success = pokerGame.handler.handleAction(
                        clientId,
                        data.action,
                        data.amount
                    );

                    if (!success) {
                        sendError('Invalid action');
                    }
                    break;

                default:
                    console.log('Unknown message type:', data.type);
            }
        } catch (err) {
            console.error('Error processing message:', err);
            sendError('Invalid message format');
        }
    });

    ws.on('close', () => {
        if (clientType === 'tv') {
            gameState.tvClients.delete(ws);
            console.log('TV client disconnected');
        } else if (clientType === 'player' && clientId) {
            const player = gameState.players.get(clientId);
            if (player?.gameId) {
                const game = gameState.games.get(player.gameId);
                if (game) {
                    game.players.delete(clientId);
                    if (game.players.size === 0) {
                        game.status = 'waiting';
                        game.handler = null;
                    }
                }
            }
            gameState.players.delete(clientId);
            console.log(`Player ${player?.name} disconnected`);

            broadcastToTV({
                type: 'playerUpdate',
                players: getPlayersList()
            });
            broadcastToTV({
                type: 'gameUpdate',
                games: getGamesList()
            });
        }
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
    });
});

// Clean up disconnected clients
setInterval(() => {
    // Clean up TV clients
    gameState.tvClients.forEach(client => {
        if (!client || client.readyState === WebSocket.CLOSED) {
            gameState.tvClients.delete(client);
        }
    });

    // Clean up disconnected players
    for (const [playerId, player] of gameState.players) {
        if (!player || !player.ws || player.ws.readyState === WebSocket.CLOSED) {
            if (player && player.gameId) {
                const game = gameState.games.get(player.gameId);
                if (game) {
                    game.players.delete(playerId);
                    if (game.players.size === 0) {
                        game.status = 'waiting';
                        game.handler = null;
                    }
                }
            }
            
            gameState.players.delete(playerId);

            broadcastToTV({
                type: 'playerUpdate',
                players: getPlayersList()
            });
            
            broadcastToTV({
                type: 'gameUpdate',
                games: getGamesList()
            });
        }
    }
}, 30000);

// Start server
const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Local IP address: ${getLocalIPAddress()}`);
    console.log(`TV interface: http://${getLocalIPAddress()}:${PORT}`);
    console.log(`Mobile interface: http://${getLocalIPAddress()}:${PORT}/join`);
});

// Handle server shutdown
process.on('SIGINT', () => {
    wss.clients.forEach(client => {
        client.close();
    });
    server.close(() => {
        console.log('Server shutdown complete');
        process.exit(0);
    });
});