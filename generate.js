/* ******************************************** *
 * Randomely Generate and Store test input data *
 * with interactive and non-interactive mode    *
 * ******************************************** */

import readline from "node:readline";
import { writeFileSync } from "node:fs";
import C from "chalk";

const { clear, info } = console;

clear();

const prompt = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// Configurations
const MAX_STATIONS = 10;
const MIN_STATIONS = 3;
const MAX_DISTANCE = 100;
const MAX_DELIVERIES = 10;
const MIN_DELIVERIES = 2;
const MAX_TRAINS = 8;
const MIN_TRAINS = 2;
const MAX_CAPACITY = 100;
const MIN_CAPACITY = 20;
const MAX_MULTIPLIER = 40;

info(C.grey(" MIN-MAX STATIONS   :"), MIN_STATIONS, "-", MAX_STATIONS);
info(C.grey(" MIN-MAX DISTANCE   :"), 1, "-", MAX_DISTANCE);
info(C.grey(" MIN-MAX DELIVERIES :"), MIN_DELIVERIES, "-", MAX_DELIVERIES);
info(C.grey(" MIN-MAX TRAINS     :"), MIN_TRAINS, "-", MAX_TRAINS);
info(C.grey(" MIN-MAX CAPACITY   :"), MIN_CAPACITY, "-", MAX_CAPACITY);
info(C.grey(" MIN-MAX MULTIPLIER :"), 1, "-", MAX_MULTIPLIER);

info(C.grey("------------------------------"));

// DEBUG: Message headers
const ERR = C.black(" ") + C.bgRed.black.bold(" ERROR ");
const DONE = C.black(" ") + C.bgGreen.black.bold(" DONE ");

if (MAX_STATIONS > ALPHABET.length) {
  console.error(
    ERR,
    C.cyan("MAX_STATIONS"),
    `(${C.yellow.bold(MAX_STATIONS)})`,
    C.red("cant be higher than ALPHABET length"),
    `(${C.cyan.bold(ALPHABET.length)})`
  );
  process.exit(1);
}

if (MIN_STATIONS < 3) {
  console.error(
    ERR,
    C.cyan("MIN_STATIONS"),
    `(${C.yellow.bold(MIN_STATIONS)})`,
    C.red("cant be lower than"),
    `(${C.cyan.bold(3)})`
  );
  process.exit(1);
}

const rnd = (max = 10, min = 1, multiplier = 1) =>
  Math.round((Math.random() * (max - min) + min) / multiplier) * multiplier;

function generate(multiplier) {
  const stations = Array.from({
    length: rnd(MAX_STATIONS, MIN_STATIONS),
  }).reduce((acc, _, i) => [...acc, ALPHABET[i]], []);

  const edges = stations.reduce((acc, cur, i, arr) => {
    if (i === arr.length - 1) return acc;
    const name = `E${i + 1}`;
    const src = cur;
    const dst = arr[i + 1];
    const dur = rnd(MAX_DISTANCE, multiplier, multiplier);
    return [...acc, [name, src, dst, dur].join(",")];
  }, []);

  const { trains, highestCapacity } = Array.from({
    length: rnd(MAX_TRAINS, MIN_TRAINS),
  }).reduce(
    (acc, _, i) => {
      const name = `Q${i + 1}`;
      const minCapacity = Math.floor(MIN_CAPACITY / multiplier) * multiplier;
      const capacity = rnd(MAX_CAPACITY, minCapacity, multiplier);
      const station = stations[rnd(stations.length - 1, 0)];

      // To make sure there wont be any package with weight higher than our highest capacity train
      if (capacity > acc.highestCapacity) acc.highestCapacity = capacity;

      acc.trains.push([name, capacity, station].join(","));
      return acc;
    },
    { trains: [], highestCapacity: 0 }
  );

  const deliveries = Array.from({
    length: rnd(MAX_DELIVERIES, MIN_DELIVERIES),
  }).reduce((acc, _, i) => {
    const name = `K${i + 1}`;
    const weight = rnd(highestCapacity, multiplier, multiplier);
    const src = stations[rnd(stations.length - 1, 0)];
    const srcIndex = stations.findIndex((x) => x === src);
    const remainingStations = [...stations];
    remainingStations.splice(srcIndex, 1);
    const dst = remainingStations[rnd(remainingStations.length - 1, 0)];
    return [...acc, [name, weight, src, dst].join(",")];
  }, []);

  return {
    stations,
    edges,
    deliveries,
    trains,
  };
}

const promptConfirm = (question, def) =>
  new Promise((resolve) =>
    prompt.question(
      C.yellow.bold(question) + C.red.bold(def ? " [Y/n] " : " [y/N] "),
      (raw) => resolve((raw.trim() || (def ? "y" : "n")).toLowerCase() === "y")
    )
  );

const promptValue = (question, def, suffix = "") =>
  new Promise((resolve) =>
    prompt.question(C.yellow.bold(question), (raw) =>
      resolve((raw.trim() || def).toLowerCase() + suffix)
    )
  );

const write = (path, data) => {
  writeFileSync(path, JSON.stringify(data, null, 2));
  info("\n", C.blue("stored the generated input data in"), C.green.bold(path));
  process.argv[2] = path;
};

async function menu(multiplier) {
  const output = generate(multiplier);

  info(output, "\n");

  const again = await promptConfirm("generate again?", true);

  if (again) return menu(multiplier);

  info("\n", C.italic.green("saving..."), "\n");

  info(C.italic.cyan(" default filename is"), C.red.bold("tmp"), "\n");

  const filename = await promptValue("enter filename: ", "tmp", ".json");

  write(`./assets/${filename}`, output);

  info("\n ", C.cyan("run the solution with"));
  info("", C.bgGreen.black.bold(` npm start assets/${filename} `), "\n");

  const runIt = await promptConfirm("do you want to run it now?", false);

  if (runIt) await import("./index.js");

  info("\n", DONE);

  process.exit();
}

function validateMultiplier(multiplier) {
  if (isNaN(multiplier)) {
    console.error(ERR, C.red("multiplier must be a"), C.yellow("Number"));
    return false;
  }

  if (multiplier < 1) {
    console.error(ERR, C.red("multiplier must be greater than"), C.yellow(0));
    return false;
  }

  // Arbitrary limit
  if (multiplier >= MAX_MULTIPLIER) {
    console.error(
      ERR,
      C.red("multiplier must be less than"),
      C.yellow(MAX_MULTIPLIER)
    );
    return false;
  }

  return true;
}

async function getMultiplier() {
  info(C.italic("\n multiplier for"), C.blue("[distance, capacity, weight]"));
  info(" eg; multiplier of", C.cyan(5), "gives", C.green("5, 10, 15, 20, ..."));
  info(C.italic.cyan(" default multiplier is"), C.red.bold(1), "\n");

  const multiplier = Math.round(await promptValue("enter multiplier: ", "1"));

  if (validateMultiplier(multiplier) === false) return getMultiplier();

  info(C.green("multiplier is set to"), C.cyan.bold(multiplier), "\n");

  return multiplier;
}

// non-interactive mode
if (process.argv[2] === "force") {
  const multiplier = Math.round(process.argv[3] ?? 1);

  if (validateMultiplier(multiplier) === false) process.exit(1);

  info(C.green("multiplier is set to"), C.cyan.bold(multiplier));

  write("./assets/tmp.json", generate(multiplier));

  info("\n", C.cyan("running solution with test data..."), "\n");

  process.argv[3] = process.argv[4] ?? 3; // Sleep delay

  await import("./index.js");

  info("\n", DONE);

  process.exit();
}

// interactive mode
menu(await getMultiplier());
