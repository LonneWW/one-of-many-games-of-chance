import "../peerjs.min.js";
import { isMessageValid } from "./peer-mex-validators.js";

const peer = new window.Peer({ debug: 0 });

// connection to opponent
let activeConnection = null;

// local handlers to change main.js state object from this module

// used for ui changes
let peerLifecycleHandler = null;
// used for outgoing messages
let connectionOpenHandler = null;
// used for incoming messages
let messageHandler = null;
// used for disconnection specifocally
let connectionCloseHandler = null;

// connection set; used to distinguish locally closed connections from those remotely closed by other users (for example, to determine, during a disconnection, who abandoned the match and who is the winner)
const locallyClosedConnections = new WeakSet();

// listeners for connection to server
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
  if (activeConnection) {
    console.warn(
      `[PeerJS] Rifiutata una connessione aggiuntiva da ${conn.peer}.`,
    );
    if (conn.open) {
      conn.close();
    } else {
      conn.on("open", () => conn.close());
    }
    return;
  }

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

  // listeners to connection to other peers
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

// universal function to send peer messages
export function sendPeerMessage(message) {
  if (!activeConnection?.open) {
    throw new Error("Cannot send a peer message without an open connection.");
  }
  if (!isMessageValid(message)) {
    throw new TypeError("Refusing to send an invalid peer message.");
  }

  activeConnection.send(message);
}

// export functions used in main.js to set local handlers
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
