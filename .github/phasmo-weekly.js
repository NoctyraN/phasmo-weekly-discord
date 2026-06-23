name: Phasmophobia Weekly Discord Post

on:
  schedule:
    # GitHub läuft nach Zeitplan. Mehrere Versuche am Montag,
    # damit es zuverlässiger ist, falls GitHub einen Lauf verzögert oder auslässt.
    # Das Script selbst postet nur einmal pro Montag.
    - cron: "15,45 13,14,15,16 * * 1"

  workflow_dispatch:

permissions:
  contents: write

concurrency:
  group: phasmo-weekly-${{ github.ref }}
  cancel-in-progress: false

jobs:
  post:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v5

      - name: Setup Node.js
        uses: actions/setup-node@v5
        with:
          node-version: 24

      - name: Install dependencies
        run: npm install cheerio --no-save

      - name: Post weekly challenge to Discord
        env:
          DISCORD_WEBHOOK_URL: ${{ secrets.DISCORD_WEBHOOK_URL }}
          GITHUB_EVENT_NAME: ${{ github.event_name }}
        run: node .github/phasmo-weekly.js

      - name: Save weekly post state
        run: |
          if [ -n "$(git status --porcelain .github/phasmo-state.json)" ]; then
            git config user.name "github-actions[bot]"
            git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
            git add .github/phasmo-state.json
            git commit -m "Update Phasmo weekly post state [skip ci]"
            git push
          else
            echo "No state changes to commit."
          fi
