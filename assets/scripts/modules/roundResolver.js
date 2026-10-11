import { randomChoice } from "./colors.js";
import { getWinnerColor } from "./rules.js";
import { applyExclusiveConsumption, checkMatchWinner } from "./matchState.js";

//Ensures each player has a valid color choice.
//If a timeout happens or a selection is invalid, a random allowed color is chosen.
function normalizeSelection(playerState, selection) {
  if (selection && playerState.remainingColors.includes(selection)) {
    return selection;
  }
  return randomChoice(playerState.remainingColors);
}

// Resolves one round based on both player choices. (used esclusively by the host!)
export function resolveRound(matchState, selections = {}) {
  const playerAChoice = normalizeSelection(
    matchState.players.playerA,
    selections.playerA,
  );

  const playerBChoice = normalizeSelection(
    matchState.players.playerB,
    selections.playerB,
  );

  const result = {
    roundNumber: matchState.roundNumber,
    playerAChoice,
    playerBChoice,
    draw: false,
    winnerKey: null,
    winnerColor: null,
    reason: "round_resolved",
    matchWinner: null,
  };

  if (playerAChoice === playerBChoice) {
    result.draw = true;
    result.reason = "draw";

    if (matchState.mode === "exclusive") {
      applyExclusiveConsumption(matchState, "playerA", playerAChoice);
      applyExclusiveConsumption(matchState, "playerB", playerBChoice);
    }

    matchState.lastRound = result;
    return result;
  }

  const winnerColor = getWinnerColor(playerAChoice, playerBChoice);
  result.winnerKey = winnerColor === playerAChoice ? "playerA" : "playerB";
  result.winnerColor = winnerColor;
  result.reason = "winner";

  matchState.scores[result.winnerKey] += 1;

  if (matchState.mode === "exclusive") {
    applyExclusiveConsumption(matchState, "playerA", playerAChoice);
    applyExclusiveConsumption(matchState, "playerB", playerBChoice);
  }

  matchState.lastRound = result;

  const matchWinner = checkMatchWinner(matchState);
  if (matchWinner) {
    result.matchWinner = matchWinner;
    return result;
  }

  matchState.roundNumber += 1;
  return result;
}
