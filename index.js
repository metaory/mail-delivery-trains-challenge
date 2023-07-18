import C from "chalk";
import { readFileSync } from "node:fs";

console.clear();

const log = (key, value) => console.log(key, C.red(value));

const data = JSON.parse(readFileSync("./input.json", { encoding: "utf8" }));
console.log("data:", data);

const {
  // stations, // NOTE: we dont need this!
  edges,
  deliveries,
  trains: [TRAIN], // NOTE: To simplify; lets imagine there is only one train!
} = data;

// NOTE: we'll also ignore weight constraint entirely as well!

/*
  {
    "stations": ["A", "B", "C"],
    "edges": ["E1, A, B, 30", "E2, B, C, 10"],
    "deliveries": ["K1, 5, A, C"],
    "trains": ["Q1, 6, B"]
  }
*/

// const wish = { A: ["B"], B: ["A", "C"], C: ["B"] };

const { connections, distances } = edges.reduce(
  (acc, cur) => {
    const [, from, to, distance] = cur.split(",");
    acc.connections[from] = acc.connections[from] || [];
    acc.connections[to] = acc.connections[to] || [];
    acc.connections[from].push(to);
    acc.connections[to].push(from);

    acc.distances[`${from}-${to}`] = +distance;
    acc.distances[`${to}-${from}`] = +distance;
    return acc;
  },
  { connections: {}, distances: {} }
);

console.log(connections);
console.log(distances);

const [train, , initialLocation] = TRAIN.split(","); // NOTE: ignoring capacity
// log("initialLocation:", initialLocation);

const moves = [];
let time = 0;
let trainLocation = initialLocation;

const getNext = (from, to) => {
  let [next, alt] = connections[from];

  if (alt === to) {
    next = alt;
  }

  if (alt && alt !== to) {
    // TODO:
    console.log("AT JUNCTION!");
  }

  return next;
};

function moveTrain(from, to, pkg = null) {
  console.log(`move train from ${C.red(from)} to ${C.red(to)} with ${pkg}`);

  let current = from;
  let next = getNext(from, to);

  while (current !== to) {
    log("next:", next);
    moves.push(`W=${time}, T=${train}, N1=${current}, N2=${next}, P2=[${pkg}]`);
    trainLocation = next;
    time += distances[`${current}-${next}`];
    current = next;
    next = getNext(next, to);
    log("trainLocation:", trainLocation);
    process.exit();
  }
}
// moveTrain("A", "B");
moveTrain("A", "C");

// for (const delivery of deliveries) {
//   const [pkg, weight, src, dst] = delivery.split(",");
//   // move train to delivery pickup location
//   // moveTrain(trainLocation, src);
//
//   // move train to destination
//   moveTrain(trainLocation, dst, pkg);
// }

console.log("moves:", moves);
