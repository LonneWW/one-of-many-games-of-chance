import {
  configureMatch,
  disconnectMatch,
  getGameState,
  joinMatch,
  lockChoice,
  selectColor,
  sendChat,
  setReady,
  startRound,
  subscribeToGameState,
} from "../main.js";
import { DEFAULT_CARD_NAMES, getFormatColors } from "./colors.js";

// obj containing all html elements in the test page (temporary!)
const elements = {
  settingsForm: document.getElementById("settings-form"),
  format: document.getElementById("format"),
  mode: document.getElementById("mode"),
  bestOf: document.getElementById("best-of"),
  timerSeconds: document.getElementById("timer-seconds"),
  applySettings: document.getElementById("apply-settings"),
  settingsOwner: document.getElementById("settings-owner"),
  settingsSummary: document.getElementById("settings-summary"),
  connectionStatus: document.getElementById("connection-status"),
  playerRole: document.getElementById("player-role"),
  localPeerId: document.getElementById("local-peer-id"),
  copyPeerId: document.getElementById("copy-peer-id"),
  joinForm: document.getElementById("join-form"),
  remotePeerId: document.getElementById("remote-peer-id"),
  joinButton: document.getElementById("join-button"),
  disconnectButton: document.getElementById("disconnect-button"),
  hostReady: document.getElementById("host-ready"),
  joinerReady: document.getElementById("joiner-ready"),
  readyButton: document.getElementById("ready-button"),
  roundNumber: document.getElementById("round-number"),
  playerAName: document.getElementById("player-a-name"),
  playerBName: document.getElementById("player-b-name"),
  playerAScore: document.getElementById("player-a-score"),
  playerBScore: document.getElementById("player-b-score"),
  timer: document.getElementById("timer"),
  opponentStatus: document.getElementById("opponent-status"),
  nextRoundButton: document.getElementById("next-round-button"),
  colorChoices: document.getElementById("color-choices"),
  selectedChoice: document.getElementById("selected-choice"),
  lockButton: document.getElementById("lock-button"),
  resultMessage: document.getElementById("result-message"),
  matchMessage: document.getElementById("match-message"),
  appError: document.getElementById("app-error"),
  chatMessages: document.getElementById("chat-messages"),
  chatForm: document.getElementById("chat-form"),
  chatInput: document.getElementById("chat-input"),
  chatSend: document.getElementById("chat-send"),
};

let currentState = getGameState();
let renderedColors = "";
let renderedChat = "";
let displayedError = null;

// if there is an error during an action changes reset the ui to the current (previos) state
function runAction(action) {
  displayedError = null;
  try {
    action();
  } catch (error) {
    displayedError = error instanceof Error ? error.message : String(error);
    render(currentState);
  }
}

// html elements event listeners

elements.settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  runAction(() =>
    configureMatch({
      format: Number(elements.format.value),
      mode: elements.mode.value,
      bestOf: Number(elements.bestOf.value),
      timerSeconds: Number(elements.timerSeconds.value),
    }),
  );
});

elements.joinForm.addEventListener("submit", (event) => {
  event.preventDefault();
  runAction(() => joinMatch(elements.remotePeerId.value));
});

elements.disconnectButton.addEventListener("click", () => {
  runAction(disconnectMatch);
});

elements.readyButton.addEventListener("click", () => {
  const localPlayerKey = currentState.network.localPlayerKey;
  if (!localPlayerKey) return;
  runAction(() => setReady(!currentState.lobby[`${localPlayerKey}Ready`]));
});

elements.lockButton.addEventListener("click", () => {
  runAction(lockChoice);
});

elements.nextRoundButton.addEventListener("click", () => {
  runAction(startRound);
});

elements.colorChoices.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-color]");
  if (!button || button.disabled) return;
  runAction(() => selectColor(button.dataset.color));
});

elements.chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const message = elements.chatInput.value;
  runAction(() => sendChat(message));
  if (!displayedError) elements.chatInput.value = "";
});

elements.copyPeerId.addEventListener("click", async () => {
  if (!currentState.network.localPeerId) return;
  try {
    await navigator.clipboard.writeText(currentState.network.localPeerId);
    displayedError = null;
  } catch (error) {
    displayedError =
      error instanceof Error
        ? `Impossibile copiare il Peer ID: ${error.message}`
        : "Impossibile copiare il Peer ID.";
  }
  render(currentState);
});

subscribeToGameState((nextState) => {
  currentState = nextState;
  displayedError = null;
  render(nextState);
});

// centralized function to render changes that have occurred at the UI
function render(state) {
  renderSettings(state);
  renderConnection(state);
  renderLobby(state);
  renderGame(state);
  renderChat(state.chat);

  elements.appError.textContent = displayedError ?? state.ui.error ?? "";
  elements.appError.hidden = !elements.appError.textContent;
}

