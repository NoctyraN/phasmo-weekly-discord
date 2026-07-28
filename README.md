# 👻 Phasmophobia Weekly Discord Bot

[![Phasmophobia Weekly Discord Post](https://github.com/NoctyraN/phasmo-weekly-discord/actions/workflows/phasmo-weekly.yml/badge.svg)](https://github.com/NoctyraN/phasmo-weekly-discord/actions/workflows/phasmo-weekly.yml)

Ein automatisierter Discord-Webhook für die wöchentlichen **Phasmophobia Challenge Mode Aufgaben**.

Das Projekt liest automatisch die aktuelle Challenge von der Phasmophobia-Fandom-Wiki aus, übersetzt die relevanten Inhalte auf Deutsch und postet sie als übersichtliche Discord-Nachricht in einen festgelegten Channel.

---

## ✨ Features

* Automatischer Discord-Post über GitHub Actions
* Kein eigener Server notwendig
* Kein dauerhaft laufender PC notwendig
* Automatischer Abruf der Phasmophobia-Wiki per Fandom API
* Erkennung der aktuell aktiven Weekly Challenge
* Deutsche Übersetzung von Challenge-Name, Beschreibung und Details
* Fancy Discord-Embed mit:

  * aktueller Weekly Challenge
  * Map
  * Beschreibung
  * Challenge-Details
  * Belohnung
  * kompletter 26er Standard-Challenge-Rotation
  * Markierung der aktuell aktiven Challenge
  * Special Challenges, falls vorhanden
  * direktem Quellenlink zur Wiki
* Manuell über GitHub Actions testbar
* Automatischer Zeitplan per UTC-Cron

---

## 📸 Beispiel-Ausgabe

Der Discord-Post enthält:

```text
👻 Phasmophobia Weekly Challenge Update

Aktuelle Weekly Challenge: Lights out!

🔥 Diese Aufgabe ist diese Woche dran!

Beschreibung:
Bereite deine Kerzen vor, denn alle Lichter sind aus!

Map:
6 Tanglewood Drive

Belohnung:
$5.000 + 5.000 XP

Komplette 26er Standard-Challenge-Rotation:
1. Lights out! ← AKTUELL
2. Speed Demons
3. Detectives only
...
26. Tag! You're it!
```

---

## 🧠 Wie funktioniert es?

Das Projekt besteht aus zwei Hauptteilen:

```text
.github/workflows/phasmo-weekly.yml
.github/phasmo-weekly.js
```

Die Datei `phasmo-weekly.yml` ist der GitHub-Actions-Workflow. Sie legt fest, wann und wie das Script automatisch ausgeführt wird.

Die Datei `phasmo-weekly.js` ist das eigentliche Node.js-Script. Es ruft die Phasmophobia-Wiki ab, liest die Challenge-Tabelle aus, erkennt die aktuelle Weekly Challenge, übersetzt die Inhalte und sendet sie an Discord.

---

## ⏰ Automatischer Zeitplan

Phasmophobia rotiert die Weekly Challenge montags um **00:00 UTC**.

Der GitHub Actions Workflow startet kurz danach:

```yaml
- cron: "15 0 * * 1"
```

Das bedeutet:

```text
Montag 00:15 UTC
```

In Deutschland entspricht das ungefähr:

```text
Winterzeit: Montag 01:15 Uhr
Sommerzeit: Montag 02:15 Uhr
```

---

## 🧩 Voraussetzungen

Benötigt wird:

* Ein GitHub-Account
* Ein Discord-Server
* Ein Discord-Webhook
* GitHub Actions aktiviert
* Ein Repository Secret mit dem Namen `DISCORD_WEBHOOK_URL`

Es wird kein eigener Server und kein lokaler PC benötigt.

---

## 🔐 Discord Webhook Secret

Die Discord Webhook URL wird nicht direkt in den Code geschrieben.

Stattdessen wird sie als GitHub Secret gespeichert:

```text
DISCORD_WEBHOOK_URL
```

Pfad in GitHub:

```text
Repository → Settings → Secrets and variables → Actions → New repository secret
```

Wichtig:

Die Webhook-URL niemals öffentlich posten. Wer diese URL besitzt, kann Nachrichten in den Discord-Channel senden.

---

## 📁 Projektstruktur

```text
phasmo-weekly-discord
├── .github
│   ├── workflows
│   │   └── phasmo-weekly.yml
│   └── phasmo-weekly.js
├── README.md
├── CHANGELOG.md
├── LICENSE
└── .gitignore
```

---

## ⚙️ Workflow

Der Workflow macht automatisch folgende Schritte:

1. GitHub startet den Workflow montags per Schedule.
2. Das Repository wird ausgecheckt.
3. Node.js 24 wird eingerichtet.
4. Die Abhängigkeit `cheerio` wird installiert.
5. Das Script `.github/phasmo-weekly.js` wird ausgeführt.
6. Das Script liest die Wiki-Daten aus.
7. Die Inhalte werden übersetzt.
8. Eine Discord-Nachricht wird über den Webhook gepostet.

---

## 🧪 Manueller Test

Der Workflow kann jederzeit manuell getestet werden:

```text
Repository → Actions → Phasmophobia Weekly Discord Post → Run workflow
```

Dadurch wird sofort ein neuer Discord-Post ausgelöst.

---

## 🌍 Datenquelle

Die Challenge-Daten stammen von:

```text
https://phasmophobia.fandom.com/wiki/Challenge_Mode
```

Das Script nutzt die Fandom API, um die Wiki-Seite stabiler auszulesen.

---

## 🇩🇪 Übersetzung

Die ausgelesenen englischen Inhalte werden automatisch ins Deutsche übersetzt.

Zusätzlich können feste Übersetzungen für bestimmte Begriffe hinterlegt werden, damit typische Spielbegriffe besser klingen.

Beispiel:

```text
Tag! You're it! → Fangen! Du bist dran!
```

---

## ⚠️ Hinweise und Limitierungen

* GitHub Actions führt geplante Workflows nicht immer sekundengenau aus.
* Der automatische Post kann sich um einige Minuten verzögern.
* Wenn die Fandom-Wiki ihre Tabellenstruktur stark ändert, muss das Script eventuell angepasst werden.
* Die automatische Übersetzung ist praktisch, aber nicht immer perfekt.
* Map-Namen werden bewusst nicht übersetzt, da sie im Spiel ebenfalls englisch angezeigt werden.
* Die Discord Webhook URL muss geheim bleiben.

---

## 🛠️ Technik

Verwendet wird:

* Node.js 24
* GitHub Actions
* Discord Webhooks
* Fandom MediaWiki API
* Cheerio zum Parsen der Wiki-Tabelle
* Automatische Übersetzung nach Deutsch

---

## 🚀 Geplanter Nutzen

Dieses Projekt ist für Discord-Communities gedacht, die Phasmophobia spielen und jede Woche automatisch über die aktuelle Weekly Challenge informiert werden möchten.

Besonders praktisch für:

* Gaming-Discords
* Phasmophobia-Gruppen
* Community-Server
* Twitch-Streamer
* Koop-Spielgruppen

---

## 🧾 Lizenz

Dieses Projekt steht unter der MIT License.

---

## 👤 Autor

Erstellt für den Discord-Server von **NoctyraN**.

Projekt: `phasmo-weekly-discord`

Slogan:

```text
Enter the Night.
```
