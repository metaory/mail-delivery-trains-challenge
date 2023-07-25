/*
 * Randomely generate and store test input data
 * ***************************************** */

import readline from "node:readline";
import { writeFileSync } from "node:fs";
import C from "chalk";

console.clear();

const prompt = readline.createInterface({
	input: process.stdin,
	output: process.stdout,
});

const MAX_STATIONS = 8;
const MAX_DISTANCE = 60;
const MAX_DELIVERIES = 8;
const MAX_TRAINS = 4;
const MAX_WEIGHT = 10;
const MAX_CAPACITY = 10;

console.log("MAX_STATIONS:", MAX_STATIONS);
console.log("MAX_DISTANCE:", MAX_DISTANCE);
console.log("MAX_DELIVERIES:", MAX_DELIVERIES);
console.log("MAX_TRAINS:", MAX_TRAINS);
console.log("MAX_WEIGHT:", MAX_WEIGHT);
console.log("MAX_CAPACITY:", MAX_CAPACITY);
console.log("-------------------------------");

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const rnd = (max = 10, min = 1) =>
	Math.floor(Math.random() * (max - min + 1) + min);

function generate() {
	const stations = Array.from({ length: rnd(MAX_STATIONS, 2) }).reduce(
		(acc) => {
			const name = alphabet[rnd(alphabet.length) - 1];
			if (acc.includes(name) === false) acc.push(name);
			return acc;
		},
		[],
	);

	if (stations.length < 2) return generate();

	const edges = stations.reduce((acc, cur, i, arr) => {
		if (i === arr.length - 1) return acc;
		const name = `E${i + 1}`;
		const src = cur;
		const dst = arr[i + 1];
		const dur = rnd(MAX_DISTANCE);
		return [...acc, [name, src, dst, dur].join(",")];
	}, []);

	const deliveries = Array.from({ length: rnd(MAX_DELIVERIES) }).reduce(
		(acc, _, i) => {
			const name = `K${i + 1}`;
			const weight = rnd(MAX_WEIGHT);
			const src = stations[rnd(stations.length - 1, 0)];
			const srcIndex = stations.findIndex((x) => x === src);
			const remainingStations = [...stations];
			remainingStations.splice(srcIndex, 1);
			const dst = remainingStations[rnd(remainingStations.length - 1, 0)];
			if (src === dst) return acc;
			return [...acc, [name, weight, src, dst].join(",")];
		},
		[],
	);

	const trains = Array.from({ length: rnd(MAX_TRAINS) }).reduce((acc, _, i) => {
		const name = `Q${i + 1}`;
		const capacity = rnd(MAX_CAPACITY);
		const station = stations[rnd(stations.length - 1, 0)];
		return [...acc, [name, capacity, station].join(",")];
	}, []);

	return {
		stations,
		edges,
		deliveries,
		trains,
	};
}

let output = generate();

console.log(output, "\n");

function confirm() {
	prompt.question(`generate again? ${C.red.bold("[Y/n]")} `, (raw) => {
		const answer = (raw || "y").toLowerCase();

		if (answer === "y") {
			output = generate();
			console.log("\n", output, "\n");
			return confirm();
		}

		console.log(C.green("\nok, saving...\n"));

		prompt.question(C.yellow("enter filename: "), (name) => {
			const filename = `${name}.json`;
			console.log(
				C.yellow("storing the generated output in"),
				C.green.bold(`./${filename}`),
			);
			writeFileSync(filename, JSON.stringify(output, null, 2));
			console.log(
				C.yellow("\nyou can now run it with:"),
				C.cyan.bold(`npm start ${filename}`),
			);
			console.log(C.green("\ndone."));
			prompt.close();
		});
	});
}

confirm();
