import C from "chalk";
import { readFileSync } from "node:fs";

console.clear();

function log(tpl, ...vars) {
  for (const [i, key] of tpl.entries()) {
    if (!key) continue;
    process.stdout.write(`${key}${C.red(vars[i])}`);
  }
  process.stdout.write("\n");
}

const input = JSON.parse(readFileSync("./input.json", { encoding: "utf8" }));
console.log("input:", input);

// ************************************************************************** //
/* INPUT:
  {
    "stations": ["A", "B", "C", "D"],
    "edges": ["E1,A,B,30", "E2,B,C,10", "E3,C,D,40"],
    "deliveries": ["K1,5,A,C"],
    "trains": ["Q1,6,B"]
  }
*/

const {
  // stations, // NOTE: we dont need this!
  edges,
  deliveries,
  trains: [TRAIN], // NOTE: To simplify; lets imagine there is only one train!
} = input;

// NOTE: we'll also ignore weight constraint entirely

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
//{ A: [ 'B' ], B: [ 'A', 'C' ], C: [ 'B', 'D' ], D: [ 'C' ] }

console.log(distances);
// { 'A-B': 30, 'B-A': 30, 'B-C': 10, 'C-B': 10, 'C-D': 40, 'D-C': 40 }

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
    // TODO: greedy traverse both end
    console.log("AT JUNCTION!");
  }

  // TODO: decide which direction to go!!!

  return next;
};

function moveTrain(from, to, pkg = null) {
  // console.log(`move train from ${C.red(from)} to ${C.red(to)} with ${pkg}`);
  log`move train from ${from} to ${to} with ${pkg}`;

  let current = from;
  let next = getNext(from, to);
  let DEBUG_ESCAPE_HATCH = 0; // NOTE: temporary for debug purposes

  while (current !== to) {
    DEBUG_ESCAPE_HATCH++;
    log`next: ${next}`;
    moves.push(`W=${time}, T=${train}, N1=${current}, N2=${next}, P2=[${pkg}]`);
    time += distances[`${current}-${next}`];
    current = next;
    trainLocation = current;
    next = getNext(current, to);
    log`trainLocation: ${trainLocation}`;
    if (DEBUG_ESCAPE_HATCH > 10) process.exit(); // NOTE: temporary for debug
  }
}
// XXX: DEBUG:
// moveTrain("A", "B");
// moveTrain("A", "C");
moveTrain("B", "A");
// moveTrain("A", "D"); // TODO: <<<

// for (const delivery of deliveries) {
//   const [pkg, weight, src, dst] = delivery.split(",");
//   // move train to delivery pickup location
//   // moveTrain(trainLocation, src);
//
//   // move train to destination
//   moveTrain(trainLocation, dst, pkg);
// }

console.log("moves:", moves);
