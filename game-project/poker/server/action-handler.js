// server/action-handler.js

const { PLAYER_ACTIONS } = require('./constants');

class ActionHandler {
    static handleAction(game, playerId, actionData, amount = null) {
        console.log('Processing action:', { playerId, actionData, amount });
        
        // Get current player state
        const playerStack = game.playerStacks.get(playerId) || 0;
        const currentPlayerBet = game.roundBets.get(playerId) || 0;
        const toCall = game.currentBet - currentPlayerBet;

        let actionValid = false;
        let betAmount = 0;

        // Extract action from actionData
        const action = typeof actionData === 'string' ? actionData : actionData.action;

        switch (action.toLowerCase()) {
            case PLAYER_ACTIONS.FOLD:
                game.activePlayers.delete(playerId);
                actionValid = true;
                break;

            case PLAYER_ACTIONS.CHECK:
                if (toCall === 0) {
                    actionValid = true;
                }
                break;

            case PLAYER_ACTIONS.CALL:
                if (toCall === 0) {
                    actionValid = true;
                    break;
                }
                
                if (toCall <= playerStack) {
                    betAmount = toCall;
                    game.playerStacks.set(playerId, playerStack - betAmount);
                    game.pot += betAmount;
                    game.roundBets.set(playerId, currentPlayerBet + betAmount);
                    actionValid = true;
                }
                break;

            case PLAYER_ACTIONS.RAISE:
                const raiseAmount = Number(amount);
                if (isNaN(raiseAmount) || raiseAmount <= 0) {
                    return false;
                }

                const minRaise = Math.max(game.currentBet + game.minBet, game.currentBet * 2);
                const maxRaise = Math.min(playerStack + currentPlayerBet, game.maxBet);

                if (raiseAmount >= minRaise && raiseAmount <= maxRaise) {
                    betAmount = raiseAmount - currentPlayerBet;
                    game.playerStacks.set(playerId, playerStack - betAmount);
                    game.pot += betAmount;
                    game.currentBet = raiseAmount;
                    game.roundBets.set(playerId, raiseAmount);
                    game.lastRaiseIndex = game.activePlayerIndex;
                    actionValid = true;
                }
                break;
        }

        if (actionValid) {
            game.lastAction = {
                playerId,
                action: action.toLowerCase(),
                amount: betAmount,
                timestamp: Date.now()
            };
            game.broadcastGameState();
            return true;
        }

        return false;
    }
}

module.exports = ActionHandler;