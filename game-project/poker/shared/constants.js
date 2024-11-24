// Game stages
const GAME_STAGES = {
    WAITING: 'waiting',
    DEALING: 'dealing',
    PREFLOP: 'preflop',
    FLOP: 'flop',
    TURN: 'turn',
    RIVER: 'river',
    SHOWDOWN: 'showdown'
};

// Player actions
const PLAYER_ACTIONS = {
    FOLD: 'fold',
    CHECK: 'check',
    CALL: 'call',
    BET: 'bet',
    RAISE: 'raise',
    ALL_IN: 'all_in',
    DEAL: 'deal'  // Added for dealer control
};

// Hand rankings
const HAND_RANKINGS = {
    ROYAL_FLUSH: 10,
    STRAIGHT_FLUSH: 9,
    FOUR_OF_A_KIND: 8,
    FULL_HOUSE: 7,
    FLUSH: 6,
    STRAIGHT: 5,
    THREE_OF_A_KIND: 4,
    TWO_PAIR: 3,
    ONE_PAIR: 2,
    HIGH_CARD: 1
};

// Card values
const CARD_VALUES = {
    '2': 2,
    '3': 3,
    '4': 4,
    '5': 5,
    '6': 6,
    '7': 7,
    '8': 8,
    '9': 9,
    '10': 10,
    'J': 11,
    'Q': 12,
    'K': 13,
    'A': 14
};

// Card suits
const CARD_SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];

// Game configuration
const GAME_CONFIG = {
    MAX_PLAYERS: 8,
    MIN_PLAYERS: 2,
    STARTING_CHIPS: 1000,
    SMALL_BLIND: 10,
    BIG_BLIND: 20,
    MIN_RAISE: 20,
    TURN_TIME_LIMIT: 30,
    AUTO_FOLD_DELAY: 2000,
    ANIMATION_DELAY: 1000
};

// WebSocket message types (updated and merged)
const MESSAGE_TYPES = {
    // Connection and setup
    JOIN_GAME: 'join_game',
    LEAVE_GAME: 'leave_game',
    GAME_START: 'game_start',
    GAME_END: 'game_end',
    PLAYER_JOINED: 'playerJoined',
    
    // Game state updates
    PLAYER_UPDATE: 'player_update',
    TABLE_UPDATE: 'table_update',
    HAND_START: 'hand_start',
    HAND_END: 'hand_end',
    GAME_STATE: 'gameState',
    
    // Player actions and dealer controls
    PLAYER_ACTION: 'player_action',
    ACTION_REQUIRED: 'action_required',
    DEALER_ACTION: 'dealer_action',
    
    // Cards
    DEAL_CARDS: 'deal_cards',
    COMMUNITY_CARDS: 'community_cards',
    REVEAL_CARDS: 'reveal_cards',
    
    // Betting
    BETTING_ROUND: 'betting_round',
    POT_UPDATE: 'pot_update',
    
    // Results
    SHOWDOWN: 'showdown',
    WINNER_ANNOUNCEMENT: 'winner_announcement',
    
    // System messages
    ERROR: 'error',
    NOTIFICATION: 'notification'
};

// Game state flags
const GAME_FLAGS = {
    HAND_IN_PROGRESS: 'hand_in_progress',
    BETTING_IN_PROGRESS: 'betting_in_progress',
    SHOWDOWN_IN_PROGRESS: 'showdown_in_progress',
    WAITING_FOR_PLAYERS: 'waiting_for_players',
    PAUSED: 'paused'
};

// Player roles and states
const PLAYER_ROLES = {
    DEALER: 'dealer',
    SMALL_BLIND: 'small_blind',
    BIG_BLIND: 'big_blind',
    REGULAR: 'regular'
};

// Player states
const PLAYER_STATES = {
    WAITING: 'waiting',
    ACTIVE: 'active',
    FOLDED: 'folded',
    ALL_IN: 'all_in',
    DISCONNECTED: 'disconnected'
};

// Export all constants
module.exports = {
    GAME_STAGES,
    PLAYER_ACTIONS,
    HAND_RANKINGS,
    CARD_VALUES,
    CARD_SUITS,
    GAME_CONFIG,
    MESSAGE_TYPES,
    GAME_FLAGS,
    PLAYER_ROLES,
    PLAYER_STATES
};