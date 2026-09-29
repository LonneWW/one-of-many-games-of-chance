/**
 * Core color definitions for the game.
 *
 * This module is intentionally small and stable: the engine should
 * reference colors, not card names. Card names are visual metadata only.
 */
export const ALL_COLORS = [
  "red",
  "blue",
  "yellow",
  "purple",
  "green",
  "orange",
  "indigo",
];

/**
 * Default names used only in the UI layer.
 * The game logic must never depend on these strings.
 */
export const DEFAULT_CARD_NAMES = {
  red: "Tertial",
  blue: "Pax",
  yellow: "Stilren",
  purple: "Lastare",
  green: "Skubb",
  orange: "Kallax",
  indigo: "Torkis",
};

/**
 * Lobby formats: 3, 5 and 7 colors.
 * This keeps the allowed sets centralized and easy to extend.
 */
export const FORMAT_COLORS = {
  3: ["red", "blue", "green"],
  5: ["red", "blue", "yellow", "purple", "green"],
  7: [...ALL_COLORS],
};

/**
 * Returns the active color pool for a given lobby format.
 * @param {number|string} format - 3, 5 or 7
 */
export function getFormatColors(format) {
  const normalizedFormat = Number(format);

  if (!(normalizedFormat in FORMAT_COLORS)) {
    throw new Error(`Unsupported format: ${format}. Use 3, 5 or 7.`);
  }

  return [...FORMAT_COLORS[normalizedFormat]];
}

/**
 * Simple membership check for a valid game color.
 */
export function isColor(value) {
  return typeof value === "string" && ALL_COLORS.includes(value);
}

/**
 * Picks a random item from a non-empty array.
 */
export function randomChoice(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Cannot choose a random value from an empty array.");
  }

  return items[Math.floor(Math.random() * items.length)];
}

/**
 * Validates a choice against the allowed pool; otherwise falls back to a random valid color.
 */
export function normalizeColorChoice(value, allowedColors) {
  if (!isColor(value) || !allowedColors.includes(value)) {
    return randomChoice(allowedColors);
  }

  return value;
}
