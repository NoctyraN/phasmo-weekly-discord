const cheerio = require("cheerio");

const WIKI_URL =
  "https://phasmophobia.fandom.com/wiki/Challenge_Mode";

const API_URL =
  "https://phasmophobia.fandom.com/api.php?action=parse&page=Challenge_Mode&prop=text&format=json";

const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

if (!webhookUrl) {
  throw new Error("DISCORD_WEBHOOK_URL fehlt.");
}

const translationCache = new Map();

const fixedTranslations = new Map([
  ["Tag! You're it!", "Fangen! Du bist dran!"]
]);

function cleanText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/\[Show\]/gi, "")
    .replace(/\[Hide\]/gi, "")
    .trim();
}

function truncate(text, maxLength) {
  const cleaned = cleanText(text);

  if (cleaned.length <= maxLength) {
    return cleaned;
  }

  return cleaned.slice(0, maxLength - 3).trim() + "...";
}

/*
 * Die Zeitsteuerung übernimmt ausschließlich die Workflow-Datei.
 * Deshalb gibt es hier keine zusätzliche Uhrzeitprüfung.
 */
function shouldScheduledRunPostNow() {
  return true;
}

async function fetchWithRetry(url, options = {}, attempts = 3) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url, options);

      if (response.ok) {
        return response;
      }

      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    if (attempt < attempts) {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  throw lastError;
}

