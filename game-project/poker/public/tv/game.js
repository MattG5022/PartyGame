// Initialize React 18 mounting
const root = ReactDOM.createRoot(document.getElementById('root'));

// Card component for TV display
const TVCard = ({ suit, value, hidden = false, winning = false }) => {
    if (hidden) {
        return (
            <div className={`tv-card hidden ${winning ? 'winner' : ''}`}>
                <div className="absolute inset-3 border-2 border-indigo-400/30 rounded-md"></div>
            </div>
        );
    }

    const suitSymbol = {
        hearts: '♥',
        diamonds: '♦',
        clubs: '♣',
        spades: '♠'
    };

    const suitColor = suit === 'hearts' || suit === 'diamonds' ? 'text-red-600' : 'text-gray-900';

    return (
        <div className={`tv-card ${winning ? 'winner' : ''}`}>
            <div className={`absolute top-2 left-3 text-2xl font-bold ${suitColor}`}>
                {value}
            </div>
            <div className={`absolute top-8 left-3 text-3xl ${suitColor}`}>
                {suitSymbol[suit]}
            </div>
        </div>
    );
};

// Player position component
const PlayerPosition = ({ player, position, isDealer, isActive, lastAction, isFolded }) => {
    const positionStyles = {
        0: { bottom: '5%', left: '50%', transform: 'translateX(-50%)' },
        1: { bottom: '15%', right: '15%', transform: 'translate(0, -50%) rotate(-30deg)' },
        2: { right: '5%', top: '50%', transform: 'translateY(-50%) rotate(-60deg)' },
        3: { top: '15%', right: '15%', transform: 'translate(0, 50%) rotate(-120deg)' },
        4: { top: '5%', left: '50%', transform: 'translateX(-50%) rotate(180deg)' },
        5: { top: '15%', left: '15%', transform: 'translate(0, 50%) rotate(120deg)' },
        6: { left: '5%', top: '50%', transform: 'translateY(-50%) rotate(60deg)' },
        7: { bottom: '15%', left: '15%', transform: 'translate(0, -50%) rotate(30deg)' }
    };

    const playerStateClass = isFolded ? 'opacity-50' : (isActive ? 'ring-4 ring-yellow-400 animate-pulse' : '');

    return (
        <div className="player-position" style={positionStyles[position]}>
            {player && (
                <>
                    <div className={`player-avatar ${playerStateClass}`}>
                        {player.name[0].toUpperCase()}
                    </div>
                    <div className="player-info">
                        <div className="font-bold">{player.name}</div>
                        <div className="text-gray-300">${player.stack}</div>
                        {lastAction && (
                            <div className="text-sm text-gray-400">{lastAction}</div>
                        )}
                        {isFolded && (
                            <div className="text-sm text-red-400">Folded</div>
                        )}
                    </div>
                    {player.cards && (
                        <div className="absolute top-20 left-1/2 -translate-x-1/2 flex gap-2">
                            {player.cards.map((card, index) => (
                                <TVCard key={index} {...card} hidden={!card.revealed} />
                            ))}
                        </div>
                    )}
                    {isDealer && (
                        <div className="tv-dealer-button absolute -top-4 -right-4">
                            D
                        </div>
                    )}
                    {isActive && (
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                            <TVTimer duration={30} timeLeft={player.timeLeft} />
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

// Pot display component
const PotDisplay = ({ mainPot, sidePots = [] }) => (
    <div className="pot-display">
        <div className="text-center text-2xl">Main Pot: ${mainPot}</div>
        {sidePots.map((pot, index) => (
            <div key={index} className="text-center text-lg text-gray-300">
                Side Pot {index + 1}: ${pot.amount}
            </div>
        ))}
    </div>
);

// Timer component
const TVTimer = ({ duration, timeLeft }) => {
    const circumference = 2 * Math.PI * 27; // circle radius = 27
    const offset = circumference - (timeLeft / duration) * circumference;

    return (
        <div className="turn-timer">
            <svg className="w-full h-full">
                <circle
                    className="timer-circle"
                    stroke="#4B5563"
                    strokeWidth="4"
                    fill="none"
                    r="27"
                    cx="30"
                    cy="30"
                />
                <circle
                    className="timer-circle"
                    stroke="#FCD34D"
                    strokeWidth="4"
                    fill="none"
                    r="27"
                    cx="30"
                    cy="30"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center font-bold text-xl">
                {timeLeft}
            </div>
        </div>
    );
};

// Winner notification component
const WinnerNotification = ({ winner, hand, amount }) => (
    <div className="winner-notification">
        <h2>Winner!</h2>
        <div className="text-xl mb-4">{winner}</div>
        <div className="text-yellow-400 text-2xl mb-2">${amount}</div>
        <div className="text-gray-400">{hand}</div>
    </div>
);

// Community cards component
const CommunityCards = ({ cards, stage }) => {
    const revealStages = {
        'preflop': 0,
        'flop': 3,
        'turn': 4,
        'river': 5
    };

    const revealCount = revealStages[stage] || 0;

    return (
        <div className="community-cards">
            {cards.map((card, index) => (
                <TVCard 
                    key={index}
                    {...card}
                    hidden={index >= revealCount}
                />
            ))}
        </div>
    );
};

// Main TV display component
const PokerTable = () => {
    const [gameState, setGameState] = React.useState({
        status: 'waiting', // waiting, playing, roundEnd
        stage: 'preflop', // preflop, flop, turn, river
        players: [],
        dealerPosition: 0,
        activePlayerIndex: null,
        mainPot: 0,
        sidePots: [],
        communityCards: [],
        currentBet: 0,
        lastAction: null,
        winner: null,
        handInProgress: false
    });

    // WebSocket connection and state management will be added later
    React.useEffect(() => {
        // WebSocket connection setup will go here
    }, []);

    // Calculate table positions based on number of players
    const getPlayerPositions = () => {
        const positions = new Array(8).fill(null);
        gameState.players.forEach((player, index) => {
            positions[index] = {
                ...player,
                isDealer: index === gameState.dealerPosition,
                isActive: index === gameState.activePlayerIndex,
                isFolded: player.folded
            };
        });
        return positions;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-900 to-green-800 flex items-center justify-center p-8">
            {/* Status message */}
            <div className="status-message">
                {gameState.status === 'waiting' && 'Waiting for players...'}
                {gameState.status === 'playing' && `${gameState.stage.toUpperCase()}`}
                {gameState.status === 'roundEnd' && 'Round complete'}
            </div>

            {/* Main poker table */}
            <div className="poker-table">
                <div className="table-felt">
                    {/* Community cards */}
                    {gameState.handInProgress && (
                        <CommunityCards 
                            cards={gameState.communityCards}
                            stage={gameState.stage}
                        />
                    )}

                    {/* Pot display */}
                    {gameState.mainPot > 0 && (
                        <PotDisplay 
                            mainPot={gameState.mainPot}
                            sidePots={gameState.sidePots}
                        />
                    )}

                    {/* Player positions */}
                    {getPlayerPositions().map((player, index) => (
                        <PlayerPosition
                            key={index}
                            player={player}
                            position={index}
                            isDealer={player?.isDealer}
                            isActive={player?.isActive}
                            isFolded={player?.isFolded}
                            lastAction={player?.lastAction}
                        />
                    ))}
                </div>
            </div>

            {/* Winner notification */}
            {gameState.winner && (
                <WinnerNotification
                    winner={gameState.winner.name}
                    hand={gameState.winner.hand}
                    amount={gameState.winner.amount}
                />
            )}
        </div>
    );
};

// Render the app
root.render(<PokerTable />);