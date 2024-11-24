const { GAME_STAGES, PLAYER_ACTIONS } = require('./constants');
const DeckHandler = require('./deck-handler');
const ActionHandler = require('./action-handler');

class PokerGameHandler {
    constructor(gameId, game, broadcastToTV, broadcastToGame, players) {
        this.gameId = gameId;
        this.game = game;
        this.broadcastToTV = broadcastToTV;
        this.broadcastToGame = broadcastToGame;
        this.players = players;
        this.deck = DeckHandler.createDeck();
        this.communityCards = [];
        this.playerCards = new Map();
        this.currentStage = GAME_STAGES.WAITING;
        this.dealerPosition = 0;
        this.activePlayerIndex = 0;
        this.pot = 0;
        this.currentBet = 0;
        this.minBet = 10;
        this.maxBet = 1000;
        this.playerStacks = new Map();
        this.lastAction = null;
        this.roundBets = new Map();
        this.activePlayers = new Set();
        this.lastRaiseIndex = -1;
        
        console.log('Initializing Poker Game Handler');
        this.initializePlayers();
        this.broadcastPlayerUpdate();
        setTimeout(() => this.startNewHand(), 1000);
        this.gameInProgress = false;
    }
    initializeNewPlayer(playerId) {
        console.log('Initializing new player:', playerId);
        this.playerStacks.set(playerId, 1000);
        this.activePlayers.add(playerId);
        
        // If we're in the middle of a hand, wait for the next one
        if (this.currentStage !== GAME_STAGES.WAITING) {
            console.log('Hand in progress, player will join next hand');
            return;
        }
        
        // If this is the first player, add dealer and start
        if (this.game.getPlayers().size === 1) {
            console.log('First player joined, adding dealer');
            this.addDealer();
            setTimeout(() => this.startNewHand(), 1000);
        }
        // If we now have enough players, start a new hand
        else if (this.game.getPlayers().size >= 2) {
            console.log('Starting new hand with newly joined player');
            setTimeout(() => this.startNewHand(), 1000);
        }
    }
    initializePlayers() {
        console.log('Initializing players');
        
        // Clear existing state
        this.playerStacks.clear();
        this.activePlayers.clear();

        // Initialize human players first
        Array.from(this.game.getPlayers()).forEach(playerId => {
            this.playerStacks.set(playerId, 1000);
            this.activePlayers.add(playerId);
            console.log(`Initialized player ${playerId} with stack of 1000`);
        });

        // If we only have one player, force add the dealer
        if (this.game.getPlayers().size === 1) {
            console.log('Single player detected, adding AI dealer');
            this.addDealer();
            // Start new hand after dealer is added
            console.log('Starting game with dealer');
            setTimeout(() => this.startNewHand(), 1000);
        }
        // If we have 2 or more players, start the game
        else if (this.game.getPlayers().size >= 2) {
            console.log('Starting game with', this.game.getPlayers().size, 'players');
            setTimeout(() => this.startNewHand(), 1000);
        }
        // If no players, stay in waiting state
        else {
            console.log('Waiting for players');
            this.currentStage = GAME_STAGES.WAITING;
            this.gameInProgress = false;
            this.broadcastGameState();
        }
    }

    addDealer() {
        const dealerId = 'dealer-ai';
        console.log('Adding dealer with ID:', dealerId);
        
        // Remove dealer if it already exists
        if (this.players.has(dealerId)) {
            this.game.removePlayer(dealerId);
            this.players.delete(dealerId);
            this.playerStacks.delete(dealerId);
            this.activePlayers.delete(dealerId);
        }

        // Add dealer to game and players
        this.game.addPlayer(dealerId, 'Dealer');
        this.players.set(dealerId, {
            id: dealerId,
            name: 'Dealer',
            isAI: true
        });
        
        // Initialize dealer's stack and status
        this.playerStacks.set(dealerId, 1000);
        this.activePlayers.add(dealerId);
        
        console.log('Dealer added successfully, players now:', 
            Array.from(this.game.getPlayers()).map(id => ({
                id,
                isAI: this.players.get(id)?.isAI
            }))
        );
        
        this.broadcastPlayerUpdate();
    }


