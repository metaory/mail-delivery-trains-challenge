/*
 * Randomely generate and store test input data
 * ***************************************** */

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

const MAX_STATIONS = 10;
const MAX_DISTANCE = 100;
const MAX_DELIVERIES = 6;
const MAX_TRAINS = 4;
const MAX_CAPACITY = 100;

info("MAX_STATIONS   :", MAX_STATIONS);
info("MAX_DISTANCE   :", MAX_DISTANCE);
info("MAX_DELIVERIES :", MAX_DELIVERIES);
info("MAX_TRAINS     :", MAX_TRAINS);
info("MAX_CAPACITY   :", MAX_CAPACITY);
info("-------------------------------");

if (MAX_STATIONS > ALPHABET.length) {
  console.error(
    C.cyan("MAX_STATIONS"),
    `(${C.yellow.bold(MAX_STATIONS)})`,
    C.red("cant be higher than ALPHABET length"),
    `(${C.cyan.bold(ALPHABET.length)})`
  );
  process.exit();
}

const rnd = (max = 10, min = 1, multiplier = 1) =>
  Math.round((Math.random() * (max - min) + min) / multiplier) * multiplier;

function generate(multiplier) {
  const stations = Array.from({ length: rnd(MAX_STATIONS, 3) }).reduce(
    (acc, _, i) => [...acc, ALPHABET[i]],
    []
  );

  const edges = stations.reduce((acc, cur, i, arr) => {
    if (i === arr.length - 1) return acc;
    const name = `E${i + 1}`;
    const src = cur;
    const dst = arr[i + 1];
    const dur = rnd(MAX_DISTANCE, multiplier, multiplier);
    return [...acc, [name, src, dst, dur].join(",")];
  }, []);

  const { trains, highestCapacity } = Array.from({
    length: rnd(MAX_TRAINS, 2),
  }).reduce(
    (acc, _, i) => {
      const name = `Q${i + 1}`;
      const capacity = rnd(MAX_CAPACITY, multiplier, multiplier);
      const station = stations[rnd(stations.length - 1, 0)];

      // To make sure there wont be any package with weight higher than our highest capacity train
      if (capacity > acc.highestCapacity) acc.highestCapacity = capacity;

      acc.trains.push([name, capacity, station].join(","));
      return acc;
    },
    { trains: [], highestCapacity: 0 }
  );

  const deliveries = Array.from({ length: rnd(MAX_DELIVERIES, 2) }).reduce(
    (acc, _, i) => {
      const name = `K${i + 1}`;
      const weight = rnd(highestCapacity, multiplier, multiplier);
      const src = stations[rnd(stations.length - 1, 0)];
      const srcIndex = stations.findIndex((x) => x === src);
      const remainingStations = [...stations];
      remainingStations.splice(srcIndex, 1);
      const dst = remainingStations[rnd(remainingStations.length - 1, 0)];
      if (src === dst) return acc;
      return [...acc, [name, weight, src, dst].join(",")];
    },
    []
  );

  if (deliveries.length < 2) return generate(multiplier);

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
      `${question} ${C.red.bold(def ? "[Y/n]" : "[y/N]")} `,
      (raw) => resolve((raw || (def ? "y" : "n")).toLowerCase() === "y")
    )
  );

const promptValue = (question, def, suffix = "") =>
  new Promise((resolve) =>
    prompt.question(C.yellow(question), (raw) =>
      resolve((raw || def).toLowerCase() + suffix)
    )
  );

const write = (path, data) => {
  writeFileSync(path, JSON.stringify(data, null, 2));
  info(
    "\n",
    C.yellow("stored the generated input data in"),
    C.green.bold(`./${path}`)
  );
  process.argv[2] = path;
};

async function menu(multiplier) {
  const output = generate(multiplier);

  info(output, "\n");

  const again = await promptConfirm("generate again?", true);

  if (again) return menu(multiplier);

  info("\n", C.green("ok, saving..."), "\n");

  const filename = await promptValue("enter filename: ", "tmp", ".json");

  write(filename, output);

  info(
    "\n",
    C.yellow("you can run solution with:"),
    C.cyan.bold(`npm start ${filename}`, "\n")
  );

  const runIt = await promptConfirm("do you want to run it now?", false);

  if (runIt) await import("./index.js");

  info("\n", C.green("done."));

  process.exit();
}

function validateMultiplier(multiplier) {
  if (isNaN(multiplier)) {
    console.error(C.red("multiplier must be a Number"));
    return false;
  }

  if (multiplier < 1) {
    console.error(C.red("multiplier must be greater than"), C.yellow(0));
    return false;
  }

  if (multiplier >= 40) {
    console.error(C.red("multiplier must be less than"), C.yellow(40));
    return false;
  }

  return true;
}

async function getMultiplier() {
  info("\n", "multipler for [Edge distances, Train capacity, Package weight]");
  info("eg; multiplier of", C.cyan(5));
  info("you get:", C.cyan("5, 10, 15, 20, ..."));
  info(C.green("default is"), C.red.bold("1"), "\n");

  const multiplier = Number(await promptValue("enter a multiplier: ", "1"));

  if (validateMultiplier(multiplier) === false) return getMultiplier();

  info(C.green("multiplier is set to"), C.cyan.bold(multiplier), "\n");

  return multiplier;
}

// Argument mode
if (process.argv[2] === "force") {
  const multiplier = Number(process.argv[3] ?? 1);

  if (validateMultiplier(multiplier) === false) process.exit(1);

  info("multiplier is set to", C.cyan.bold(multiplier));

  write("tmp.json", generate(multiplier));

  info(C.cyan("running solution with test data..."));

  process.argv[3] = process.argv[4] ?? 3; // Sleep delay

  await import("./index.js");

  process.exit();
}

// Interactive mode
menu(await getMultiplier());
