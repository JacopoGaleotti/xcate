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

    // macro-temi e autori (classici o "originale")
    const THEMES = ['romantico','sociologico','filosofico','esistenziale'];
    const AUTHORS = [
      { name: 'Rainer Maria Rilke', style: 'tono contemplativo, immagini interiori, delicatezza' },
      { name: 'Fernando Pessoa', style: 'eteronimia, malinconia lucida, intimità' },
      { name: 'Virginia Woolf', style: 'flusso di coscienza, attenzione ai dettagli percettivi' },
      { name: 'Albert Camus', style: 'assurdo, limpidezza etica, calore mediterraneo sobrio' },
      { name: 'Jean-Paul Sartre', style: 'libertà, responsabilità, sguardo esistenziale' },
      { name: 'Originale (Jacopo)', style: 'poetico, intimo, minimale, immagini stellari' }
    ];

    const theme = THEMES[Math.floor(Math.random()*THEMES.length)];
    const authorPick = AUTHORS[Math.floor(Math.random()*AUTHORS.length)];

    const prompt = `Genera una citazione breve (1 o 2 frasi) in italiano, ${theme}.
- Se l'autore selezionato è "Originale (Jacopo)", scrivi una citazione originale che potrebbe essere stata scritta da Jacopo, senza menzionare altri autori.
- Se l'autore selezionato è un autore reale, scrivi una citazione originale nello **spirito tematico** indicato (senza imitazione letterale o testi esistenti), evitando riferimenti espliciti al nome e senza citazioni note.
- Tono: poetico ma sobrio, immagini notturne/fugaci consentite.
- Evita contenuti sensibili o espliciti. Non superare 35 parole totali.

Restituisci **solo** JSON con le chiavi: {"author":"string","quote":"string"}
Dove "author" sia: se autore reale, il suo nome; altrimenti "Jacopo".`;

    const body = {
      model: "gpt-4o-mini",
      input: `Autore selezionato: ${authorPick.name}\nIndicazioni di stile: ${authorPick.style}\n\n${prompt}`,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "CitazioneSchema",
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["author","quote"],
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
    // Responses API returns { output: [ { content: [ { type:'output_text', text:'{...}' } ] } ] ... }
    let jsonText = "";
    try {
      const first = data?.output?.[0]?.content?.[0]?.text ?? data?.output_text ?? "";
      jsonText = first;
    } catch(e) { /* noop */ }

    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch(e) {
      // fallback: if model returned plain text, attempt to coerce
      parsed = { author: authorPick.name === 'Originale (Jacopo)' ? 'Jacopo' : authorPick.name, quote: String(jsonText).trim().replace(/^["“]|["”]$/g,'') };
    }

    // sanitize minimal
    const authorFinal = (authorPick.name === 'Originale (Jacopo)') ? 'Jacopo' : (parsed.author || authorPick.name);
    const quoteFinal = (parsed.quote || "").toString().trim();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Cache-Control":"no-store" },
      body: JSON.stringify({ author: authorFinal, quote: quoteFinal, theme, ts: Date.now() })
    };
  } catch (err) {
    console.error(err);
    return { statusCode: 500, body: JSON.stringify({ error: "Server error" }) };
  }
}
