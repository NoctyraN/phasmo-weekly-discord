const cheerio = require("cheerio");

const WIKI_URL = "https://phasmophobia.fandom.com/wiki/Challenge_Mode";
const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

if (!webhookUrl) {
  throw new Error("DISCORD_WEBHOOK_URL fehlt.");
}

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

  try {
    const url =
      "https://translate.googleapis.com/translate_a/single" +
      "?client=gtx&sl=en&tl=de&dt=t&q=" +
      encodeURIComponent(cleaned);

    const response = await fetch(url, {
      headers: {
        "User-Agent": "phasmo-weekly-discord-bot/1.0"
      }
    });

    if (!response.ok) {
      throw new Error(`Translate HTTP ${response.status}`);
    }

    const data = await response.json();

    return data[0]
      .map(part => part[0])
      .join("")
      .trim();
  } catch (error) {
    console.log("Übersetzung fehlgeschlagen, nutze Original:", error.message);
    return cleaned;
  }
}

function findCurrentChallengeName($) {
  const pageText = cleanText($("body").text());

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

function extractChallengeRows($) {
  const rows = [];

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

    $(table)
      .find("tbody tr")
      .each((_, row) => {
        const cells = $(row).find("td");
        if (cells.length < 4) return;

        const cellTexts = cells
          .map((_, cell) => cleanText($(cell).text()))
          .get();

        let number = "";
        let challenge = "";
        let description = "";
        let details = "";
        let map = "";
        let eventDates = "";

        if (cellTexts.length >= 6) {
          number = cellTexts[1];
          challenge = cellTexts[2];
          description = cellTexts[3];
          details = cellTexts[4];
          map = cellTexts[5];
          eventDates = cellTexts[6] || "";
        } else if (cellTexts.length >= 5) {
          challenge = cellTexts[1] || cellTexts[0];
          description = cellTexts[2] || "";
          details = cellTexts[3] || "";
          map = cellTexts[4] || "";
          eventDates = cellTexts[5] || "";
        }

        if (!challenge || !description || !map) return;

        rows.push({
          number,
          challenge,
          description,
          details,
          map,
          eventDates
        });
      });
  });

  return rows;
}

async function main() {
  const pageResponse = await fetch(WIKI_URL, {
    headers: {
      "User-Agent": "phasmo-weekly-discord-bot/1.0"
    }
  });

  if (!pageResponse.ok) {
    throw new Error(`Wiki konnte nicht geladen werden: ${pageResponse.status}`);
  }

  const html = await pageResponse.text();
  const $ = cheerio.load(html);

  const currentChallengeName = findCurrentChallengeName($);

  if (!currentChallengeName) {
    throw new Error("Aktuelle Challenge konnte nicht erkannt werden.");
  }

  const challengeRows = extractChallengeRows($);

  const currentChallenge = challengeRows.find(row =>
    row.challenge.toLowerCase() === currentChallengeName.toLowerCase()
  );

  if (!currentChallenge) {
    throw new Error(`Challenge "${currentChallengeName}" wurde nicht in der Tabelle gefunden.`);
  }

  const germanTitle = await translateToGerman(currentChallenge.challenge);
  const germanDescription = await translateToGerman(currentChallenge.description);
  const germanDetails = await translateToGerman(currentChallenge.details);
  const germanMap = await translateToGerman(currentChallenge.map);

  const nowGerman = new Date().toLocaleString("de-DE", {
    timeZone: "Europe/Berlin",
    dateStyle: "full",
    timeStyle: "short"
  });

  const embed = {
    title: `👻 Weekly Challenge: ${truncate(germanTitle, 180)}`,
    url: WIKI_URL,
    description:
      `**${truncate(germanDescription, 350)}**\n\n` +
      `🎯 Schließt die wöchentliche Challenge im Challenge Mode auf der angegebenen Map ab.`,
    color: 0x7b2cff,
    fields: [
      {
        name: "🧾 Originalname",
        value: truncate(currentChallenge.challenge, 250) || "Unbekannt",
        inline: true
      },
      {
        name: "🗺️ Map",
        value: truncate(germanMap, 250) || truncate(currentChallenge.map, 250) || "Unbekannt",
        inline: true
      },
      {
        name: "💰 Belohnung",
        value: "$5.000 + 5.000 XP",
        inline: true
      },
      {
        name: "📋 Details",
        value: truncate(germanDetails || "Keine zusätzlichen Details gefunden.", 900),
        inline: false
      },
      {
        name: "🔗 Quelle",
        value: `[Phasmophobia Wiki öffnen](${WIKI_URL})`,
        inline: false
      }
    ],
    footer: {
      text: `Automatisch ausgelesen und übersetzt • ${nowGerman}`
    }
  };

  const payload = {
    username: "Phasmo Weekly",
    content: "👻 **Die neue Phasmophobia Weekly Challenge ist da!**",
    embeds: [embed],
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

  console.log(`Gepostet: ${currentChallenge.challenge} → ${germanTitle}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
