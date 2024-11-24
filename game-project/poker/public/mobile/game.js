import React from 'react';
import { Card as CardUI, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

// Card component for displaying playing cards
const Card = ({ suit, value, revealed }) => {
    if (!revealed) {
        return <div className="card back">🂠</div>;
    }

    const suitSymbol = {
        hearts: '♥',
        diamonds: '♦',
        clubs: '♣',
        spades: '♠'
    };

    const cardColor = suit === 'hearts' || suit === 'diamonds' ? 'text-red-600' : 'text-black';

    return (
        <div className={`card ${cardColor} bg-white rounded-lg p-4 shadow-lg`}>
            <div className="text-xl font-bold">{value}</div>
            <div className="text-2xl">{suitSymbol[suit]}</div>
        </div>
    );
};

const PokerGame = () => {
    // State definitions
    const [gameState, setGameState] = React.useState({
        status: 'connecting',
        players: [],
        currentPlayer: null,
        pot: 0,
        currentBet: 0,
        minBet: 10,
        maxBet: 1000,
        playerStack: 1000,
        playerCards: [],
        communityCards: [],
        lastAction: null,
        timeLeft: 30,
        username: null,
        isDealer: false,
        dealerPosition: 0,
        playerId: null,
        maxPlayers: 8,
        connectedPlayers: 0,
        stage: 'connecting',
        isCurrentPlayer: false,
        roundBets: new Map()
    });

    const [ws, setWs] = React.useState(null);
    const [errors, setErrors] = React.useState([]);
    const wsRef = React.useRef(null);
    const reconnectTimeoutRef = React.useRef(null);
    const [connectionStatus, setConnectionStatus] = React.useState('connecting');
    const [isReconnecting, setIsReconnecting] = React.useState(false);
    const [showUsernamePrompt, setShowUsernamePrompt] = React.useState(false);
    // Debug logging
    React.useEffect(() => {
        console.log('Current game state:', gameState);
    }, [gameState]);

    // Error handling
    const clearError = (index) => {
        setErrors(prev => prev.filter((_, i) => i !== index));
    };

    // Action handler
    const handleAction = React.useCallback((action, amount = null) => {
        if (!wsRef.current?.readyState === WebSocket.OPEN) {
            setErrors(prev => [...prev, 'Not connected to game server']);
            return;
        }

        // Validate player's turn
        if (!gameState.isCurrentPlayer) {
            setErrors(prev => [...prev, 'Not your turn']);
            return;
        }

        // Get current player's bet in this round
        const currentPlayerBet = gameState.roundBets.get(gameState.playerId) || 0;
        const toCall = gameState.currentBet - currentPlayerBet;

        // Validate specific actions
        switch (action.toLowerCase()) {
            case 'check':
                if (toCall > 0) {
                    setErrors(prev => [...prev, 'Cannot check when there is a bet to call']);
                    return;
                }
                break;

            case 'raise':
                const minRaise = Math.max(gameState.currentBet * 2, gameState.minBet);
                if (!amount || amount < minRaise) {
                    setErrors(prev => [...prev, `Raise must be at least ${minRaise}`]);
                    return;
                }
                if (amount > gameState.playerStack) {
                    setErrors(prev => [...prev, 'Not enough chips']);
                    return;
                }
                break;
        }

        const message = {
            type: 'pokerAction',
            gameId: 'Poker',
            action: action.toLowerCase(),
            amount: amount ? Number(amount) : undefined
        };

        console.log('Sending action:', message);
        wsRef.current.send(JSON.stringify(message));
    }, [gameState]);

    // WebSocket connection logic
    React.useEffect(() => {
        const connectWebSocket = async () => {
            try {
                const username = localStorage.getItem('username');
                if (!username) {
                    setShowUsernamePrompt(true);
                    setConnectionStatus('error');
                    return;
                }

                if (wsRef.current) {
                    wsRef.current.close();
                }

                // Use the exact URL from the browser
                const wsUrl = `ws://${window.location.host}`;
                console.log('Connecting to WebSocket at:', wsUrl);

                const websocket = new WebSocket(wsUrl);
                
                websocket.onopen = () => {
                    console.log('WebSocket connected');
                    setConnectionStatus('connected');
                    setIsReconnecting(false);

                    // Send join message first
                    websocket.send(JSON.stringify({
                        type: 'join',
                        username: username
                    }));
                };

                websocket.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);
                        console.log('Received message:', data);

                        switch (data.type) {
                            case 'joined':
                                // After successful join, send game selection
                                websocket.send(JSON.stringify({
                                    type: 'selectGame',
                                    gameId: 'Poker'
                                }));

                                setGameState(prev => ({
                                    ...prev,
                                    playerId: data.playerId,
                                    username: username,
                                    status: 'waiting'
                                }));
                                break;

                            case 'gameJoined':
                                setGameState(prev => ({
                                    ...prev,
                                    players: data.players || [],
                                    connectedPlayers: data.players?.length || 1,
                                    stage: 'waiting'
                                }));
                                break;

                            case 'gameState':
                                console.log('Game state update:', data);
                                setGameState(prev => ({
                                    ...prev,
                                    pot: data.pot ?? prev.pot,
                                    currentBet: data.currentBet ?? prev.currentBet,
                                    playerStack: data.stack ?? prev.playerStack,
                                    playerCards: data.playerCards ?? prev.playerCards,
                                    communityCards: data.communityCards ?? prev.communityCards,
                                    stage: data.stage ?? prev.stage,
                                    isCurrentPlayer: data.isCurrentPlayer ?? false,
                                    players: data.players ?? prev.players,
                                    dealerPosition: data.dealerPosition ?? prev.dealerPosition,
                                    lastAction: data.lastAction ?? prev.lastAction,
                                    roundBets: new Map(data.roundBets ?? [])
                                }));
                                break;

                            case 'error':
                                console.error('Server error:', data.message);
                                setErrors(prev => [...prev, data.message]);
                                break;
                        }
                    } catch (err) {
                        console.error('Error processing message:', err);
                        setErrors(prev => [...prev, 'Error processing server message']);
                    }
                };

                websocket.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    setErrors(prev => [...prev, 'Connection error. Please try again.']);
                    setConnectionStatus('error');
                };

                websocket.onclose = () => {
                    console.log('WebSocket disconnected');
                    setConnectionStatus('disconnected');
                    
                    if (!isReconnecting) {
                        setIsReconnecting(true);
                        reconnectTimeoutRef.current = setTimeout(() => {
                            connectWebSocket();
                        }, 5000);
                    }
                };

                setWs(websocket);
                wsRef.current = websocket;

            } catch (error) {
                console.error('Failed to connect:', error);
                setErrors(prev => [...prev, 'Failed to connect to game server']);
                setConnectionStatus('error');
            }
        };

        connectWebSocket();

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
        };
    }, [isReconnecting]);

    // Username prompt screen
    if (showUsernamePrompt) {
        return (
            <div className="fixed inset-0 bg-gray-900 flex items-center justify-center p-4">
                <div className="bg-gray-800 p-6 rounded-lg max-w-sm w-full">
                    <h2 className="text-xl text-white mb-4">Enter Your Username</h2>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        const username = e.target.username.value;
                        if (username.trim()) {
                            localStorage.setItem('username', username.trim());
                            setShowUsernamePrompt(false);
                            window.location.reload();
                        }
                    }}>
                        <input
                            type="text"
                            name="username"
                            className="w-full p-2 rounded mb-4 bg-gray-700 text-white"
                            placeholder="Username"
                            autoFocus
                        />
                        <button
                            type="submit"
                            className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
                        >
                            Join Game
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 p-4">
            {/* Connection Status */}
            <div className={`fixed top-0 left-0 right-0 p-2 text-center text-white
                ${connectionStatus === 'connected' ? 'bg-green-600' :
                  connectionStatus === 'connecting' ? 'bg-yellow-600' :
                  'bg-red-600'}`}>
                {connectionStatus === 'connected' ? `Connected (Players: ${gameState.connectedPlayers})` :
                 connectionStatus === 'connecting' ? 'Connecting...' :
                 'Disconnected - Attempting to reconnect...'}
            </div>

            {/* Debug Info */}
            <div className="fixed top-12 left-4 text-white text-sm">
                <div>Status: {gameState.status}</div>
                <div>Stage: {gameState.stage}</div>
                <div>Player ID: {gameState.playerId || 'Not assigned'}</div>
            </div>

            {/* Errors */}
            <div className="fixed top-20 right-4 z-50">
                {errors.map((error, index) => (
                    <div key={index} className="bg-red-500 text-white px-4 py-2 rounded mb-2 flex items-center">
                        <span>{error}</span>
                        <button className="ml-4" onClick={() => clearError(index)}>&times;</button>
                    </div>
                ))}
            </div>

            {/* Game Content */}
            <div className="mt-16">
                {/* Game Info */}
                <div className="text-center text-white mb-4">
                    <div>Stack: ${gameState.playerStack}</div>
                    <div>Current Bet: ${gameState.currentBet}</div>
                    <div>Pot: ${gameState.pot}</div>
                    <div>Stage: {gameState.stage}</div>
                    {gameState.isCurrentPlayer && (
                        <div className="text-green-400 font-bold mt-2">Your Turn!</div>
                    )}
                    {gameState.lastAction && (
                        <div className="text-blue-400 mt-2">
                            Last Action: {gameState.lastAction.action} 
                            {gameState.lastAction.amount ? ` $${gameState.lastAction.amount}` : ''}
                        </div>
                    )}
                </div>

                {/* Community Cards */}
                {gameState.stage !== 'preflop' && gameState.stage !== 'waiting' && (
                    <div className="flex justify-center gap-2 mb-4">
                        {gameState.communityCards.map((card, index) => (
                            <Card 
                                key={index}
                                suit={card.suit}
                                value={card.value}
                                revealed={true}
                            />
                        ))}
                    </div>
                )}

                {/* Player Cards */}
                <div className="flex justify-center gap-2 mb-8">
                    {gameState.playerCards.map((card, index) => (
                        <Card 
                            key={index}
                            suit={card.suit}
                            value={card.value}
                            revealed={true}
                        />
                    ))}
                </div>

                {/* Action Buttons */}
                <div className="fixed bottom-0 left-0 right-0 bg-gray-800/95 p-4">
                    <div className="flex justify-around gap-2">
                        <button
                            onClick={() => handleAction('fold')}
                            className={`w-full py-3 px-6 rounded-lg transition-colors
                                ${!gameState.isCurrentPlayer 
                                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed' 
                                    : 'bg-red-600 text-white hover:bg-red-700'}`}
                            disabled={!gameState.isCurrentPlayer}
                        >
                            Fold
                        </button>
                        <button
                            onClick={() => handleAction(
                                gameState.currentBet === 0 ? 'check' : 'call'
                            )}
                            className={`w-full py-3 px-6 rounded-lg transition-colors
                                ${!gameState.isCurrentPlayer
                                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                    : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                            disabled={!gameState.isCurrentPlayer}
                        >
                            {gameState.currentBet === 0 ? 'Check' : `Call $${gameState.currentBet}`}
                        </button>
                        <button
                            onClick={() => {
                                const minRaise = Math.max(gameState.currentBet * 2, gameState.minBet);
                                handleAction('raise', minRaise);
                            }}
                            className={`w-full py-3 px-6 rounded-lg transition-colors
                                ${!gameState.isCurrentPlayer
                                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                                    : 'bg-green-600 text-white hover:bg-green-700'}`}
                            disabled={!gameState.isCurrentPlayer}
                        >
                            Raise (${Math.max(gameState.currentBet * 2, gameState.minBet)})
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PokerGame;