    startNewHand() {
        console.log('Starting new hand');
        
        if (this.game.getPlayers().size < 2) {
            console.log('Not enough players to start');
            this.currentStage = GAME_STAGES.WAITING;
            this.broadcastGameState();
            return;
        }

        this.deck = DeckHandler.createDeck();
        this.communityCards = [];
        this.playerCards.clear();
        this.currentStage = GAME_STAGES.PREFLOP;
        this.pot = 0;
        this.currentBet = this.minBet;  // Set initial bet to minBet
        this.roundBets.clear();
        this.activePlayers = new Set(this.game.getPlayers());
        this.lastRaiseIndex = -1;

        // Deal initial cards
        this.dealInitialCards();
        
        // Broadcast initial state
        this.broadcastGameState();

        // Schedule dealer action if it's dealer's turn
        if (this.players.get(Array.from(this.game.getPlayers())[this.activePlayerIndex])?.isAI) {
            setTimeout(() => this.handleDealerAction(), 2000);
        }
    }


    dealInitialCards() {
        console.log('Dealing initial cards');
        const playerIds = Array.from(this.game.getPlayers());
        
        // First deal cards to all players
        playerIds.forEach(playerId => {
            const card1 = this.deck.pop();
            const card2 = this.deck.pop();
            
            if (!card1 || !card2) {
                console.error('Error dealing cards - deck empty');
                return;
            }

            const cards = [card1, card2];
            cards.forEach(card => {
                card.revealed = !this.players.get(playerId)?.isAI;
            });
            
            this.playerCards.set(playerId, cards);
            console.log(`Dealt cards to player ${playerId}:`, 
                cards.map(c => c.revealed ? `${c.value}${c.suit}` : 'hidden'));
        });

        // Then handle blinds
        playerIds.forEach(playerId => {
            let blind = 0;
            if (playerId === playerIds[(this.dealerPosition + 1) % playerIds.length]) {
                // Small blind
                blind = this.minBet / 2;
                console.log(`Setting small blind for ${playerId}: ${blind}`);
            } else if (playerId === playerIds[(this.dealerPosition + 2) % playerIds.length]) {
                // Big blind
                blind = this.minBet;
                console.log(`Setting big blind for ${playerId}: ${blind}`);
            }

            if (blind > 0) {
                const currentStack = this.playerStacks.get(playerId) || 0;
                this.playerStacks.set(playerId, currentStack - blind);
                this.pot += blind;
                this.roundBets.set(playerId, blind);
            } else {
                this.roundBets.set(playerId, 0);
            }
        });

        // Set active player (after big blind)
        this.activePlayerIndex = (this.dealerPosition + 3) % playerIds.length;
        console.log('Initial dealing complete:', {
            activePlayer: this.activePlayerIndex,
            pot: this.pot,
            currentBet: this.currentBet
        });

        // Immediately send state to all players
        playerIds.forEach(playerId => {
            this.sendPlayerState(playerId);
        });
    }
    handleAction(playerId, action, amount = null) {
        console.log('PokerHandler received action:', { playerId, action, amount });
        
        if (!this.activePlayers.has(playerId)) {
            console.log('Player not active:', playerId);
            return false;
        }

        if (Array.from(this.game.getPlayers())[this.activePlayerIndex] !== playerId) {
            console.log('Not player\'s turn:', {
                activePlayer: Array.from(this.game.getPlayers())[this.activePlayerIndex],
                attemptingPlayer: playerId
            });
            return false;
        }

        const success = ActionHandler.handleAction(this, playerId, action, amount);
        if (success) {
            this.nextPlayer();
        }
        return success;
    }

