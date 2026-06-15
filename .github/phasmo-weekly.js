const cheerio = require("cheerio");

const WIKI_URL = "https://phasmophobia.fandom.com/wiki/Challenge_Mode";
const API_URL = "https://phasmophobia.fandom.com/api.php?action=parse&page=Challenge_Mode&prop=text&format=json";
const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

if (!webhookUrl) {
  throw new Error("DISCORD_WEBHOOK_URL fehlt.");
}

const translationCache = new Map();

function cleanText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/\[Show\]/gi, "")
    .replace(/\[Hide\]/gi, "")
    .trim();
}

function truncate(text, maxLength) {
  const cleaned = cleanText(text);
  if (cleaned.length <= maxLength) return cleaned;
  return cleaned.slice(0, maxLength - 3).trim() + "...";
}

async function translateToGerman(text) {
  const cleaned = cleanText(text);
  if (!cleaned) return "";

  if (translationCache.has(cleaned)) {
    return translationCache.get(cleaned);
  }

  try {
    const url =
      "https://translate.googleapis.com/translate_a/single" +
      "?client=gtx&sl=en&tl=de&dt=t&q=" +
      encodeURIComponent(cleaned);

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0"
      }
    });

    if (!response.ok) {
      throw new Error(`Translate HTTP ${response.status}`);
    }

    const data = await response.json();

    const translated = data[0]
      .map(part => part[0])
      .join("")
      .trim();

    translationCache.set(cleaned, translated);
    return translated;
  } catch (error) {
    console.log("Übersetzung fehlgeschlagen, nutze Original:", error.message);
    translationCache.set(cleaned, cleaned);
    return cleaned;
  }
}

function findCurrentChallengeName($) {
  const pageText = cleanText($.root().text());

  const patterns = [
    /As of .*?\(UTC\), the challenge is ([^.]+)\./i,
    /the challenge is ([^.]+)\./i
  ];

  for (const pattern of patterns) {
    const match = pageText.match(pattern);
    if (match && match[1]) {
      return cleanText(match[1]);
    }
  }

  return null;
}

function getChallengeTables($) {
  const challengeTables = [];

  $("table").each((_, table) => {
    const headers = [];

    $(table)
      .find("th")
      .each((_, th) => {
        headers.push(cleanText($(th).text()).toLowerCase());
      });

    const looksLikeChallengeTable =
      headers.some(h => h.includes("challenge")) &&
      headers.some(h => h.includes("description")) &&
      headers.some(h => h.includes("map"));

    if (!looksLikeChallengeTable) return;

    challengeTables.push(table);
  });

  return challengeTables;
}

function extractStandardChallenges($, table) {
  const rows = [];

  $(table)
    .find("tbody tr")
    .each((_, row) => {
      const cells = $(row).find("td");
      if (cells.length < 6) return;

      const number = cleanText($(cells[1]).text());
      const challenge = cleanText($(cells[2]).text());
      const description = cleanText($(cells[3]).text());
      const details = cleanText($(cells[4]).text());
      const map = cleanText($(cells[5]).text());

      if (!number || !challenge || !description || !map) return;

      rows.push({
        number,
        challenge,
        description,
        details,
        map
      });
    });

  return rows;
}

function splitIntoChunks(items, chunkSize) {
  const chunks = [];

  for (let i = 0; i < items.length; i += chunkSize) {
    chunks.push(items.slice(i, i + chunkSize));
  }

  return chunks;
}

async function buildRotationList(challenges) {
  const lines = [];

  for (const challenge of challenges) {
    const germanName = await translateToGerman(challenge.challenge);

    if (challenge.isCurrent) {
      lines.push(
        `🔥 **${challenge.number}. ${truncate(germanName, 60)}** — ${truncate(challenge.map, 60)} **← AKTUELL**`
      );
    } else {
      lines.push(
        `👻 **${challenge.number}. ${truncate(germanName, 60)}** — ${truncate(challenge.map, 60)}`
      );
    }
  }

  return lines;
}

