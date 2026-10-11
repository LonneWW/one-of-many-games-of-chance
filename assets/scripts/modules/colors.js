// list of colors representing the suits
export const ALL_COLORS = [
  "red",
  "blue",
  "yellow",
  "purple",
  "green",
  "orange",
  "indigo",
];

//list of default card names (when card will be used!)
export const DEFAULT_CARD_NAMES = {
  red: "Tertial",
  blue: "Pax",
  yellow: "Stilren",
  purple: "Lastare",
  green: "Skubb",
  orange: "Kallax",
  indigo: "Torkis",
};

//allowed colors based on the selected format
export const FORMAT_COLORS = {
  3: ["red", "blue", "green"],
  5: ["red", "blue", "yellow", "purple", "green"],
  7: [...ALL_COLORS],
};

// returns the active color pool for a given lobby format
export function getFormatColors(format) {
  const normalizedFormat = Number(format);

  if (!(normalizedFormat in FORMAT_COLORS)) {
    throw new Error(`Unsupported format: ${format}. Use 3, 5 or 7.`);
  }

  return [...FORMAT_COLORS[normalizedFormat]];
}

// checks if the value is a valid color
export function isColor(value) {
  return typeof value === "string" && ALL_COLORS.includes(value);
}

// picks a random color from a given list (based on the game format; showed in "normalizeColorChoice" just below)
export function randomChoice(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Cannot choose a random value from an empty array.");
  }

  return items[Math.floor(Math.random() * items.length)];
}

// given the choice and allowed colors checks if the color picked is valid; otherwise picks a random one
export function normalizeColorChoice(value, allowedColors) {
  if (!isColor(value) || !allowedColors.includes(value)) {
    return randomChoice(allowedColors);
  }

  return value;
}