    // poker-handler.js
handleDealerAction() {
    console.log('Handling dealer action');

    const dealerId = 'dealer-ai';
    const dealerCards = this.playerCards.get(dealerId);
    const dealerStack = this.playerStacks.get(dealerId);
    const currentBet = this.currentBet;
    const toCall = currentBet - (this.roundBets.get(dealerId) || 0);

    let action = '';
    let amount = 0;

    // Implement the logic for determining the dealer's action based on the game state
    if (toCall === 0) {
        // If the dealer doesn't need to call, it can check or raise
        if (Math.random() < 0.7) {
            action = PLAYER_ACTIONS.CHECK;
        } else {
            action = PLAYER_ACTIONS.RAISE;
            amount = Math.min(dealerStack, currentBet + this.minBet);
        }
    } else {
        // If the dealer needs to call, it can call or fold
        if (Math.random() < 0.8) {
            action = PLAYER_ACTIONS.CALL;
        } else {
            action = PLAYER_ACTIONS.FOLD;
        }
    }

    console.log('Dealer action:', action, amount);

    // Handle the dealer's action
    if (ActionHandler.handleAction(this, dealerId, action, amount)) {
        this.nextPlayer();
    }
}

    nextPlayer() {
        const playerIds = Array.from(this.game.getPlayers());
        console.log('Moving to next player', {
            currentIndex: this.activePlayerIndex,
            playerCount: playerIds.length
        });

        do {
            this.activePlayerIndex = (this.activePlayerIndex + 1) % playerIds.length;
        } while (!this.activePlayers.has(playerIds[this.activePlayerIndex]));

        console.log('Next player determined:', {
            newActivePlayer: playerIds[this.activePlayerIndex],
            isAI: this.players.get(playerIds[this.activePlayerIndex])?.isAI
        });

        if (this.shouldAdvanceStage()) {
            this.advanceStage();
        } else {
            this.broadcastGameState();
            const nextPlayerId = playerIds[this.activePlayerIndex];
            if (this.players.get(nextPlayerId)?.isAI) {
                console.log('AI player turn, scheduling action');
                setTimeout(() => this.handleDealerAction(), 2000);
            }
        }
    }

    shouldAdvanceStage() {
        if (this.activePlayers.size === 1) {
            console.log('Only one active player - advancing stage');
            return true;
        }

        const allBetsEqual = Array.from(this.activePlayers).every(
            playerId => this.roundBets.get(playerId) === this.currentBet
        );

        const shouldAdvance = allBetsEqual && 
            (this.activePlayerIndex === this.lastRaiseIndex || 
             this.activePlayerIndex === this.dealerPosition);

        console.log('Stage advance check:', {
            allBetsEqual,
            activePlayerIndex: this.activePlayerIndex,
            lastRaiseIndex: this.lastRaiseIndex,
            dealerPosition: this.dealerPosition,
            shouldAdvance
        });

        return shouldAdvance;
    }

    advanceStage() {
        console.log('Advancing stage from', this.currentStage);
        this.lastRaiseIndex = -1;
        this.currentBet = 0;
        this.roundBets.clear();

        switch (this.currentStage) {
            case GAME_STAGES.PREFLOP:
                this.currentStage = GAME_STAGES.FLOP;
                this.communityCards = [
                    this.deck.pop(),
                    this.deck.pop(),
                    this.deck.pop()
                ];
                console.log('Dealt flop:', this.communityCards);
                break;

            case GAME_STAGES.FLOP:
                this.currentStage = GAME_STAGES.TURN;
                this.communityCards.push(this.deck.pop());
                console.log('Dealt turn:', this.communityCards);
                break;

            case GAME_STAGES.TURN:
                this.currentStage = GAME_STAGES.RIVER;
                this.communityCards.push(this.deck.pop());
                console.log('Dealt river:', this.communityCards);
                break;

            case GAME_STAGES.RIVER:
                this.currentStage = GAME_STAGES.SHOWDOWN;
                this.handleShowdown();
                return;
        }

        this.activePlayerIndex = (this.dealerPosition + 1) % this.game.getPlayers().size;
        this.lastAction = null;
        this.broadcastGameState();

        if (this.players.get(Array.from(this.game.getPlayers())[this.activePlayerIndex])?.isAI) {
            setTimeout(() => this.handleDealerAction(), 2000);
        }
    }