function renderSettings(state) {
  const settingsLocked = state.network.connected || state.ui.matchStarted;
  setValueUnlessFocused(elements.format, state.match.format);
  setValueUnlessFocused(elements.mode, state.match.mode);
  setValueUnlessFocused(elements.bestOf, state.match.bestOf);
  setValueUnlessFocused(elements.timerSeconds, state.match.timerSeconds);

  for (const input of [
    elements.format,
    elements.mode,
    elements.bestOf,
    elements.timerSeconds,
  ]) {
    input.disabled = settingsLocked;
  }
  elements.applySettings.disabled = settingsLocked;
  elements.settingsOwner.textContent = settingsLocked
    ? "Regole definite per questa partita"
    : "Imposta le regole prima di connetterti";
  elements.settingsSummary.textContent =
    `${state.match.format} semi · ${formatMode(state.match.mode)} · ` +
    `Best of ${state.match.bestOf} · ${state.match.timerSeconds} secondi`;
}

function renderConnection(state) {
  //defining the texts of the UI in the different stages of the connections
  const statusLabels = {
    initializing: "Inizializzazione della rete…",
    available: "Peer disponibile · in attesa",
    connecting: "Connessione in corso…",
    connected: "Connesso",
    disconnected: "Disconnesso",
    "signaling-disconnected": "Segnalazione disconnessa",
    error: "Errore di connessione",
  };
  const roleLabels = {
    playerA: "Host",
    playerB: "Joiner",
  };
  const busy = state.network.connected || state.network.status === "connecting";

  elements.connectionStatus.textContent =
    statusLabels[state.network.status] ?? state.network.status;
  elements.connectionStatus.dataset.state = state.network.status;
  elements.playerRole.textContent =
    roleLabels[state.network.localPlayerKey] ?? "Ruolo non assegnato";
  elements.localPeerId.textContent =
    state.network.localPeerId ?? "In attesa del Peer ID…";
  elements.copyPeerId.disabled = !state.network.localPeerId;
  elements.remotePeerId.disabled = busy;
  elements.joinButton.disabled = busy;
  elements.disconnectButton.disabled = !state.network.connected;
}

function renderLobby(state) {
  elements.hostReady.textContent = readinessLabel(state.lobby.playerAReady);
  elements.joinerReady.textContent = readinessLabel(state.lobby.playerBReady);

  const localPlayerKey = state.network.localPlayerKey;
  const canSetReady =
    state.network.connected && !state.ui.matchStarted && !state.match.complete;
  const isReady = localPlayerKey
    ? state.lobby[`${localPlayerKey}Ready`]
    : false;
  elements.readyButton.disabled = !canSetReady;
  elements.readyButton.textContent = isReady ? "Annulla pronto" : "Pronto";
}

function renderGame(state) {
  const localPlayerKey = state.network.localPlayerKey;
  const remotePlayerKey = state.network.remotePlayerKey;
  const localChoice = localPlayerKey
    ? state.round[`${localPlayerKey}Choice`]
    : null;
  const localLocked = localPlayerKey
    ? state.round[`${localPlayerKey}Locked`]
    : false;
  const remoteLocked = remotePlayerKey
    ? state.round[`${remotePlayerKey}Locked`]
    : false;
  const canChoose =
    state.network.connected &&
    state.ui.isRunning &&
    !state.match.complete &&
    !localLocked;
  const availableColors = localPlayerKey
    ? state.match.players[localPlayerKey].remainingColors
    : [];

  elements.roundNumber.textContent = `Round ${state.match.roundNumber}`;
  elements.playerAScore.textContent = state.match.scores.playerA;
  elements.playerBScore.textContent = state.match.scores.playerB;
  elements.timer.textContent = state.round.timeLeft;
  elements.playerAName.textContent = state.match.players.playerA.name;
  elements.playerBName.textContent = state.match.players.playerB.name;
  renderChoices(state.match.format, availableColors, localChoice, canChoose);
  elements.selectedChoice.textContent = localChoice
    ? `Selezione: ${DEFAULT_CARD_NAMES[localChoice]} (${localChoice})`
    : "Nessun seme selezionato";
  elements.lockButton.disabled = !canChoose || !localChoice || localLocked;
  elements.lockButton.textContent = localLocked
    ? "Scelta bloccata"
    : "Blocca scelta";
  const canStartNextRound =
    localPlayerKey === "playerA" &&
    state.ui.matchStarted &&
    !state.ui.isRunning &&
    !state.match.complete &&
    state.ui.result !== null;
  elements.nextRoundButton.disabled = !canStartNextRound;

  if (state.match.complete) {
    elements.opponentStatus.textContent = "Partita terminata.";
  } else if (!state.network.connected) {
    elements.opponentStatus.textContent =
      "Connettiti a una partita per iniziare.";
  } else if (!state.ui.matchStarted) {
    elements.opponentStatus.textContent =
      "Entrambi i giocatori devono essere pronti.";
  } else if (remoteLocked) {
    elements.opponentStatus.textContent = "L’avversario ha bloccato la scelta.";
  } else if (localPlayerKey === "playerB") {
    elements.opponentStatus.textContent = state.ui.isRunning
      ? "In attesa dell’esito del round (il blocco host non è notificato in questa beta)."
      : "In attesa che l’host avvii il round successivo.";
  } else {
    elements.opponentStatus.textContent = state.ui.isRunning
      ? "In attesa della scelta dell’avversario."
      : "Round concluso.";
  }

  renderResult(state);
}

