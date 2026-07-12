// Versione GRATUITA (Google AI Studio / Gemini) del server-ponte per il widget.
// Nessuna carta di credito richiesta, nessuna scadenza — solo un limite di
// richieste al giorno, ampiamente sufficiente per fare dei test.
//
// Richiede Node 18 o superiore (usa il "fetch" integrato, nessuna libreria
// aggiuntiva necessaria per parlare con l'API di Google).

import express from "express";
import cors from "cors";
import "dotenv/config";

const app = express();
app.use(cors());               // in produzione limita 'origin' al tuo dominio
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const MODEL = "gemini-2.5-flash"; // modello incluso nel piano gratuito

// Informazioni vere su Copy Express: aggiorna qui se cambiano orari/servizi/prezzi.
const SYSTEM_PROMPT = `
Sei l'assistente virtuale di Copy Express, copisteria/cartoleria/studio grafico/
serigrafia a Brindisi, Via G. M. Galanti 12, dal 1996.

Orari: Lun-Ven 08:30-13:00 e 16:30-20:00, Sabato 09:00-12:30, Domenica e festivi chiuso.
Telefono: +39 0831 513641. Email: info@copy-express.it.

Reparti e servizi:
- Copisteria: fotocopie b/n e colori, tesi di laurea (anche 24h), stampa da file,
  rilegatura spirale/termica, plastificazione, rivestimento libri.
- Cartoleria: articoli ufficio, registratori, faldoni, penne, cucitrici,
  modulistica, cartucce e toner.
- Grafica: logo, biglietti da visita, carta intestata, volantini, manifesti,
  banner, partecipazioni, siti web.
- Serigrafia: magliette personalizzate, gadget aziendali, calendari, agende,
  adesivi, chiavette USB, insegne.

Regole:
- Rispondi in italiano, in modo breve, cordiale e concreto.
- Non inventare prezzi esatti: di' che il preventivo si conferma in negozio o
  al telefono, ma puoi dare fasce indicative se richiesto in modo generico.
- Per richieste urgenti o complesse, invita a chiamare il negozio o passare di persona.
`;

app.post("/api/chat", async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Messaggio mancante" });
    }
    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY non configurata" });
    }

    // La cronologia arriva in formato "Anthropic-style" (role: user/assistant).
    // Gemini vuole role: user/model — la convertiamo al volo.
    const priorTurns = history
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: typeof m.content === "string" ? m.content : "" }],
      }));

    const contents = [...priorTurns, { role: "user", parts: [{ text: message }] }];

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Errore Gemini:", errText);
      return res.status(502).json({ error: "Errore dal provider AI" });
    }

    const data = await response.json();
    const replyText =
      data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("\n") ||
      "Non sono riuscito a generare una risposta, riprova tra poco.";

    // Riportiamo la cronologia in formato "Anthropic-style" così il resto
    // del codice (widget) resta identico anche se in futuro passi a Claude.
    const updatedHistory = [
      ...history,
      { role: "user", content: message },
      { role: "assistant", content: replyText },
    ];

    res.json({ reply: replyText, history: updatedHistory });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Errore interno" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server AI agent (Gemini, gratis) attivo su porta ${PORT}`));
