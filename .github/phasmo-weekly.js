const cheerio = require("cheerio");

const WIKI_URL = "https://phasmophobia.fandom.com/wiki/Challenge_Mode";
const API_URL = "https://phasmophobia.fandom.com/api.php?action=parse&page=Challenge_Mode&prop=text&format=json";
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
        "User-Agent": "Mozilla/5.0"
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
        if (cells.length < 6) return;

        const number = cleanText($(cells[1]).text());
        const challenge = cleanText($(cells[2]).text());
        const description = cleanText($(cells[3]).text());
        const details = cleanText($(cells[4]).text());
        const map = cleanText($(cells[5]).text());

        if (!challenge || !description || !map) return;

        rows.push({
          number,
          challenge,
          description,
          details,
          map
        });
      });
  });

  return rows;
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

  const nowGerman = new Date().toLocaleString("de-DE", {
    timeZone: "Europe/Berlin",
    dateStyle: "full",
    timeStyle: "short"
  });

  const detailsText = germanDetails || "Keine zusätzlichen Details gefunden.";

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
        value: truncate(currentChallenge.map, 250) || "Unbekannt",
        inline: true
      },
      {
        name: "💰 Belohnung",
        value: "$5.000 + 5.000 XP",
        inline: true
      },
      {
        name: "📋 Details",
        value: truncate(detailsText, 900),
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
