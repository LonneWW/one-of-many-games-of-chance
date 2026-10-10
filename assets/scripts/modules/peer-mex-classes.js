import {
  isMatchIdValid,
  isTypeValid,
  isRoundNumberValid,
  isPayloadValid,
} from "./peer-mex-validators.js";
import { isColor } from "./colors.js";

class mexBase {
  constructor(type, matchId) {
    if (!isTypeValid(type) || !isMatchIdValid(matchId)) {
      throw new Error(
        `Invalid base for Peer Message. Type: ${type}; MatchId ${matchId}`,
      );
    }
    this.type = type;
    this.matchId = matchId;
  }
}

export class chatMex extends mexBase {
  constructor(matchId, message) {
    super("chat", matchId);
    this.payload = { message };
  }
}

export class readyMex extends mexBase {
  constructor(matchId, ready) {
    super("ready", matchId);
    if (typeof ready !== "boolean") {
      throw new Error("The ready state must be a boolean.");
    }
    this.payload = { ready };
  }
}

export class startMex extends mexBase {
  constructor(matchId, bool) {
    super("start", matchId);
    if (typeof bool !== "boolean") {
      throw new Error("The start state must be a boolean.");
    }
    this.payload = { start: bool };
  }
}

export class goneMex extends mexBase {
  constructor(matchId) {
    super("gone", matchId);
    this.payload = { reason: "left" };
  }
}

export class choiceLockedMex extends mexBase {
  constructor(matchId, roundNumber) {
    super("choice-locked", matchId);
    assertRoundNumber(roundNumber);
    this.roundNumber = roundNumber;
    this.payload = { choiceLocked: true };
  }
}

export class choiceRevealMex extends mexBase {
  constructor(matchId, roundNumber, choice) {
    super("choice-reveal", matchId);
    assertRoundNumber(roundNumber);
    if (!isColor(choice)) {
      throw new Error(`Invalid color choice: ${choice}`);
    }
    this.roundNumber = roundNumber;
    this.payload = { choice };
  }
}

export class antiCheatMex extends mexBase {
  constructor(matchId, lastRound, receivedLastRound) {
    super("anti-cheat", matchId);
    this.payload = {
      reason: "state-mismatch",
      lastRound,
      receivedLastRound,
    };

    if (!isPayloadValid(this.type, this.payload)) {
      throw new Error("Invalid anti-cheat round snapshots.");
    }
  }
}

export class roundResultMex extends mexBase {
  constructor(matchId, round) {
    super("round-result", matchId);
    if (!round) {
      throw new Error("A valid round result is required.");
    }
    assertRoundNumber(round.roundNumber);
    this.payload = {
      roundNumber: round.roundNumber,
      playerAChoice: round.playerAChoice,
      playerBChoice: round.playerBChoice,
      draw: round.draw,
      winnerKey: round.winnerKey,
      winnerColor: round.winnerColor,
      reason: round.reason,
      matchWinner: round.matchWinner,
    };
  }
}

function assertRoundNumber(roundNumber) {
  if (!isRoundNumberValid(roundNumber)) {
    throw new Error(`Invalid round number: ${roundNumber}`);
  }
  return true;
}

export class rulesMex extends mexBase {
  constructor(matchId, config) {
    super("rules", matchId);
    this.payload = { config };
  }
}

export class endMex extends mexBase {
  constructor(matchId, winnerKey, scores) {
    super("end", matchId);
    this.payload = {
      reason: "match-won",
      winnerKey,
      scores: { ...scores },
    };

    if (!isPayloadValid(this.type, this.payload)) {
      throw new Error("Invalid match-end result.");
    }
  }
}
