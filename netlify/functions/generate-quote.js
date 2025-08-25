// /.netlify/functions/generate-quote.js
// Netlify Functions (Node) — chiama l'API OpenAI senza esporre la chiave al client.
// Imposta in Netlify l'ambiente: OPENAI_API_KEY
export async function handler(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Missing OPENAI_API_KEY' }) };
    }

    const timestamp = Date.now();

    const prompt = `Genera una citazione breve (1 o 2 frasi) in italiano.
- Tema: romantico, sociologico, filosofico o esistenziale.
- Autore: scegli un autore appropriato (classico o contemporaneo).
- Tono: poetico, sobrio, immagini notturne/fugaci consentite.
- Evita contenuti sensibili o espliciti.
- Non superare 35 parole.
- Restituisci SOLO JSON valido con chiavi:
  {"author":"string","quote":"string"}

Timestamp: ${timestamp}`;

    const body = {
      model: "gpt-4o-mini",
      input: prompt,
      text: {
        format: "json"
      }
    };

    const resp = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error('OpenAI error:', text);
      return { statusCode: resp.status, body: JSON.stringify({ error: "OpenAI error", details: text }) };
    }

    const data = await resp.json();

    // Estrazione robusta del testo JSON
    let parsed;
    try {
      const rawText = data.output_text || data?.output?.[0]?.content?.[0]?.text || "";
      parsed = JSON.parse(rawText);
      if (!parsed.author || !parsed.quote) throw new Error("Incomplete JSON");
    } catch (e) {
      parsed = { author: "Sconosciuto", quote: "Citazione non disponibile" };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ author: parsed.author, quote: parsed.quote, ts: timestamp })
    };

  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: "Server error" }) };
  }
}
