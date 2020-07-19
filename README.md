# Lichess DB JSON

Command line tool for downloading and converting the Lichess.org DB to JSON.

Not very practical - processing the smallest month (2013-01) takes a few hours.

# Usage

Download and parse all matches from one month.

> Note: The earliest valid date is 2013-01

```bash
node index.js YYYY-MM eloMin? eloMax? movesOnly?
```

The moves only option will save all the matches as long algebraic notation move lists in a single file (matches/manifest.json).

It should be trivial to extend to download all the available matches - but it's 300GB+ of data as PGN and would take some better handling to work with.