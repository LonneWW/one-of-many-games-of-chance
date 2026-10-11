import {
  applyExclusiveConsumption,
  autoChooseRandomColor,
  createMatchState,
  resolveDisconnect,
} from "./modules/matchState.js";
import {
  checkMatchIds,
  isMatchConfigValid,
} from "./modules/peer-mex-validators.js";
import { resolveRound } from "./modules/roundResolver.js";
import {
  connectToPeer,
  disconnectPeer,
  sendPeerMessage,
  setConnectionCloseHandler,
  setConnectionOpenHandler,
  setMessageHandler,
  setPeerLifecycleHandler,
} from "./modules/network.js";
import {
  antiCheatMex,
  chatMex,
  choiceLockedMex,
  choiceRevealMex,
  endMex,
  goneMex,
  readyMex,
  roundResultMex,
  rulesMex,
  startMex,
} from "./modules/peer-mex-classes.js";

const initialMatchConfig = {
  format: 3,
  bestOf: 3,
  timerSeconds: 30,
  mode: "standard",
};
const CHOICE_REVEAL_GRACE_PERIOD_MS = 1000;

const state = {
  network: {
    status: "initializing",
    localPeerId: null,
    remotePeerId: null,
    connected: false,
    localPlayerKey: null,
    remotePlayerKey: null,
  },
  lobby: {
    playerAReady: false,
    playerBReady: false,
  },
  match: createMatchState(initialMatchConfig),
  round: createRoundState(initialMatchConfig.timerSeconds),
  ui: {
    result: null,
    error: null,
    isRunning: false,
    matchStarted: false,
  },
  chat: [],
};

const stateListeners = new Set();

class OutgoingPeerMessageHandler {
  static onConnectionOpen(connectionContext) {
    const isHost = connectionContext.direction === "in ingresso";
    state.network.status = "connected";
    state.network.remotePeerId = connectionContext.peerId;
    state.network.connected = true;
    state.network.localPlayerKey = isHost ? "playerA" : "playerB";
    state.network.remotePlayerKey = isHost ? "playerB" : "playerA";

    if (isHost) this.sendRules();
    publishState();
  }

  static send(message) {
    sendPeerMessage(message);
  }

  static sendRules() {
    const config = {
      format: state.match.format,
      bestOf: state.match.bestOf,
      timerSeconds: state.match.timerSeconds,
      mode: state.match.mode,
    };
    this.send(new rulesMex(state.match.matchId, config));
  }

  static sendChat(message) {
    this.send(new chatMex(state.match.matchId, message));
  }

  static sendReady(ready) {
    this.send(new readyMex(state.match.matchId, ready));
  }

  static sendStart(start) {
    this.send(new startMex(state.match.matchId, start));
  }

  static sendGone() {
    this.send(new goneMex(state.match.matchId));
  }

  static sendChoiceLocked() {
    this.send(
      new choiceLockedMex(state.match.matchId, state.match.roundNumber),
    );
  }

  static sendChoiceReveal(choice) {
    this.send(
      new choiceRevealMex(state.match.matchId, state.match.roundNumber, choice),
    );
  }

  static sendRoundResult(round) {
    this.send(new roundResultMex(state.match.matchId, round));
  }

  static sendAntiCheat(lastRound, receivedLastRound) {
    this.send(
      new antiCheatMex(state.match.matchId, lastRound, receivedLastRound),
    );
  }

  static sendEnd(winnerKey, scores) {
    this.send(new endMex(state.match.matchId, winnerKey, scores));
  }
}

