import "../peerjs.min.js";
import { isMessageValid } from "./peer-mex-validators.js";

const peer = new window.Peer({ debug: 0 });
let activeConnection = null;
let peerLifecycleHandler = null;
let connectionOpenHandler = null;
let messageHandler = null;
let connectionCloseHandler = null;
const locallyClosedConnections = new WeakSet();

peer.on("open", (id) => {
  peerLifecycleHandler?.({ type: "peer-open", peerId: id });
});

peer.on("error", (error) => {
  console.error(`[PeerJS] Errore peer (${error.type}):`, error);
  peerLifecycleHandler?.({ type: "peer-error", error });
});

peer.on("disconnected", (id) => {
  console.warn(`[PeerJS] Disconnesso dal server di segnalazione: ${id}`);
  peerLifecycleHandler?.({ type: "peer-disconnected", peerId: id });
});

peer.on("connection", (conn) => {
  observeConnection(conn, "in ingresso");
});

function observeConnection(conn, direction) {
  activeConnection = conn;

  const openTimeoutId = setTimeout(() => {
    if (!conn.open) {
      console.warn(
        `[PeerJS] Connessione con ${conn.peer} ancora chiusa dopo 10 secondi.`,
      );
    }
  }, 10_000);

  conn.on("open", () => {
    clearTimeout(openTimeoutId);
    connectionOpenHandler?.({ peerId: conn.peer, direction });
  });

  conn.on("data", (data) => {
    if (!validateIncomingMessage(data)) {
      console.warn("[PeerJS] Messaggio ricevuto non valido; ignorato.", data);
      return;
    }

    if (!messageHandler) {
      console.warn(
        "[PeerJS] Messaggio ricevuto, ma nessun handler è registrato.",
      );
      return;
    }
    messageHandler(data, { peerId: conn.peer, direction });
  });

  conn.on("close", () => {
    clearTimeout(openTimeoutId);

    if (connectionCloseHandler) {
      connectionCloseHandler({
        peerId: conn.peer,
        direction,
        initiatedLocally: locallyClosedConnections.has(conn),
      });
    }

    if (activeConnection === conn) {
      activeConnection = null;
    }
  });

  conn.on("error", (error) => {
    console.error(
      `[PeerJS] Errore connessione con ${conn.peer} (${error.type}):`,
      error,
    );
    peerLifecycleHandler?.({
      type: "connection-error",
      peerId: conn.peer,
      error,
    });
  });
}

export function disconnectPeer() {
  if (!activeConnection) {
    console.warn("[PeerJS] Non c'è una connessione dati attiva.");
    return;
  }

  const connectionToClose = activeConnection;
  activeConnection = null;
  locallyClosedConnections.add(connectionToClose);

  connectionToClose.close();
}

export function connectToPeer(peerId) {
  if (typeof peerId !== "string" || peerId.trim().length === 0) {
    throw new TypeError("A valid Peer ID is required.");
  }

  const conn = peer.connect(peerId.trim());
  observeConnection(conn, "in uscita");
}

export function sendPeerMessage(message) {
  if (!activeConnection?.open) {
    throw new Error("Cannot send a peer message without an open connection.");
  }
  if (!isMessageValid(message)) {
    throw new TypeError("Refusing to send an invalid peer message.");
  }

  activeConnection.send(message);
}

export function setConnectionOpenHandler(handler) {
  if (typeof handler !== "function") {
    throw new TypeError("Connection-open handler must be a function.");
  }
  connectionOpenHandler = handler;
}

export function setPeerLifecycleHandler(handler) {
  if (typeof handler !== "function") {
    throw new TypeError("Peer lifecycle handler must be a function.");
  }
  peerLifecycleHandler = handler;
}

export function setMessageHandler(handler) {
  if (typeof handler !== "function") {
    throw new TypeError("Message handler must be a function.");
  }
  messageHandler = handler;
}

export function setConnectionCloseHandler(handler) {
  if (typeof handler !== "function") {
    throw new TypeError("Connection-close handler must be a function.");
  }
  connectionCloseHandler = handler;
}

function validateIncomingMessage(data) {
  return isMessageValid(data);
}
