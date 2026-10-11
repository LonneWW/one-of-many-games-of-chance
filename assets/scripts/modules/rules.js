import { FORMAT_COLORS, getFormatColors, isColor } from "./colors.js";

// win matrix; defines the winning conditions of a color
export const WIN_MATRIX = Object.freeze({
  red: ["blue", "yellow", "orange"], // lose against green, purple, indigo
  blue: ["green", "yellow", "orange"], // lose against red, purple, indigo
  yellow: ["purple", "green", "orange"], // lose against red, blue, indigo
  purple: ["red", "blue", "indigo"], // lose against yellow, green, orange
  green: ["purple", "red", "indigo"], // lose against blue, yellow, orange
  orange: ["green", "purple", "indigo"], // lose against red, blue, yellow
  indigo: ["blue", "yellow", "red"], // lose against green, purple, orange
});

export const BEST_OF_FORMATS = [3, 5];

export const VALID_FORMATS = Object.keys(FORMAT_COLORS).map(Number); // easier to map format color in case of future additions (VERY difficult)

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

export function validateLobbyConfig(config = {}) {
  const format = Number(config.format ?? 7);
  const bestOf = Number(config.bestOf ?? 3);
  const timerSeconds = Number(config.timerSeconds ?? 30);

  if (!VALID_FORMATS.includes(format)) {
    throw new Error(`Format must be 3, 5 or 7. Received: ${format}`); // Error messages are not dynamic atm, but it's currently unnecessary
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

export function getWinningScore(bestOf) {
  return Math.ceil(Number(bestOf) / 2);
}