class IncomingPeerMessageHandler {
  static handle(message, connectionContext) {
    if (
      message.type !== "rules" &&
      !checkMatchIds(state.match.matchId, message.matchId)
    ) {
      console.warn("Ignoring message from a different match.", {
        type: message.type,
        matchId: message.matchId,
      });
      return;
    }

    switch (message.type) {
      case "chat":
        this.handleChat(message.payload);
        break;
      case "ready":
        this.handleReady(message.payload, connectionContext);
        break;
      case "start":
        this.handleStart(message.payload);
        break;
      case "gone":
        this.handleGone(connectionContext);
        break;
      case "choice-locked":
        this.handleChoiceLocked(message, connectionContext);
        break;
      case "choice-reveal":
        this.handleChoiceReveal(message, connectionContext);
        break;
      case "round-result":
        this.handleRoundResult(message.payload);
        break;
      case "rules":
        this.handleRules(message, connectionContext);
        break;
      case "anti-cheat":
        this.handleAntiCheat(message.payload);
        break;
      case "end":
        this.handleEnd(message.payload);
        break;
      default:
        console.warn("No incoming handler for message type:", message.type);
        return;
    }

    publishState();
  }

  static handleChat(payload) {
    state.chat.push({ from: "Opponent", message: payload.message });
  }

  static handleReady(payload, connectionContext) {
    const remotePlayerKey = getRemotePlayerKey(connectionContext);
    state.lobby[`${remotePlayerKey}Ready`] = payload.ready;
    maybeStartMatch();
  }

  static handleStart(payload) {
    if (state.network.localPlayerKey !== "playerB" || !payload.start) return;
    state.ui.matchStarted = true;
    startTimer();
  }

  static handleGone(connectionContext) {
    if (state.ui.matchStarted) {
      resolveMatchDisconnect(connectionContext, false);
    }
  }

  static handleChoiceLocked(message, connectionContext) {
    if (!isCurrentRoundMessage(message)) return;
    const remotePlayerKey = getRemotePlayerKey(connectionContext);
    state.round[`${remotePlayerKey}Locked`] = true;
    tryResolveForHost();
  }

  static handleChoiceReveal(message, connectionContext) {
    if (!isCurrentRoundMessage(message)) return;
    const remotePlayerKey = getRemotePlayerKey(connectionContext);
    state.round[`${remotePlayerKey}Choice`] = message.payload.choice;
    state.round[`${remotePlayerKey}Locked`] = true;
    tryResolveForHost();
  }

  static handleRoundResult(result) {
    if (state.network.localPlayerKey !== "playerB") return;
    if (result.roundNumber < state.match.roundNumber) {
      console.warn("Ignoring a duplicate round result.", result.roundNumber);
      return;
    }
    if (result.roundNumber !== state.match.roundNumber) {
      failMatch("Received a round result for an unexpected round.");
      return;
    }

    applyRoundResult(result);
  }

  static handleRules(message, connectionContext) {
    if (
      state.network.localPlayerKey !== "playerB" ||
      connectionContext.direction !== "in uscita" ||
      !isMatchConfigValid(message.payload)
    ) {
      console.warn("Ignoring unexpected or invalid match rules.");
      return;
    }

    state.match = createMatchState({
      ...message.payload.config,
      matchId: message.matchId,
    });
    state.round = createRoundState(state.match.timerSeconds);
    state.ui.result = null;
    state.ui.error = null;
  }

  static handleAntiCheat(payload) {
    failMatch(`Match stopped after a protocol error: ${payload.reason}`);
  }

  static handleEnd(payload) {
    state.match.complete = true;
    state.match.winner = payload.winnerKey;
    state.match.scores = { ...payload.scores };
    state.match.reason = "match_won";
    state.ui.matchStarted = false;
    state.ui.result = {
      reason: "match_won",
      winnerKey: payload.winnerKey,
      scores: { ...payload.scores },
    };
    stopTimer();
  }
}

function createRoundState(timerSeconds) {
  return {
    playerAChoice: null,
    playerBChoice: null,
    playerALocked: false,
    playerBLocked: false,
    resolved: false,
    timeLeft: timerSeconds,
    timerId: null,
    revealTimeoutId: null,
  };
}

function getRemotePlayerKey(connectionContext) {
  if (
    !connectionContext ||
    connectionContext.peerId !== state.network.remotePeerId
  ) {
    throw new Error("Message received from an unexpected peer.");
  }
  return state.network.remotePlayerKey;
}

