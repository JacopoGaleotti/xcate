// /.netlify/functions/generate-quote.js
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

    const prompt = `Genera una citazione breve in italiano (1-2 frasi) su temi romantici, filosofici, sociologici o esistenziali. Scegli un autore appropriato (classico o contemporaneo, da Dostoevskij a Kafka, da Pirandello a Montale. Hai pura libertà nella scelta dell'autore). La citazione deve essere poetica e sobria.  

⚠️ IMPORTANTE: restituisci **solo JSON valido** senza testo extra, senza spiegazioni, senza virgolette esterne. Il JSON deve avere **esattamente** queste chiavi:  
{
  "author": "string",
  "quote": "string"
}

Non superare 35 parole. Nessun contenuto sensibile o esplicito.  
Restituisci sempre sia l'autore che la citazione.
`;

    const body = {
      model: "gpt-4o-mini",
      input: prompt
      // nessun 'response_format' o 'text.format'
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

    // Prendi il testo generato dal modello
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
