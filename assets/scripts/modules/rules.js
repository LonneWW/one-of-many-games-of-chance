/**
 * Core game rules.
 *
 * This module exposes the game-specific ruleset: the win matrix, lobby validation,
 * and the rule used to determine when a match is won.
 */
import { FORMAT_COLORS, getFormatColors, isColor } from "./colors.js";

export const WIN_MATRIX = Object.freeze({
  red: ["blue", "green", "orange"],
  blue: ["yellow", "purple", "indigo"],
  yellow: ["red", "green", "orange"],
  purple: ["red", "blue", "indigo"],
  green: ["purple", "yellow", "indigo"],
  orange: ["red", "purple", "blue"],
  indigo: ["green", "yellow", "orange"],
});

export const BEST_OF_FORMATS = [3, 5];
const VALID_FORMATS = Object.keys(FORMAT_COLORS).map(Number);

/**
 * Resolves a round between two colors.
 * Returns null when both colors are equal, because a draw must not create a winner.
 */
export function getWinnerColor(firstColor, secondColor) {
  if (!isColor(firstColor) || !isColor(secondColor)) {
    throw new Error(`Invalid colors: ${firstColor} vs ${secondColor}`);
  }

  if (firstColor === secondColor) {
    return null;
  }

  return WIN_MATRIX[firstColor]?.includes(secondColor)
    ? firstColor
    : secondColor;
}

/**
 * Validates the lobby configuration and returns a normalized, safe configuration object.
 *
 * This is a good place to centralize project rules before they reach the network or UI layers.
 */
export function validateLobbyConfig(config = {}) {
  const format = Number(config.format ?? 7);
  const bestOf = Number(config.bestOf ?? 3);
  const timerSeconds = Number(config.timerSeconds ?? 30);

  if (!VALID_FORMATS.includes(format)) {
    throw new Error(`Format must be 3, 5 or 7. Received: ${format}`);
  }

  if (!BEST_OF_FORMATS.includes(bestOf)) {
    throw new Error(`Best of must be 3 or 5. Received: ${bestOf}`);
  }

  if (!Number.isFinite(timerSeconds) || timerSeconds <= 0) {
    throw new Error(`Timer must be greater than 0. Received: ${timerSeconds}`);
  }

  const mode = config.mode === "exclusive" ? "exclusive" : "standard";

  return {
    format,
    mode,
    bestOf,
    timerSeconds,
    availableColors: getFormatColors(format),
  };
}

/**
 * A match is won when a player reaches the required score threshold.
 */
export function getWinningScore(bestOf) {
  return Math.ceil(Number(bestOf) / 2);
}
