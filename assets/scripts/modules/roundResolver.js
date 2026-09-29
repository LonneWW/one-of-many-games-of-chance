/**
 * Round resolution logic.
 *
 * This module handles the critical sequence of a round:
 * 1. receive or normalize each player's selection
 * 2. detect draw vs. winner
 * 3. update score and match state
 * 4. consume colors in exclusive mode when required
 */
import { randomChoice } from "./colors.js";
import { getWinnerColor } from "./rules.js";
import { applyExclusiveConsumption, checkMatchWinner } from "./matchState.js";

/**
 * Ensures each player has a valid color choice.
 * If a timeout happens or a selection is invalid, a random allowed color is chosen.
 */
function normalizeSelection(playerState, selection) {
  if (selection && playerState.remainingColors.includes(selection)) {
    return selection;
  }
  return randomChoice(playerState.remainingColors);
}

/**
 * Resolves one round based on both player choices.
 */
export function resolveRound(matchState, selections = {}) {
  const p1Choice = normalizeSelection(matchState.players.p1, selections.p1);

  const p2Choice = normalizeSelection(matchState.players.p2, selections.p2);

  const result = {
    roundNumber: matchState.roundNumber,
    p1Choice,
    p2Choice,
    draw: false,
    winnerKey: null,
    winnerColor: null,
    reason: "round_resolved",
    matchWinner: null,
  };

  if (p1Choice === p2Choice) {
    result.draw = true;
    result.reason = "draw";

    if (matchState.mode === "exclusive") {
      applyExclusiveConsumption(matchState, "p1", p1Choice);
      applyExclusiveConsumption(matchState, "p2", p2Choice);
    }

    matchState.lastRound = result;
    return result;
  }

  const winnerColor = getWinnerColor(p1Choice, p2Choice);
  result.winnerKey = winnerColor === p1Choice ? "p1" : "p2";
  result.winnerColor = winnerColor;
  result.reason = "winner";

  matchState.scores[result.winnerKey] += 1;

  if (matchState.mode === "exclusive") {
    applyExclusiveConsumption(matchState, "p1", p1Choice);
    applyExclusiveConsumption(matchState, "p2", p2Choice);
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
