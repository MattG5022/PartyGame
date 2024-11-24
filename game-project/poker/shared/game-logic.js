const {
    HAND_RANKINGS,
    CARD_VALUES,
    CARD_SUITS,
    GAME_CONFIG
} = require('./constants');

class PokerGame {
    constructor() {
        this.deck = [];
        this.players = new Map();
        this.communityCards = [];
        this.currentBet = 0;
        this.pot = 0;
        this.sidePots = [];
        this.dealerPosition = 0;
        this.currentPosition = 0;
        this.stage = 'waiting';
    }

    // Deck management
    initializeDeck() {
        this.deck = [];
        for (const suit of CARD_SUITS) {
            for (const [value, rank] of Object.entries(CARD_VALUES)) {
                this.deck.push({ suit, value, rank });
            }
        }
        this.shuffleDeck();
    }

    shuffleDeck() {
        for (let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    dealCard() {
        return this.deck.pop();
    }

    // Player management
    addPlayer(id, name, chips = GAME_CONFIG.STARTING_CHIPS) {
        if (this.players.size >= GAME_CONFIG.MAX_PLAYERS) {
            throw new Error('Game is full');
        }

        this.players.set(id, {
            id,
            name,
            chips,
            cards: [],
            bet: 0,
            folded: false,
            allIn: false,
            lastAction: null
        });

        return this.players.get(id);
    }

    removePlayer(id) {
        this.players.delete(id);
    }

    // Betting management
    placeBet(playerId, amount) {
        const player = this.players.get(playerId);
        if (!player) throw new Error('Player not found');
        if (player.chips < amount) throw new Error('Not enough chips');

        player.chips -= amount;
        player.bet += amount;
        this.pot += amount;

        if (player.chips === 0) {
            player.allIn = true;
        }

        this.currentBet = Math.max(this.currentBet, player.bet);
        return true;
    }

    createSidePots() {
        const allInPlayers = Array.from(this.players.values())
            .filter(p => p.allIn)
            .sort((a, b) => a.bet - b.bet);

        this.sidePots = [];
        let processedBet = 0;

        for (const allInPlayer of allInPlayers) {
            const currentBet = allInPlayer.bet;
            let sidePot = 0;

            for (const player of this.players.values()) {
                const contribution = Math.min(
                    currentBet - processedBet,
                    player.bet - processedBet
                );
                if (contribution > 0) {
                    sidePot += contribution;
                    player.bet -= contribution;
                }
            }

            if (sidePot > 0) {
                this.sidePots.push({
                    amount: sidePot,
                    eligiblePlayers: Array.from(this.players.values())
                        .filter(p => !p.folded && p.bet >= currentBet)
                        .map(p => p.id)
                });
            }

            processedBet = currentBet;
        }

        // Main pot
        const mainPot = Array.from(this.players.values())
            .reduce((sum, player) => sum + player.bet, 0);

        if (mainPot > 0) {
            this.sidePots.push({
                amount: mainPot,
                eligiblePlayers: Array.from(this.players.values())
                    .filter(p => !p.folded)
                    .map(p => p.id)
            });
        }

        return this.sidePots;
    }

    // Hand evaluation
    evaluateHand(cards) {
        const allCards = [...cards];
        const values = allCards.map(card => card.rank);
        const suits = allCards.map(card => card.suit);

        // Check for flush
        const isFlush = suits.every(suit => suit === suits[0]);

        // Check for straight
        values.sort((a, b) => a - b);
        let isStraight = values.every((val, i) => 
            i === 0 || val === values[i - 1] + 1
        );

        // Special case for Ace-low straight
        if (!isStraight && values[values.length - 1] === 14) {
            const aceLowValues = values.map(v => v === 14 ? 1 : v).sort((a, b) => a - b);
            isStraight = aceLowValues.every((val, i) => 
                i === 0 || val === aceLowValues[i - 1] + 1
            );
        }

        // Count frequencies of values
        const frequencies = values.reduce((freq, val) => {
            freq[val] = (freq[val] || 0) + 1;
            return freq;
        }, {});

        const freqCounts = Object.values(frequencies).sort((a, b) => b - a);

        // Determine hand ranking
        if (isFlush && isStraight && values[values.length - 1] === 14) {
            return { rank: HAND_RANKINGS.ROYAL_FLUSH, values };
        }
        if (isFlush && isStraight) {
            return { rank: HAND_RANKINGS.STRAIGHT_FLUSH, values };
        }
        if (freqCounts[0] === 4) {
            return { rank: HAND_RANKINGS.FOUR_OF_A_KIND, values };
        }
        if (freqCounts[0] === 3 && freqCounts[1] === 2) {
            return { rank: HAND_RANKINGS.FULL_HOUSE, values };
        }
        if (isFlush) {
            return { rank: HAND_RANKINGS.FLUSH, values };
        }
        if (isStraight) {
            return { rank: HAND_RANKINGS.STRAIGHT, values };
        }
        if (freqCounts[0] === 3) {
            return { rank: HAND_RANKINGS.THREE_OF_A_KIND, values };
        }
        if (freqCounts[0] === 2 && freqCounts[1] === 2) {
            return { rank: HAND_RANKINGS.TWO_PAIR, values };
        }
        if (freqCounts[0] === 2) {
            return { rank: HAND_RANKINGS.ONE_PAIR, values };
        }
        return { rank: HAND_RANKINGS.HIGH_CARD, values };
    }

    determineWinner() {
        const playerHands = new Map();

        // Evaluate each player's hand
        for (const [playerId, player] of this.players.entries()) {
            if (player.folded) continue;

            const allCards = [...player.cards, ...this.communityCards];
            const handRanking = this.evaluateHand(allCards);
            playerHands.set(playerId, handRanking);
        }

        // Compare hands to find winner(s)
        const winners = [];
        let bestRanking = -1;

        for (const [playerId, hand] of playerHands.entries()) {
            if (hand.rank > bestRanking) {
                bestRanking = hand.rank;
                winners.length = 0;
                winners.push(playerId);
            } else if (hand.rank === bestRanking) {
                // Compare kickers if same hand rank
                const currentWinnerValues = playerHands.get(winners[0]).values;
                const challengerValues = hand.values;
                
                let isDraw = true;
                for (let i = challengerValues.length - 1; i >= 0; i--) {
                    if (challengerValues[i] > currentWinnerValues[i]) {
                        winners.length = 0;
                        winners.push(playerId);
                        isDraw = false;
                        break;
                    } else if (challengerValues[i] < currentWinnerValues[i]) {
                        isDraw = false;
                        break;
                    }
                }
                if (isDraw) {
                    winners.push(playerId);
                }
            }
        }

        return winners;
    }

    // Game state management
    nextStage() {
        switch (this.stage) {
            case 'waiting':
                this.stage = 'dealing';
                break;
            case 'dealing':
                this.stage = 'preflop';
                break;
            case 'preflop':
                this.stage = 'flop';
                this.dealCommunityCards(3);
                break;
            case 'flop':
                this.stage = 'turn';
                this.dealCommunityCards(1);
                break;
            case 'turn':
                this.stage = 'river';
                this.dealCommunityCards(1);
                break;
            case 'river':
                this.stage = 'showdown';
                break;
            default:
                this.stage = 'waiting';
        }
        return this.stage;
    }

    dealCommunityCards(count) {
        for (let i = 0; i < count; i++) {
            this.communityCards.push(this.dealCard());
        }
        return this.communityCards;
    }

    // Utility methods
    getNextActivePlayer(startPosition) {
        let position = startPosition;
        const playerCount = this.players.size;

        for (let i = 0; i < playerCount; i++) {
            position = (position + 1) % playerCount;
            const player = Array.from(this.players.values())[position];
            if (player && !player.folded && !player.allIn) {
                return position;
            }
        }

        return -1; // No active players found
    }

    serializeGameState() {
        return {
            players: Array.from(this.players.entries()).map(([id, player]) => ({
                id,
                name: player.name,
                chips: player.chips,
                bet: player.bet,
                folded: player.folded,
                allIn: player.allIn,
                lastAction: player.lastAction
            })),
            communityCards: this.communityCards,
            pot: this.pot,
            sidePots: this.sidePots,
            currentBet: this.currentBet,
            dealerPosition: this.dealerPosition,
            currentPosition: this.currentPosition,
            stage: this.stage
        };
    }
}

module.exports = PokerGame;