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

const MAX_STATIONS = 8;
const MAX_DISTANCE = 60;
const MAX_DELIVERIES = 8;
const MAX_TRAINS = 6;
const MAX_CAPACITY = 10;

info("MAX_STATIONS   :", MAX_STATIONS);
info("MAX_DISTANCE   :", MAX_DISTANCE);
info("MAX_DELIVERIES :", MAX_DELIVERIES);
info("MAX_TRAINS     :", MAX_TRAINS);
info("MAX_CAPACITY   :", MAX_CAPACITY);
info("-------------------------------");

const rnd = (max = 10, min = 1) =>
  Math.floor(Math.random() * (max - min + 1) + min);

function generate() {
  const stations = Array.from({ length: rnd(MAX_STATIONS, 2) }).reduce(
    (acc, _, i) => [...acc, ALPHABET[i]],
    []
  );

  const edges = stations.reduce((acc, cur, i, arr) => {
    if (i === arr.length - 1) return acc;
    const name = `E${i + 1}`;
    const src = cur;
    const dst = arr[i + 1];
    const dur = rnd(MAX_DISTANCE);
    return [...acc, [name, src, dst, dur].join(",")];
  }, []);

  const { trains, highestCapacity } = Array.from({
    length: rnd(MAX_TRAINS, 2),
  }).reduce(
    (acc, _, i) => {
      const name = `Q${i + 1}`;
      const capacity = rnd(MAX_CAPACITY);
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
      const weight = rnd(highestCapacity);
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

  if (deliveries.length < 2) return generate();

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

const promptString = (question, def, suffix = "") =>
  new Promise((resolve) =>
    prompt.question(C.yellow(question), (raw) =>
      resolve((raw || def).toLowerCase() + suffix)
    )
  );

const write = (path, data) => {
  info(
    C.yellow("storing the generated input data in"),
    C.green.bold(`./${path}`)
  );
  writeFileSync(path, JSON.stringify(data, null, 2));
  process.argv[2] = path;
};

async function menu(output) {
  info(output, "\n");

  const again = await promptConfirm("generate again?", true);

  if (again) return menu(generate());

  info("\n", C.green("ok, saving..."), "\n");

  const filename = await promptString("enter filename: ", "tmp", ".json");

  write(filename, output);

  info(
    "\n",
    C.yellow("you can run solution with:"),
    C.cyan.bold(`npm start ${filename}`, "\n")
  );

  const runIt = await promptConfirm("do you want to run it now?", false);

  if (runIt) {
    await import("./index.js");
    process.exit();
  }

  info("\n", C.green("done."));
  process.exit();
}

// Argument mode
if (process.argv[2] === "force") {
  write("tmp.json", generate());
  info(C.cyan("running solution with test data..."));
  process.argv[3] = 1;
  await import("./index.js");
  process.exit();
}

// Interactive mode
menu(generate());