async function translateToGerman(text) {
  const cleaned = cleanText(text);

  if (!cleaned) {
    return "";
  }

  if (fixedTranslations.has(cleaned)) {
    return fixedTranslations.get(cleaned);
  }

  if (translationCache.has(cleaned)) {
    return translationCache.get(cleaned);
  }

  try {
    const translateUrl =
      "https://translate.googleapis.com/translate_a/single" +
      "?client=gtx&sl=en&tl=de&dt=t&q=" +
      encodeURIComponent(cleaned);

    const response = await fetchWithRetry(
      translateUrl,
      {
        headers: {
          "User-Agent": "Mozilla/5.0"
        }
      },
      2
    );

    const data = await response.json();

    const translated = data[0]
      .map(part => part[0])
      .join("")
      .trim();

    translationCache.set(cleaned, translated);

    return translated;
  } catch (error) {
    console.log(
      "Übersetzung fehlgeschlagen, nutze Original:",
      error.message
    );

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
  const tables = [];

  $("table").each((_, table) => {
    const headers = [];

    $(table)
      .find("th")
      .each((_, heading) => {
        headers.push(
          cleanText($(heading).text()).toLowerCase()
        );
      });

    const isChallengeTable =
      headers.some(header => header.includes("challenge")) &&
      headers.some(header => header.includes("description")) &&
      headers.some(header => header.includes("map"));

    if (isChallengeTable) {
      tables.push(table);
    }
  });

  return tables;
}

function extractStandardChallenges($, table) {
  const challenges = [];

  $(table)
    .find("tbody tr")
    .each((_, row) => {
      const cells = $(row).find("td");

      if (cells.length < 6) {
        return;
      }

      const number = cleanText($(cells[1]).text());
      const challenge = cleanText($(cells[2]).text());
      const description = cleanText($(cells[3]).text());
      const details = cleanText($(cells[4]).text());
      const map = cleanText($(cells[5]).text());

      if (!number || !challenge || !description || !map) {
        return;
      }

      challenges.push({
        number,
        challenge,
        description,
        details,
        map
      });
    });

  return challenges;
}

function extractSpecialChallenges($, table) {
  const challenges = [];

  $(table)
    .find("tbody tr")
    .each((_, row) => {
      const cells = $(row).find("td");

      if (cells.length < 6) {
        return;
      }

      const challenge = cleanText($(cells[1]).text());
      const description = cleanText($(cells[2]).text());
      const details = cleanText($(cells[3]).text());
      const map = cleanText($(cells[4]).text());
      const eventDates = cleanText($(cells[5]).text());

      if (!challenge || !description || !map) {
        return;
      }

      challenges.push({
        challenge,
        description,
        details,
        map,
        eventDates
      });
    });

  return challenges;
}

function splitIntoChunks(items, chunkSize) {
  const chunks = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
}

async function buildRotationList(challenges) {
  const lines = [];

  for (const challenge of challenges) {
    const germanName =
      await translateToGerman(challenge.challenge);

    if (challenge.isCurrent) {
      lines.push(
        `🔥 **${challenge.number}. ${truncate(germanName, 60)}**` +
        ` — ${truncate(challenge.map, 60)} **← AKTUELL**`
      );
    } else {
      lines.push(
        `👻 **${challenge.number}. ${truncate(germanName, 60)}**` +
        ` — ${truncate(challenge.map, 60)}`
      );
    }
  }

  return lines;
}

async function buildSpecialList(challenges) {
  const lines = [];

  for (const challenge of challenges) {
    const germanName =
      await translateToGerman(challenge.challenge);

    lines.push(
      `🎃 **${truncate(germanName, 60)}**` +
      ` — ${truncate(challenge.map, 60)}` +
      ` | ${truncate(
        challenge.eventDates || "Event-Zeitraum unbekannt",
        80
      )}`
    );
  }

  return lines;
}

async function loadWikiHtml() {
  const response = await fetchWithRetry(
    API_URL,
    {
      headers: {
        "User-Agent":
          "PhasmoWeeklyDiscordBot/1.0 (GitHub Actions)"
      }
    },
    3
  );

  const data = await response.json();

  if (
    !data.parse ||
    !data.parse.text ||
    !data.parse.text["*"]
  ) {
    throw new Error(
      "Die Wiki-API hat keinen nutzbaren Inhalt geliefert."
    );
  }

  return data.parse.text["*"];
}

async function main() {
  if (!shouldScheduledRunPostNow()) {
    return;
  }

  const html = await loadWikiHtml();
  const $ = cheerio.load(html);

  const currentChallengeName =
    findCurrentChallengeName($);

  const challengeTables =
    getChallengeTables($);

  if (!currentChallengeName) {
    throw new Error(
      "Die aktuelle Challenge konnte nicht erkannt werden."
    );
  }

  if (challengeTables.length === 0) {
    throw new Error(
      "Es wurde keine Challenge-Tabelle gefunden."
    );
  }

  const standardChallenges =
    extractStandardChallenges($, challengeTables[0]);

  const specialChallenges = challengeTables[1]
    ? extractSpecialChallenges($, challengeTables[1])
    : [];

  if (standardChallenges.length === 0) {
    throw new Error(
      "Es wurden keine Standard-Challenges gefunden."
    );
  }

  for (const challenge of standardChallenges) {
    challenge.isCurrent =
      challenge.challenge.toLowerCase() ===
      currentChallengeName.toLowerCase();
  }

  const currentChallenge =
    standardChallenges.find(
      challenge => challenge.isCurrent
    );

  if (!currentChallenge) {
    throw new Error(
      `Die aktuelle Challenge "${currentChallengeName}" ` +
      "wurde nicht in der Rotation gefunden."
    );
  }

  const germanCurrentName =
    await translateToGerman(currentChallenge.challenge);

  const germanCurrentDescription =
    await translateToGerman(currentChallenge.description);

  const germanCurrentDetails =
    await translateToGerman(currentChallenge.details);

  const rotationLines =
    await buildRotationList(standardChallenges);

  const rotationChunks =
    splitIntoChunks(rotationLines, 13);

  const specialLines =
    await buildSpecialList(specialChallenges);

  const specialChunks =
    splitIntoChunks(specialLines, 8);

  const germanPostTime = new Date().toLocaleString(
    "de-DE",
    {
      timeZone: "Europe/Berlin",
      dateStyle: "full",
      timeStyle: "short"
    }
  );

  const embeds = [
    {
      title:
        `👻 Aktuelle Weekly Challenge: ` +
        truncate(germanCurrentName, 180),

      url: WIKI_URL,

      description:
        "🔥 **Diese Aufgabe ist diese Woche dran!**\n\n" +
        `**${truncate(germanCurrentDescription, 500)}**\n\n` +
        "🎯 Schließt die wöchentliche Challenge im " +
        "Challenge Mode auf der angegebenen Map ab.",

      color: 0x7b2cff,

      fields: [
        {
          name: "🧾 Originalname",
          value: truncate(
            currentChallenge.challenge,
            250
          ),
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
          value: truncate(
            germanCurrentDetails ||
              "Keine zusätzlichen Details gefunden.",
            950
          ),
          inline: false
        }
      ],

      footer: {
        text:
          `Automatisch ausgelesen und übersetzt • ` +
          germanPostTime
      }
    }
  ];

  rotationChunks.forEach((chunk, index) => {
    embeds.push({
      title:
        index === 0
          ? "📜 Komplette 26er Standard-Challenge-Rotation"
          : "📜 Standard-Challenge-Rotation – Fortsetzung",

      description: chunk.join("\n"),
      color: 0x2f80ed
    });
  });

  specialChunks.forEach((chunk, index) => {
    embeds.push({
      title:
        index === 0
          ? "🎃 Special Challenges"
          : "🎃 Special Challenges – Fortsetzung",

      description: chunk.join("\n"),
      color: 0xff8c00
    });
  });

  embeds.push({
    title: "🔗 Quelle",
    description:
      `[Phasmophobia Wiki öffnen](${WIKI_URL})`,
    color: 0x444444
  });

  const payload = {
    username: "Phasmo Weekly",

    content:
      "👻 **Phasmophobia Weekly Challenge Update**\n" +
      "Oben steht die aktuelle Wochenaufgabe. " +
      "Darunter findest du die komplette 26er-Rotation.",

    embeds: embeds.slice(0, 10),

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
    const errorText =
      await discordResponse.text();

    throw new Error(
      `Discord-Fehler: ${discordResponse.status} ${errorText}`
    );
  }

  console.log(
    `Erfolgreich gepostet: ${currentChallenge.challenge}. ` +
    `${standardChallenges.length} Standard-Challenges und ` +
    `${specialChallenges.length} Special-Challenges gefunden.`
  );
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
