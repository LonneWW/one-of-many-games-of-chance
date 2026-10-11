import { getFormatColors, randomChoice } from "./colors.js";
import { getWinningScore, validateLobbyConfig } from "./rules.js";

//Creates the player status for a given lobby format.
//The player stores both the currently available colors and the ones already used.
export function createPlayerState(id, name, format) {
  const availableColors = getFormatColors(format);

  return {
    id,
    name,
    remainingColors: [...availableColors],
    usedColors: [],
  };
}

function generateMatchId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  // Fallback for older environments without crypto.randomUUID support
  return (
    "partita-" +
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).substring(2, 9)
  );
}

//Creates the global match state from lobby configuration.
export function createMatchState(config = {}) {
  const settings = validateLobbyConfig(config);

  return {
    matchId: config.matchId ?? generateMatchId(),
    format: settings.format,
    mode: settings.mode,
    bestOf: settings.bestOf,
    timerSeconds: settings.timerSeconds,
    roundNumber: 1,
    scores: { playerA: 0, playerB: 0 },
    winner: null,
    complete: false,
    reason: null,
    players: {
      playerA: createPlayerState(
        "playerA",
        config.playerOneName ?? "Host",
        settings.format,
      ),
      playerB: createPlayerState(
        "playerB",
        config.playerTwoName ?? "Joiner",
        settings.format,
      ),
    },
    lastRound: null,
  };
}

//Applies exclusive-mode consumption rules.
//Once a color is used, it leaves the player's available set. If the pool is exhausted,
//the player is restored to the full format pool, as required by the design.
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

//In case of disconnect, change the current match state in favor of the remaining player
export function resolveDisconnect(matchState, disconnectedPlayerKey) {
  const winnerKey = disconnectedPlayerKey === "playerA" ? "playerB" : "playerA";

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

//Checks if either player has reached the threshold to win the match; if positive, changes the match state
export function checkMatchWinner(matchState) {
  const scoreToWin = getWinningScore(matchState.bestOf); // 3 -> 2, 5 -> 3, 7 -> 4

  for (const playerKey of ["playerA", "playerB"]) {
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

//Picks a valid random color for the player when time expires.
export function autoChooseRandomColor(playerState) {
  if (
    !Array.isArray(playerState.remainingColors) ||
    playerState.remainingColors.length === 0
  ) {
    throw new Error(`Player ${playerState.name} has no available colors.`);
  }

  return randomChoice(playerState.remainingColors);
}