function isCurrentRoundMessage(message) {
  if (message.roundNumber !== state.match.roundNumber) {
    console.warn("Ignoring message for a different round.", {
      receivedRound: message.roundNumber,
      activeRound: state.match.roundNumber,
    });
    return false;
  }
  if (state.round.resolved) {
    console.warn("Ignoring a message for an already resolved round.", {
      type: message.type,
      roundNumber: message.roundNumber,
    });
    return false;
  }
  return true;
}

function resolveMatchDisconnect(connectionContext, localPlayerDisconnected) {
  if (state.match.complete) return;

  const disconnectedPlayerKey = localPlayerDisconnected
    ? state.network.localPlayerKey
    : getRemotePlayerKey(connectionContext);

  if (!disconnectedPlayerKey) {
    state.ui.error = "Could not determine which player disconnected.";
    publishState();
    return;
  }

  stopTimer();
  state.ui.matchStarted = false;
  state.ui.result = {
    reason: "disconnect",
    ...resolveDisconnect(state.match, disconnectedPlayerKey),
  };
  publishState();
}

function canReturnToConfiguration() {
  return (
    state.match.complete &&
    ["match_won", "disconnect"].includes(state.match.reason)
  );
}

function resetToConfiguration() {
  const config = {
    format: state.match.format,
    mode: state.match.mode,
    bestOf: state.match.bestOf,
    timerSeconds: state.match.timerSeconds,
    playerOneName: state.match.players.playerA.name,
    playerTwoName: state.match.players.playerB.name,
  };

  stopTimer();
  state.match = createMatchState(config);
  state.round = createRoundState(state.match.timerSeconds);
  state.lobby = { playerAReady: false, playerBReady: false };
  state.chat = [];
  state.ui.result = null;
  state.ui.error = null;
  state.ui.isRunning = false;
  state.ui.matchStarted = false;
  state.network.connected = false;
  state.network.remotePeerId = null;
  state.network.localPlayerKey = null;
  state.network.remotePlayerKey = null;
  state.network.status = state.network.localPeerId
    ? "available"
    : "initializing";

  publishState();
}

function applyRoundResult(result) {
  state.round.resolved = true;
  state.match.lastRound = result;

  if (state.match.mode === "exclusive") {
    applyExclusiveConsumption(state.match, "playerA", result.playerAChoice);
    applyExclusiveConsumption(state.match, "playerB", result.playerBChoice);
  }

  if (!result.draw) {
    state.match.scores[result.winnerKey] += 1;
  }

  if (result.matchWinner) {
    state.match.complete = true;
    state.match.winner = result.matchWinner.winnerKey;
    state.match.reason = "match_won";
    state.ui.matchStarted = false;
  } else if (!result.draw) {
    state.match.roundNumber += 1;
  }

  state.ui.result = result;
  stopTimer();
  if (!result.draw) resetRoundState();
}

function failMatch(message) {
  stopTimer();
  state.match.complete = true;
  state.match.reason = "protocol-error";
  state.ui.matchStarted = false;
  state.ui.error = message;
  state.ui.result = { reason: "protocol-error", message };
}

function maybeStartMatch() {
  if (
    state.network.localPlayerKey === "playerA" &&
    state.lobby.playerAReady &&
    state.lobby.playerBReady &&
    !state.ui.matchStarted &&
    !state.match.complete
  ) {
    OutgoingPeerMessageHandler.sendStart(true);
    state.ui.matchStarted = true;
    startTimer();
  }
}

function tryResolveForHost() {
  if (
    state.network.localPlayerKey === "playerA" &&
    state.round.playerALocked &&
    state.round.playerBLocked &&
    state.round.playerAChoice &&
    state.round.playerBChoice
  ) {
    resolveCurrentRound();
  }
}

function stopTimer() {
  if (state.round.timerId !== null) {
    clearInterval(state.round.timerId);
    state.round.timerId = null;
  }
  if (state.round.revealTimeoutId !== null) {
    clearTimeout(state.round.revealTimeoutId);
    state.round.revealTimeoutId = null;
  }
  state.ui.isRunning = false;
}

