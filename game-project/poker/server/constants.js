// server/constants.js

const GAME_STAGES = {
    CONNECTING: 'connecting',
    WAITING: 'waiting',
    PREFLOP: 'preflop',
    FLOP: 'flop',
    TURN: 'turn',
    RIVER: 'river',
    SHOWDOWN: 'showdown'
};

const PLAYER_ACTIONS = {
    FOLD: 'fold',
    CHECK: 'check',
    CALL: 'call',
    RAISE: 'raise'
};

module.exports = { 
    GAME_STAGES, 
    PLAYER_ACTIONS
};