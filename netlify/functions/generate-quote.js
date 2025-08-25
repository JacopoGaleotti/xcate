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

    // Aggiungo timestamp casuale per maggiore variabilità
    const timestamp = Date.now();

    // Prompt chiaro: ChatGPT sceglie autore e citazione
    const prompt = `Genera una citazione breve (1 o 2 frasi) in italiano.
- Tema: romantico, sociologico, filosofico o esistenziale, scegli tu.
- Autore: scegli un autore appropriato (classico o contemporaneo); non limitarti a una lista fissa.
- Tono: poetico, sobrio, immagini notturne/fugaci consentite.
- Evita contenuti sensibili o espliciti.
- Non superare 35 parole.
- Restituisci SOLO JSON valido con chiavi:
  {"author":"string","quote":"string"}
  Dove "author" deve essere l'autore scelto da te.

Timestamp: ${timestamp}`;

    const body = {
      model: "gpt-4o-mini",
      input: prompt,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "CitazioneSchema",
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["author", "quote"],
            properties: {
              author: { type: "string" },
              quote: { type: "string", maxLength: 280 }
            }
          }
        }
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

    // Estrazione testo JSON restituito
    let jsonText = "";
    try {
      jsonText = data?.output?.[0]?.content?.[0]?.text ?? data?.output_text ?? "";
    } catch (e) { /* noop */ }

    // Parsing robusto
    let parsed;
    try {
      parsed = JSON.parse(jsonText);
      if (!parsed.author || !parsed.quote) throw new Error("Incomplete JSON");
    } catch (e) {
      // fallback: se JSON non valido, prendi tutto come citazione e autore "Sconosciuto"
      parsed = { author: "Sconosciuto", quote: String(jsonText).trim().replace(/^["“]|["”]$/g, '') };
    }

    const authorFinal = parsed.author;
    const quoteFinal = parsed.quote;

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      body: JSON.stringify({ author: authorFinal, quote: quoteFinal, ts: timestamp })
    };

  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: "Server error" }) };
  }
}
