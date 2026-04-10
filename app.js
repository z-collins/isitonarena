const button = document.getElementById("check-button");
const input = document.getElementById("decklist-input");
const inputSection = document.getElementById("input-section");
const loading = document.getElementById("loading");
const loadingMessage = document.getElementById("loading-message");
const summary = document.getElementById("summary");
const countOn = document.getElementById("count-on");
const countOff = document.getElementById("count-off");

const BASIC_LANDS = ["Plains", "Island", "Swamp", "Mountain", "Forest"];

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
  const text = input.value;
  if (!text.trim()) return;

  // swap input for loading
  inputSection.classList.add("hidden");
  loading.classList.remove("hidden");

  loadingMessage.textContent = "Parsing decklist...";
  const cardNames = parseDecklist(text);

  loadingMessage.textContent = "Checking Arena legality...";
  const results = await checkScryfall(cardNames);

  // swap loading for summary + results
  loading.classList.add("hidden");
  summary.classList.remove("hidden");

  displayResults(results);
});