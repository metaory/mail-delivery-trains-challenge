/* ******************************************** *
 * Randomely Generate and Store mock input data *
 * with interactive and non-interactive mode    *
 * ******************************************** */

import readline from "node:readline";
import { writeFileSync } from "node:fs";
import C from "chalk";

const { clear, info } = console;

clear();

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// Configurations
const CFG = {
  MIN_STATIONS: 3,
  MAX_STATIONS: 10,
  MAX_DISTANCE: 100,
  MIN_DELIVERIES: 2,
  MAX_DELIVERIES: 10,
  MIN_TRAINS: 2,
  MAX_TRAINS: 8,
  MIN_CAPACITY: 20,
  MAX_CAPACITY: 100,
  MAX_MULTIPLIER: 40, // Arbitrary limit
};

console.table(
  Object.keys(CFG).reduce((acc, cur) => {
    const name = cur.substring(4, cur.length);
    return {
      ...acc,
      [C.cyan(name)]: {
        [C.green("MIN")]: CFG[`MIN_${name}`] ?? 1,
        [C.red("MAX")]: CFG[`MAX_${name}`] ?? Infinity,
      },
    };
  }, {})
);

info(C.grey("--------------------------"));

// DEBUG: Message headers
const ERR = C.black(" ") + C.bgRed.black.bold(" ERROR ");
const DONE = C.black(" ") + C.bgGreen.black.bold(" DONE ");

// Create readline interface
const prompt = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

// Validations
if (CFG.MAX_STATIONS > ALPHABET.length) {
  console.error(
    ERR,
    C.cyan("MAX_STATIONS"),
    `(${C.yellow.bold(CFG.MAX_STATIONS)})`,
    C.red("cant be higher than ALPHABET length"),
    `(${C.cyan.bold(ALPHABET.length)})`
  );
  process.exit(1);
}

if (CFG.MIN_STATIONS < 3) {
  console.error(
    ERR,
    C.cyan("MIN_STATIONS"),
    `(${C.yellow.bold(CFG.MIN_STATIONS)})`,
    C.red("cant be lower than"),
    `(${C.cyan.bold(3)})`
  );
  process.exit(1);
}

// Generate random number between range on factor of multiplier
const rnd = (max = 10, min = 1, multiplier = 1) =>
  Math.round((Math.random() * (max - min) + min) / multiplier) * multiplier;

// Generate mock data
function generate(multiplier) {
  const stations = Array.from({
    length: rnd(CFG.MAX_STATIONS, CFG.MIN_STATIONS),
  }).map((_, i) => ALPHABET[i]);

  const edges = stations.reduce((acc, cur, i, arr) => {
    if (i === arr.length - 1) return acc;
    const name = `E${i + 1}`;
    const src = cur;
    const dst = arr[i + 1];
    const dur = rnd(CFG.MAX_DISTANCE, multiplier, multiplier);
    return [...acc, [name, src, dst, dur].join(",")];
  }, []);

  const { trains, highestCapacity } = Array.from({
    length: rnd(CFG.MAX_TRAINS, CFG.MIN_TRAINS),
  }).reduce(
    (acc, _, i) => {
      const name = `Q${i + 1}`;
      const minCapacity = Math.ceil(CFG.MIN_CAPACITY / multiplier) * multiplier;
      const capacity = rnd(CFG.MAX_CAPACITY, minCapacity, multiplier);
      const station = stations[rnd(stations.length - 1, 0)];

      // To make sure there wont be any package with weight higher than our highest capacity train
      if (capacity > acc.highestCapacity) acc.highestCapacity = capacity;

      acc.trains.push([name, capacity, station].join(","));
      return acc;
    },
    { trains: [], highestCapacity: 0 }
  );

  const deliveries = Array.from({
    length: rnd(CFG.MAX_DELIVERIES, CFG.MIN_DELIVERIES),
  }).map((_, i) => {
    const name = `K${i + 1}`;
    const weight = rnd(highestCapacity, multiplier, multiplier);
    const src = stations[rnd(stations.length - 1, 0)];
    const srcIndex = stations.findIndex((x) => x === src);
    const remainingStations = [...stations];
    remainingStations.splice(srcIndex, 1);
    const dst = remainingStations[rnd(remainingStations.length - 1, 0)];
    return [name, weight, src, dst].join(",");
  });

  return {
    stations,
    edges,
    deliveries,
    trains,
  };
}

// Prompt boolean
const promptConfirm = (question, def) =>
  new Promise((resolve) =>
    prompt.question(
      C.yellow.bold(question) + C.red.bold(def ? " [Y/n] " : " [y/N] "),
      (raw) => resolve((raw.trim() || (def ? "y" : "n")).toLowerCase() === "y")
    )
  );

// Prompt value
const promptValue = (question, def, suffix = "") =>
  new Promise((resolve) =>
    prompt.question(C.yellow.bold(question), (raw) =>
      resolve((raw.trim() || def).toLowerCase() + suffix)
    )
  );

// Write to disk
const write = (path, data) => {
  writeFileSync(path, JSON.stringify(data, null, 2));

  info("\n", C.blue("stored the generated input data in"), C.green.bold(path));
  info("\n ", C.cyan("run the solution with"));
  info("", C.bgGreen.black.bold(` npm start ${path} `), "\n");

  process.argv[2] = path;
};

// Interactive menu
async function menu(multiplier) {
  const output = generate(multiplier);

  info(output, "\n");

  const again = await promptConfirm("generate again?", true);

  if (again) return menu(multiplier);

  info("\n", C.italic.green("saving..."), "\n");

  info(C.italic.cyan(" default filename is"), C.red.bold("tmp"), "\n");

  const filename = await promptValue("enter filename: ", "tmp", ".json");

  write(`assets/${filename}`, output);

  const runIt = await promptConfirm("do you want to run it now?", false);

  if (runIt) await import("./index.js");

  info("\n", DONE);

  process.exit();
}

// Multiplier validation
function validateMultiplier(multiplier) {
  if (isNaN(multiplier)) {
    console.error(ERR, C.red("multiplier must be a"), C.yellow("Number"));
    return false;
  }

  if (multiplier < 1) {
    console.error(ERR, C.red("multiplier must be greater than"), C.yellow(0));
    return false;
  }

  if (multiplier >= CFG.MAX_MULTIPLIER) {
    console.error(
      ERR,
      C.red("multiplier must be less than"),
      C.yellow(CFG.MAX_MULTIPLIER)
    );
    return false;
  }

  info(C.green("multiplier is set to"), C.cyan.bold(multiplier), "\n");

  return true;
}

// Prompt multiplier
async function getMultiplier() {
  info(C.italic("\n multiplier for"), C.blue("[distance, capacity, weight]"));
  info(" eg; multiplier of", C.cyan(5), "gives", C.green("5, 10, 15, 20, ..."));
  info(C.italic.cyan(" default multiplier is"), C.red.bold(1), "\n");

  const multiplier = Math.round(await promptValue("enter multiplier: ", "1"));

  if (validateMultiplier(multiplier) === false) return getMultiplier();

  return multiplier;
}

// non-interactive mode
if (process.argv[2] === "force") {
  const multiplier = Math.round(process.argv[3] ?? 1);

  if (validateMultiplier(multiplier) === false) process.exit(1);

  write("assets/tmp.json", generate(multiplier));

  process.argv[3] = process.argv[4] ?? 3; // Sleep delay

  await import("./index.js");

  info("\n", DONE);

  process.exit();
}

// interactive mode
menu(await getMultiplier());