    handleShowdown() {
        console.log('Handling showdown');
        // Reveal all cards
        this.playerCards.forEach(cards => {
            cards.forEach(card => card.revealed = true);
        });

        this.broadcastGameState();

        // Wait to show the cards, then handle winnings and start new hand
        setTimeout(() => {
            // Calculate and distribute winnings
            const playerIds = Array.from(this.activePlayers);
            const winningAmount = Math.floor(this.pot / playerIds.length);
            
            playerIds.forEach(playerId => {
                const currentStack = this.playerStacks.get(playerId) || 0;
                this.playerStacks.set(
                    playerId,
                    currentStack + winningAmount
                );
            });

            // Reset game state
            this.pot = 0;
            this.currentStage = GAME_STAGES.WAITING;
            
            // Broadcast final state of current hand
            this.broadcastGameState();

            // Start new hand after a delay
            setTimeout(() => {
                // Move dealer button
                this.dealerPosition = (this.dealerPosition + 1) % this.game.getPlayers().size;
                // Start the new hand
                this.startNewHand();
            }, 3000);

        }, 2000);
    }

    sendPlayerState(playerId) {
        const player = this.players.get(playerId);
        if (player && player.ws && !player.isAI) {
            player.ws.send(JSON.stringify({
                type: 'gameState',
                stage: this.currentStage,
                pot: this.pot,
                currentBet: this.currentBet,
                stack: this.playerStacks.get(playerId),
                playerCards: this.playerCards.get(playerId),
                communityCards: this.communityCards,
                playerId: playerId,
                isCurrentPlayer: this.activePlayerIndex !== -1 && 
                    Array.from(this.game.getPlayers())[this.activePlayerIndex] === playerId,
                lastAction: this.lastAction,
                roundBets: Array.from(this.roundBets.entries())
            }));
        }
    }

    broadcastGameState() {
        const playerIds = Array.from(this.game.getPlayers());
        
        this.broadcastToTV({
            type: 'gameState',
            stage: this.currentStage,
            pot: this.pot,
            currentBet: this.currentBet,
            dealerPosition: this.dealerPosition,
            activePlayerIndex: this.activePlayerIndex,
            communityCards: this.communityCards,
            lastAction: this.lastAction,
            players: playerIds.map(playerId => ({
                id: playerId,
                name: this.players.get(playerId)?.name,
                isAI: this.players.get(playerId)?.isAI,
                stack: this.playerStacks.get(playerId),
                cards: this.playerCards.get(playerId)?.map(card => ({
                    ...card,
                    revealed: this.currentStage === GAME_STAGES.SHOWDOWN || 
                             !this.players.get(playerId)?.isAI
                }))
            }))
        });

        playerIds.forEach(playerId => this.sendPlayerState(playerId));
    }

    broadcastPlayerUpdate() {
        const playerUpdate = {
            type: 'playerUpdate',
            players: Array.from(this.game.getPlayers()).map(playerId => ({
                id: playerId,
                name: this.players.get(playerId)?.name,
                stack: this.playerStacks.get(playerId),
                isAI: this.players.get(playerId)?.isAI
            }))
        };

        Array.from(this.game.getPlayers()).forEach(playerId => {
            const player = this.players.get(playerId);
            if (player && player.ws && !player.isAI) {
                player.ws.send(JSON.stringify(playerUpdate));
            }
        });
    }
}

module.exports = { PokerGameHandler };