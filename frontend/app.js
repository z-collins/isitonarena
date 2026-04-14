const button = document.getElementById("check-button");
const input = document.getElementById("decklist-input");
const inputSection = document.getElementById("input-section");
const loading = document.getElementById("loading");
const loadingMessage = document.getElementById("loading-message");
const summary = document.getElementById("summary");
const countOn = document.getElementById("count-on");
const countOff = document.getElementById("count-off");

const BASIC_LANDS = ["Plains", "Island", "Swamp", "Mountain", "Forest"];

// tab switching
const tabs = document.querySelectorAll(".tab");
tabs.forEach(tab => {
  tab.addEventListener("click", function () {
    tabs.forEach(t => t.classList.remove("active"));
    this.classList.add("active");

    document.querySelectorAll(".tab-content").forEach(c => c.classList.add("hidden"));
    document.getElementById("tab-" + this.dataset.tab).classList.remove("hidden");
  });
});

function parseDecklist(text) {
  const lines = text.split("\n");
  const cards = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) continue;
    if (!/^\d/.test(trimmed)) continue;

    const firstSpace = trimmed.indexOf(" ");
    const cardName = trimmed.slice(firstSpace + 1);

    if (BASIC_LANDS.includes(cardName)) continue;

    cards.push(cardName);
  }

  return cards;
}

function extractDeckId(url) {
  // moxfield urls look like https://www.moxfield.com/decks/abc123
  // we just want the last segment after /decks/
  const match = url.match(/\/decks\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

async function fetchMoxfieldDeck(deckId) {
  const response = await fetch(
    `https://isitonarena-proxy.isitonarena.workers.dev/?deckId=${deckId}`
  );

  if (!response.ok) {
    throw new Error("Failed to fetch deck — is the URL correct and the deck public?");
  }

  const data = await response.json();
  const cards = [];

  const BASIC_LANDS = ["Plains", "Island", "Swamp", "Mountain", "Forest"];

  // pull cards from mainboard and commanders
  const sections = [data.mainboard, data.commanders, data.sideboard, data.considering];

  for (const section of sections) {
    if (!section) continue;
    for (const key of Object.keys(section)) {
      const cardName = section[key].card.name;
      if (BASIC_LANDS.includes(cardName)) continue;
      cards.push(cardName);
    }
  }

  return cards;
}

async function checkScryfall(cardNames) {
  const chunks = [];
  for (let i = 0; i < cardNames.length; i += 75) {
    chunks.push(cardNames.slice(i, i + 75));
  }

  const results = [];

  for (const chunk of chunks) {
    const identifiers = chunk.map(name => ({ name }));

    const response = await fetch("https://api.scryfall.com/cards/collection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifiers })
    });

    const data = await response.json();

    for (const card of data.data) {
      const l = card.legalities;
      const arenaFormats = ["standard", "historic", "alchemy", "explorer", "brawl", "historicbrawl"];
      const onArena = arenaFormats.some(format =>
        ["legal", "banned", "restricted"].includes(l[format])
      );

      results.push({
        name: card.name,
        onArena,
        legalities: l
      });
    }

    if (chunks.length > 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return results;
}

function displayResults(results) {
  // update summary counts
  const onCount = results.filter(c => c.onArena).length;
  const offCount = results.filter(c => !c.onArena).length;
  countOn.textContent = onCount;
  countOff.textContent = offCount;

  // render card list
  const container = document.getElementById("results");
  container.innerHTML = "";

  const sorted = results.sort((a, b) => a.name.localeCompare(b.name));

  for (const card of sorted) {
    const div = document.createElement("div");
    div.className = card.onArena ? "card-legal" : "card-illegal";
    div.textContent = card.name;
    container.appendChild(div);
  }
}

button.addEventListener("click", async function () {
  const activeTab = document.querySelector(".tab.active").dataset.tab;

  let cardNames = [];

  inputSection.classList.add("hidden");
  loading.classList.remove("hidden");

  try {
    if (activeTab === "paste") {
      const text = input.value;
      if (!text.trim()) {
        inputSection.classList.remove("hidden");
        loading.classList.add("hidden");
        return;
      }
      loadingMessage.textContent = "Parsing decklist...";
      cardNames = parseDecklist(text);

    } else if (activeTab === "url") {
      const url = document.getElementById("url-input").value.trim();
      if (!url) {
        inputSection.classList.remove("hidden");
        loading.classList.add("hidden");
        return;
      }
      loadingMessage.textContent = "Fetching deck from Moxfield...";
      const deckId = extractDeckId(url);

      if (!deckId) {
        alert("Couldn't find a deck ID in that URL — make sure it's a valid Moxfield deck link.");
        inputSection.classList.remove("hidden");
        loading.classList.add("hidden");
        return;
      }

      cardNames = await fetchMoxfieldDeck(deckId);
    }

    loadingMessage.textContent = "Checking Arena legality...";
    const results = await checkScryfall(cardNames);

    loading.classList.add("hidden");
    summary.classList.remove("hidden");

    displayResults(results);

  } catch (err) {
    alert(err.message);
    loading.classList.add("hidden");
    inputSection.classList.remove("hidden");
  }
});