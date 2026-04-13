export default {
  async fetch(request, env, ctx) {

    // allow requests from your site (and localhost for development)
    const allowedOrigins = [
      "http://127.0.0.1:5500",
      "http://localhost:5500",
      "https://isitonarena.com"
    ];

    const origin = request.headers.get("Origin");
    const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

    // handle preflight requests
    // browsers send an OPTIONS request first to check CORS headers
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": allowOrigin,
          "Access-Control-Allow-Methods": "GET",
          "Access-Control-Allow-Headers": "Content-Type",
        }
      });
    }

    // only allow GET requests
    if (request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }

    // pull the deck id from the request url
    // expected format: https://your-worker.workers.dev/?deckId=abc123
    const url = new URL(request.url);
    const deckId = url.searchParams.get("deckId");

    if (!deckId) {
      return new Response("Missing deckId parameter", { status: 400 });
    }

    // forward the request to moxfield
    const moxfieldUrl = `https://api2.moxfield.com/v2/decks/all/${deckId}`;
    const moxfieldResponse = await fetch(moxfieldUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
      }
    });

    if (!moxfieldResponse.ok) {
      return new Response("Failed to fetch deck from Moxfield", { 
        status: moxfieldResponse.status 
      });
    }

    const data = await moxfieldResponse.json();

    // return the data with CORS headers attached
    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": allowOrigin,
      }
    });
  }
};