function renderChoices(format, availableColors, selectedColor, canChoose) {
  const colorKey = `${format}:${availableColors.join(",")}`;
  if (renderedColors !== colorKey) {
    renderedColors = colorKey;
    elements.colorChoices.replaceChildren(); // clear the color choices elem
    for (const color of colorsForFormat(format)) {
      // to dynamically create a button for each suit options
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.color = color;
      button.className = "color-choice";
      button.style.setProperty("--suit", color);
      button.setAttribute(
        "aria-label",
        `${DEFAULT_CARD_NAMES[color]}, ${color}`,
      );

      const swatch = document.createElement("span");
      swatch.className = "color-swatch";
      swatch.setAttribute("aria-hidden", "true");
      const name = document.createElement("span");
      name.className = "color-name";
      name.textContent = DEFAULT_CARD_NAMES[color];
      const colorName = document.createElement("small");
      colorName.textContent = color;

      button.append(swatch, name, colorName);
      elements.colorChoices.append(button); // to then append it to the choices elem
    }
  }

  // updates the buttons after the suit choice
  for (const button of elements.colorChoices.querySelectorAll(
    "button[data-color]",
  )) {
    const color = button.dataset.color;
    button.disabled = !canChoose || !availableColors.includes(color);
    button.setAttribute("aria-pressed", String(color === selectedColor));
    button.classList.toggle("selected", color === selectedColor);
    button.classList.toggle("unavailable", !availableColors.includes(color));
  }
}

function renderResult(state) {
  const result = state.ui.result;
  if (!result) {
    elements.resultMessage.textContent = "La partita non è ancora iniziata.";
    elements.matchMessage.textContent = "";
    return;
  }

  if (result.draw) {
    elements.resultMessage.textContent = `Pareggio: entrambi hanno scelto ${DEFAULT_CARD_NAMES[result.playerAChoice]}.`;
  } else if (result.playerAChoice && result.playerBChoice) {
    const winnerName =
      state.match.players[result.winnerKey]?.name ?? result.winnerKey;
    elements.resultMessage.textContent =
      `${state.match.players.playerA.name}: ${DEFAULT_CARD_NAMES[result.playerAChoice]} · ` +
      `${state.match.players.playerB.name}: ${DEFAULT_CARD_NAMES[result.playerBChoice]} · ` +
      `punto a ${winnerName}.`;
  } else if (result.reason === "disconnect") {
    elements.resultMessage.textContent = `Connessione interrotta. Vittoria per ${result.winnerName}.`;
  } else if (result.reason === "protocol-error") {
    elements.resultMessage.textContent = result.message;
  } else if (result.reason === "match_won") {
    elements.resultMessage.textContent = `Partita vinta da ${state.match.players[result.winnerKey]?.name ?? result.winnerKey}.`;
  }

  if (state.match.complete && state.match.winner) {
    const winnerName =
      state.match.players[state.match.winner]?.name ?? state.match.winner;
    elements.matchMessage.textContent =
      state.match.reason === "disconnect"
        ? `Vittoria per disconnessione: ${winnerName}.`
        : `Partita terminata · vincitore: ${winnerName}.`;
  } else {
    elements.matchMessage.textContent = "";
  }
}

function renderChat(messages) {
  elements.chatSend.disabled = !currentState.network.connected;
  const signature = JSON.stringify(messages); //messages is state.chat
  if (signature === renderedChat) return;
  renderedChat = signature;
  elements.chatMessages.replaceChildren();

  if (messages.length === 0) {
    // render the default message
    const empty = document.createElement("li");
    empty.className = "empty-chat";
    empty.textContent = "I messaggi appariranno qui.";
    elements.chatMessages.append(empty);
  } else {
    for (const message of messages) {
      // cycles every message obj and creates an li each
      const item = document.createElement("li");
      const sender = document.createElement("strong");
      sender.textContent = message.from === "local" ? "Tu" : "Avversario";
      const content = document.createElement("span");
      content.textContent = message.message;
      item.append(sender, content);
      elements.chatMessages.append(item);
    }
    elements.chatMessages.scrollTop = elements.chatMessages.scrollHeight; // then scrolls to the last message
  }
}

// used to avoid the change of the input value while the user is changing it
function setValueUnlessFocused(input, value) {
  if (document.activeElement !== input) input.value = value; // document.activeElement -> element currently on focus
}

function readinessLabel(ready) {
  return ready ? "Pronto" : "Non pronto";
}

function formatMode(mode) {
  return mode === "exclusive" ? "Esclusiva" : "Standard";
}

function colorsForFormat(format) {
  return getFormatColors(format);
}
