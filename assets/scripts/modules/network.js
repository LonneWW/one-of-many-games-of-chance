import "../peerjs.min.js";

// Inizializza PeerJS. Genera automaticamente un ID per questo utente.
// Usa i server cloud gratuiti di PeerJS per il matchmaking.
const peer = new window.Peer();

// Quando ti connetti con successo alla rete di matchmaking
peer.on("open", (id) => {
  console.log(`Il mio ID Peer è: ${id}`);
  console.log(`Condividi questo ID con un amico per connettervi!`);
});

// Ricevi una connessione da un altro utente
peer.on("connection", (conn) => {
  console.log("Un peer si è connesso a te!");

  // Ascolta i messaggi in entrata
  conn.on("data", (data) => {
    console.log(`Messaggio ricevuto: ${data}`);
  });
});

// FUNZIONE PER CONNETTERTI A QUALCUNO
// Puoi chiamare questa funzione passando l'ID del tuo amico
function connettiAUser(targetPeerId) {
  const conn = peer.connect(targetPeerId);

  conn.on("open", () => {
    console.log(`Connesso con successo a: ${targetPeerId}`);
    conn.send("Ciao! Questo messaggio viaggia in P2P senza server!");
  });
}

// Espone la funzione globalmente per testarla dalla console del browser
window.connettiAUser = connettiAUser;