async function main() {
  const apiResponse = await fetch(API_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0"
    }
  });

  if (!apiResponse.ok) {
    throw new Error(`Wiki API konnte nicht geladen werden: ${apiResponse.status}`);
  }

  const apiData = await apiResponse.json();

  if (!apiData.parse || !apiData.parse.text || !apiData.parse.text["*"]) {
    throw new Error("Wiki API hat keinen nutzbaren Inhalt geliefert.");
  }

  const html = apiData.parse.text["*"];
  const $ = cheerio.load(html);

  const currentChallengeName = findCurrentChallengeName($);
  const challengeTables = getChallengeTables($);

  if (!currentChallengeName) {
    throw new Error("Aktuelle Challenge konnte nicht erkannt werden.");
  }

  if (challengeTables.length < 1) {
    throw new Error("Keine Challenge-Tabelle gefunden.");
  }

  const standardChallenges = extractStandardChallenges($, challengeTables[0]);

  if (standardChallenges.length === 0) {
    throw new Error("Keine Standard Challenges gefunden.");
  }

  for (const challenge of standardChallenges) {
    challenge.isCurrent =
      challenge.challenge.toLowerCase() === currentChallengeName.toLowerCase();
  }

  const currentChallenge =
    standardChallenges.find(challenge => challenge.isCurrent) || standardChallenges[0];

  const germanCurrentName = await translateToGerman(currentChallenge.challenge);
  const germanCurrentDescription = await translateToGerman(currentChallenge.description);
  const germanCurrentDetails = await translateToGerman(currentChallenge.details);

  const rotationLines = await buildRotationList(standardChallenges);
  const rotationChunks = splitIntoChunks(rotationLines, 13);

  const nowGerman = new Date().toLocaleString("de-DE", {
    timeZone: "Europe/Berlin",
    dateStyle: "full",
    timeStyle: "short"
  });

  const embeds = [
    {
      title: `👻 Aktuelle Weekly Challenge: ${truncate(germanCurrentName, 180)}`,
      url: WIKI_URL,
      description:
        `🔥 **Diese Aufgabe ist diese Woche dran!**\n\n` +
        `**${truncate(germanCurrentDescription, 500)}**\n\n` +
        `🎯 Schließt die wöchentliche Challenge im Challenge Mode auf der angegebenen Map ab.`,
      color: 0x7b2cff,
      fields: [
        {
          name: "🧾 Originalname",
          value: truncate(currentChallenge.challenge, 250),
          inline: true
        },
        {
          name: "🗺️ Map",
          value: truncate(currentChallenge.map, 250),
          inline: true
        },
        {
          name: "💰 Belohnung",
          value: "$5.000 + 5.000 XP",
          inline: true
        },
        {
          name: "📋 Details",
          value: truncate(germanCurrentDetails || "Keine zusätzlichen Details gefunden.", 950),
          inline: false
        }
      ],
      footer: {
        text: `Automatisch ausgelesen und übersetzt • ${nowGerman}`
      }
    }
  ];

  rotationChunks.forEach((chunk, index) => {
    embeds.push({
      title:
        index === 0
          ? "📜 Komplette 26er Standard-Challenge-Rotation"
          : "📜 Standard-Challenge-Rotation Fortsetzung",
      description: chunk.join("\n"),
      color: 0x2f80ed
    });
  });

  embeds.push({
    title: "🔗 Quelle",
    description: `[Phasmophobia Wiki öffnen](${WIKI_URL})`,
    color: 0x444444
  });

  const payload = {
    username: "Phasmo Weekly",
    content:
      "👻 **Phasmophobia Weekly Challenge Update**\n" +
      "Oben steht die aktuelle Wochenaufgabe, unten die komplette 26er-Rotation.",
    embeds,
    allowed_mentions: {
      parse: []
    }
  };

  const discordResponse = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!discordResponse.ok) {
    const errorText = await discordResponse.text();
    throw new Error(`Discord Fehler: ${discordResponse.status} ${errorText}`);
  }

  console.log(
    `Gepostet: Aktuell ${currentChallenge.challenge}, insgesamt ${standardChallenges.length} Standard Challenges.`
  );
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
