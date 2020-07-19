const http = require("https");
const fs = require("fs");
const { Chess } = require("chess.js");
const bzip = require("unbzip2-stream");
const es = require("event-stream");

const save = async (url, dest) => {
  return new Promise(resolve => {
    const file = fs.createWriteStream(dest);
    http.get(url, function (response) {
      response.pipe(file);
      file.on('finish', function () {
        file.close(resolve);
      });
    }).on('error', function (err) {
      fs.unlink(dest);
      if (cb) cb(err.message);
    });
  });
};

const extract = async (src, dest) => {
  return new Promise(resolve => {
    const srcFile = fs.createReadStream(src);
    const destFile = fs.createWriteStream(dest);
    srcFile.pipe(bzip()).pipe(destFile).on('finish', resolve);
  });
}

const parsePgn = (pgn) => {
  // note: does NOT work with annotated moves currently
  const [meta, moves] = pgn.trim().split("\n\n");
  const parsed = meta.split("\n").reduce((parsed, line) => {
    const [, key, value] = line.match(/\[([^ ]*) "(.*)"\]/) || [];
    parsed[key] = value;
    return parsed;
  }, {});
  const game = new Chess();

  const pgnMoves = moves.split(/\d*\./).map(s => s.trim().split(" ")).flat().filter(m => m !== "1/2-1/2" && m !== "1-0" && m !== "0-1" && m !== "");
  parsed.moves = pgnMoves.reduce((prev, move) => {
    const verbose = game.move(move, { sloppy: true });
    if (!verbose) {
      return prev;
    } else {
      const { to, from, promotion } = verbose;
      const algebraic = `${from}${to}${promotion || ""}`;
      return [...prev, algebraic];
    }
  }, []);
  parsed.hash = parsed.Site.replace("https://lichess.org/", "");
  return parsed;
}


const main = async (date, eloMin, eloMax, movesOnly) => {
  try {
    fs.mkdirSync("./downloads");
  } catch (e) { }

  try {
    fs.mkdirSync("./matches");
  } catch (e) { }

  // everything is done with streams because the files can get HUGE

  const zipped = `./downloads/${date}.pgn.bz2`;
  const pgn = `./downloads/${date}.pgn`;

  await save(`https://database.lichess.org/standard/lichess_db_standard_rated_${date}.pgn.bz2`, zipped);
  await extract(zipped, pgn);

  // use a read stream because the files can get HUGE
  let manifestFile = fs.createWriteStream(`./matches/${date}-manifest.json`);
  manifestFile.write("[");
  const pgnFile = fs.createReadStream(pgn);
  pgnFile.pipe(es.split(/((?:\[.*\]\n)*\n1\.(?:.+\n)+)/)).pipe(es.map((raw, done) => {
    // convert to JSON and filter
    // for now, skip annotated matches
    if (raw.trim() === "" || raw.indexOf("%eval") > -1) {
      done();
      return;
    }
    const data = parsePgn(raw);
    const b = parseInt(data.BlackElo);
    const w = parseInt(data.WhiteElo);
    const filter = data && (eloMin ? w >= eloMin && b >= eloMin : true) && (eloMax ? w <= eloMax && b <= eloMax : true);
    if (filter) {
      done(null, data);
    } else {
      done();
    }
    done();
  })).pipe(es.map((data, done) => {
    // write to file or add moves to games
    if (!movesOnly) {
      fs.writeFileSync(`./matches/${data.hash}`);
    } else {
      manifestFile.write(JSON.stringify(data.moves) + ",")
    }
    done();
  })).on("end", () => {
    manifestFile.write("[]]");
    manifestFile.end();
  });
}


main(process.argv[2], process.argv[3], process.argv[4], process.argv[5]);