function startTimer() {
  if (state.ui.isRunning || state.match.complete) return;
  if (state.round.resolved) resetRoundState();

  state.ui.isRunning = true;
  state.round.timeLeft = state.match.timerSeconds;
  state.round.timerId = setInterval(() => {
    state.round.timeLeft -= 1;

    if (state.round.timeLeft <= 0) {
      stopTimer();
      if (state.network.localPlayerKey === "playerA") {
        state.round.playerAChoice ??= autoChooseRandomColor(
          state.match.players.playerA,
        );
        state.round.playerALocked = true;

        if (state.round.playerBChoice) {
          state.round.playerBLocked = true;
          resolveCurrentRound();
        } else {
          state.round.revealTimeoutId = setTimeout(() => {
            if (state.round.resolved) return;
            state.round.playerBChoice ??= autoChooseRandomColor(
              state.match.players.playerB,
            );
            state.round.playerBLocked = true;
            resolveCurrentRound();
            publishState();
          }, CHOICE_REVEAL_GRACE_PERIOD_MS);
        }
      } else {
        const playerKey = state.network.localPlayerKey;
        if (
          playerKey &&
          state.round[`${playerKey}Choice`] &&
          !state.round[`${playerKey}Locked`]
        ) {
          state.round[`${playerKey}Locked`] = true;
          OutgoingPeerMessageHandler.sendChoiceReveal(
            state.round[`${playerKey}Choice`],
          );
        }
      }
      publishState();
      return;
    }

    publishState();
  }, 1000);
  publishState();
}

function resolveCurrentRound() {
  if (state.network.localPlayerKey !== "playerA" || state.round.resolved)
    return;
  stopTimer();

  const result = resolveRound(state.match, {
    playerA: state.round.playerAChoice,
    playerB: state.round.playerBChoice,
  });

  state.round.resolved = true;
  state.ui.result = result;
  OutgoingPeerMessageHandler.sendRoundResult(result);

  if (!state.match.complete && !result.draw) resetRoundState();
  publishState();
}

function resetRoundState() {
  state.round = createRoundState(state.match.timerSeconds);
}

function publishState() {
  const snapshot = getGameState();
  for (const listener of stateListeners) listener(snapshot);
}

export function getGameState() {
  return {
    network: { ...state.network },
    lobby: { ...state.lobby },
    match: {
      ...state.match,
      scores: { ...state.match.scores },
      players: {
        playerA: clonePlayerState(state.match.players.playerA),
        playerB: clonePlayerState(state.match.players.playerB),
      },
      lastRound: state.match.lastRound ? { ...state.match.lastRound } : null,
    },
    round: { ...state.round, timerId: null, revealTimeoutId: null },
    ui: { ...state.ui },
    chat: state.chat.map((entry) => ({ ...entry })),
  };
}

function clonePlayerState(player) {
  return {
    ...player,
    remainingColors: [...player.remainingColors],
    usedColors: [...player.usedColors],
  };
}

export function subscribeToGameState(listener) {
  //da implementare meglio in futuro, per spettatori e non
  if (typeof listener !== "function") {
    throw new TypeError("State listener must be a function.");
  }
  stateListeners.add(listener);
  listener(getGameState());
  return () => stateListeners.delete(listener);
}

export function configureMatch(config) {
  if (state.network.connected || state.ui.matchStarted) {
    throw new Error("Match rules cannot change after connecting.");
  }
  state.match = createMatchState(config);
  state.round = createRoundState(state.match.timerSeconds);
  publishState();
}

export function joinMatch(peerId) {
  if (typeof peerId !== "string" || peerId.trim().length === 0) {
    throw new TypeError("A valid Peer ID is required.");
  }
  if (state.network.connected || state.network.status === "connecting") {
    throw new Error("A peer connection is already active or in progress.");
  }
  connectToPeer(peerId);
  state.network.status = "connecting";
  state.ui.error = null;
  publishState();
}

export function setReady(ready) {
  if (typeof ready !== "boolean") {
    throw new TypeError("Ready state must be a boolean.");
  }
  const localPlayerKey = state.network.localPlayerKey;
  if (!localPlayerKey || !state.network.connected) {
    throw new Error("Connect to the host before setting ready.");
  }
  if (state.ui.matchStarted) {
    throw new Error("Ready state cannot change after the match starts.");
  }
  if (state.match.complete) {
    throw new Error("Ready state cannot change after the match is over.");
  }

  OutgoingPeerMessageHandler.sendReady(ready);
  state.lobby[`${localPlayerKey}Ready`] = ready;
  maybeStartMatch();
  publishState();
}

