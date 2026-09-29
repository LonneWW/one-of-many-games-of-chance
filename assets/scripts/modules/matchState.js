/**
 * Match state and player state.
 *
 * This module models the in-memory state of a match without touching the UI.
 * It keeps the rules explicit and easy to reason about:
 * - players have a color pool
 * - rounds update scores
 * - exclusive mode consumes colors
 * - disconnects resolve immediately in favor of the other player
 */
import { getFormatColors, randomChoice } from "./colors.js";
import { getWinningScore, validateLobbyConfig } from "./rules.js";

/**
 * Creates the player status for a given lobby format.
 * The player stores both the currently available colors and the ones already used.
 */
export function createPlayerState(id, name, format) {
  const availableColors = getFormatColors(format);

  return {
    id,
    name,
    remainingColors: [...availableColors],
    usedColors: [],
  };
}

/**
 * Creates the global match state from lobby configuration.
 */
export function createMatchState(config = {}) {
  const settings = validateLobbyConfig(config);

  return {
    format: settings.format,
    mode: settings.mode,
    bestOf: settings.bestOf,
    timerSeconds: settings.timerSeconds,
    roundNumber: 1,
    scores: { p1: 0, p2: 0 },
    winner: null,
    complete: false,
    reason: null,
    players: {
      p1: createPlayerState(
        "p1",
        config.playerOneName ?? "Player 1",
        settings.format,
      ),
      p2: createPlayerState(
        "p2",
        config.playerTwoName ?? "Player 2",
        settings.format,
      ),
    },
    lastRound: null,
  };
}

/**
 * Applies exclusive-mode consumption rules.
 *
 * Once a color is used, it leaves the player's available set. If the pool is exhausted,
 * the player is restored to the full format pool, as required by the design.
 */
export function applyExclusiveConsumption(matchState, playerKey, color) {
  const player = matchState.players[playerKey];

  if (!player) {
    throw new Error(`Unknown player key: ${playerKey}`);
  }

  player.remainingColors = player.remainingColors.filter(
    (entry) => entry !== color,
  );
  player.usedColors = Array.from(new Set([...player.usedColors, color]));

  if (player.remainingColors.length === 0) {
    player.remainingColors = [...getFormatColors(matchState.format)];
    player.usedColors = [];
  }
}

/**
 * Immediately resolves a disconnect in favor of the remaining player.
 */
export function resolveDisconnect(matchState, disconnectedPlayerKey) {
  const winnerKey = disconnectedPlayerKey === "p1" ? "p2" : "p1";

  matchState.complete = true;
  matchState.winner = winnerKey;
  matchState.reason = "disconnect";
  matchState.lastRound = {
    winnerKey,
    reason: "disconnect",
    disconnectedPlayerKey,
  };

  return {
    winnerKey,
    winnerName: matchState.players[winnerKey].name,
  };
}

/**
 * Checks if either player has reached the threshold to win the match.
 */
export function checkMatchWinner(matchState) {
  const scoreToWin = getWinningScore(matchState.bestOf);

  for (const playerKey of ["p1", "p2"]) {
    if (matchState.scores[playerKey] >= scoreToWin) {
      matchState.complete = true;
      matchState.winner = playerKey;
      matchState.reason = "match_won";
      return {
        winnerKey: playerKey,
        winnerName: matchState.players[playerKey].name,
      };
    }
  }

  return null;
}

/**
 * Picks a valid random color for the player when time expires.
 */
export function autoChooseRandomColor(playerState) {
  if (
    !Array.isArray(playerState.remainingColors) ||
    playerState.remainingColors.length === 0
  ) {
    throw new Error(`Player ${playerState.name} has no available colors.`);
  }

  return randomChoice(playerState.remainingColors);
}
