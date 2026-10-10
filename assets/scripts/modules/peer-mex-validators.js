import { ALL_COLORS } from "./colors.js";
import { BEST_OF_FORMATS, VALID_FORMATS } from "./rules.js";

export const ALLOWED_MEX_TYPES = [
  "rules",
  "ready",
  "start",
  "gone",
  "choice-locked",
  "choice-reveal",
  "round-result",
  "chat",
  "anti-cheat",
  "end",
];

export function checkMatchIds(localId, remoteId) {
  return localId === remoteId;
}

export function isTypeValid(type) {
  if (typeof type !== "string" || type.length === 0) {
    return false;
  }
  return ALLOWED_MEX_TYPES.includes(type);
}

export function isMatchIdValid(id) {
  return typeof id === "string" && id.length !== 0;
}

export function isRoundNumberValid(value) {
  return Number.isInteger(value) && value >= 1;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isColor(value) {
  return typeof value === "string" && ALL_COLORS.includes(value);
}

function isWinnerKey(value) {
  return value === "playerA" || value === "playerB";
}

function isScoreboardValid(scores) {
  return (
    isRecord(scores) &&
    Number.isInteger(scores.playerA) &&
    scores.playerA >= 0 &&
    Number.isInteger(scores.playerB) &&
    scores.playerB >= 0
  );
}

function isMatchWinnerValid(value) {
  return (
    value === null ||
    (isRecord(value) &&
      isWinnerKey(value.winnerKey) &&
      typeof value.winnerName === "string")
  );
}

function isRoundSnapshotValid(round) {
  if (
    !isRecord(round) ||
    !isRoundNumberValid(round.roundNumber) ||
    !isColor(round.playerAChoice) ||
    !isColor(round.playerBChoice) ||
    typeof round.draw !== "boolean" ||
    !isMatchWinnerValid(round.matchWinner)
  ) {
    return false;
  }

  if (round.draw) {
    return (
      round.playerAChoice === round.playerBChoice &&
      round.winnerKey === null &&
      round.winnerColor === null &&
      round.reason === "draw"
    );
  }

  const winnerChoice =
    round.winnerKey === "playerA"
      ? round.playerAChoice
      : round.winnerKey === "playerB"
        ? round.playerBChoice
        : null;

  return (
    round.playerAChoice !== round.playerBChoice &&
    winnerChoice !== null &&
    round.winnerColor === winnerChoice &&
    round.reason === "winner"
  );
}

function isAntiCheatPayload(payload) {
  return (
    payload.reason === "state-mismatch" &&
    isRoundSnapshotValid(payload.lastRound) &&
    isRoundSnapshotValid(payload.receivedLastRound)
  );
}

function isEndPayloadValid(payload) {
  return (
    payload.reason === "match-won" &&
    isWinnerKey(payload.winnerKey) &&
    isScoreboardValid(payload.scores) &&
    payload.scores[payload.winnerKey] >
      payload.scores[payload.winnerKey === "playerA" ? "playerB" : "playerA"]
  );
}

function isGonePayloadValid(payload) {
  return payload.reason === "left";
}

export function isMatchConfigValid(payload) {
  const config = payload.config;
  return (
    isRecord(config) &&
    typeof config.format === "number" &&
    VALID_FORMATS.includes(config.format) &&
    typeof config.bestOf === "number" &&
    BEST_OF_FORMATS.includes(config.bestOf) &&
    typeof config.timerSeconds === "number" &&
    Number.isFinite(config.timerSeconds) &&
    config.timerSeconds >= 1 &&
    (config.mode === "standard" || config.mode === "exclusive")
  );
}

export function isPayloadValid(type, payload) {
  if (!isRecord(payload)) return false;
  switch (type) {
    case "chat":
      return typeof payload.message === "string";
    case "ready":
      return typeof payload.ready === "boolean";
    case "choice-locked":
      return payload.choiceLocked === true;
    case "choice-reveal":
      return isColor(payload.choice);
    case "anti-cheat":
      return isAntiCheatPayload(payload);
    case "gone":
      return isGonePayloadValid(payload);
    case "round-result":
      return isRoundSnapshotValid(payload);
    case "rules":
      return isMatchConfigValid(payload);
    case "start":
      return typeof payload.start === "boolean";
    case "end":
      return isEndPayloadValid(payload);
    default:
      return false;
  }
}

export function isMessageValid(message) {
  if (
    !isRecord(message) ||
    !isTypeValid(message.type) ||
    !isMatchIdValid(message.matchId) ||
    !isPayloadValid(message.type, message.payload)
  ) {
    return false;
  }

  if (message.type === "choice-locked" || message.type === "choice-reveal") {
    return isRoundNumberValid(message.roundNumber);
  }

  return true;
}