export function startRound() {
  if (state.network.localPlayerKey !== "playerA") {
    throw new Error("Only the host can start a round.");
  }
  if (!state.network.connected || state.match.complete) {
    throw new Error("A connected, active match is required.");
  }
  if (
    !state.ui.matchStarted &&
    (!state.lobby.playerAReady || !state.lobby.playerBReady)
  ) {
    throw new Error("Both players must be ready before the first round.");
  }

  OutgoingPeerMessageHandler.sendStart(true);
  state.ui.matchStarted = true;
  startTimer();
}

export function selectColor(color) {
  const playerKey = state.network.localPlayerKey;
  if (!state.ui.isRunning || !playerKey || state.match.complete) {
    throw new Error("There is no active round for this player.");
  }
  if (state.round[`${playerKey}Locked`]) {
    throw new Error("The choice for this round is already locked.");
  }
  if (!state.match.players[playerKey].remainingColors.includes(color)) {
    throw new Error(`Color is not available: ${color}`);
  }

  state.round[`${playerKey}Choice`] = color;
  publishState();
}

export function lockChoice() {
  const playerKey = state.network.localPlayerKey;
  if (
    !state.network.connected ||
    !state.ui.isRunning ||
    state.match.complete ||
    !playerKey
  ) {
    throw new Error("There is no active choice to lock.");
  }
  if (!state.round[`${playerKey}Choice`]) {
    throw new Error("Select a color before locking the choice.");
  }
  if (state.round[`${playerKey}Locked`]) {
    throw new Error("The choice for this round is already locked.");
  }

  if (playerKey === "playerB") {
    OutgoingPeerMessageHandler.sendChoiceReveal(
      state.round[`${playerKey}Choice`],
    );
    state.round[`${playerKey}Locked`] = true;
  } else {
    state.round[`${playerKey}Locked`] = true;
    tryResolveForHost();
  }
  publishState();
}

export function sendChat(message) {
  const text = typeof message === "string" ? message.trim() : "";
  if (!text) throw new TypeError("Chat message cannot be empty.");
  OutgoingPeerMessageHandler.sendChat(text);
  state.chat.push({ from: "local", message: text });
  publishState();
}

export function disconnectMatch() {
  if (state.network.connected && !state.match.complete) {
    OutgoingPeerMessageHandler.sendGone();
  }
  disconnectPeer();
}

export function closeCompletedMatch() {
  if (!canReturnToConfiguration()) {
    throw new Error("Only a completed match can be closed.");
  }

  if (state.network.connected) {
    disconnectPeer();
    return;
  }

  resetToConfiguration();
}

setPeerLifecycleHandler((event) => {
  switch (event.type) {
    case "peer-open":
      state.network.localPeerId = event.peerId;
      state.network.status = "available";
      break;
    case "peer-error":
    case "connection-error":
      state.network.status = "error";
      state.ui.error = event.error?.message ?? "Peer connection error.";
      break;
    case "peer-disconnected":
      state.network.status = "signaling-disconnected";
      break;
    default:
      console.warn("Unknown peer lifecycle event:", event.type);
  }
  publishState();
});

setConnectionOpenHandler((connectionContext) => {
  OutgoingPeerMessageHandler.onConnectionOpen(connectionContext);
});

setMessageHandler((message, connectionContext) => {
  IncomingPeerMessageHandler.handle(message, connectionContext);
});

setConnectionCloseHandler((connectionContext) => {
  state.network.connected = false;

  if (canReturnToConfiguration()) {
    resetToConfiguration();
    return;
  }

  state.network.status = "disconnected";
  if (state.ui.matchStarted) {
    resolveMatchDisconnect(
      connectionContext,
      connectionContext.initiatedLocally,
    );
  }
  publishState();
});
