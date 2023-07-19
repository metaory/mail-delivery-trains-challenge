import C from "chalk";
import { readFileSync } from "node:fs";

console.clear();

// Debug: print a line separator filling terminal columns
const logSeparator = (char = "#") =>
  console.log(
    Array.from({ length: process.stdout.columns }).fill(char).join("")
  );

// Debug: logger tag function
function log(tpl, ...vars) {
  for (const [i, key] of tpl.entries()) {
    if (!key) continue;
    process.stdout.write(`${key}${C.red.bold(vars[i] ?? "")}`);
  }
  process.stdout.write("\n");
}

// Load up the input.json
const input = JSON.parse(readFileSync("./input.json", { encoding: "utf8" }));
console.log("input:", input);
/* INPUT:
  {
    "stations": ["A", "B", "C", "D"],
    "edges": ["E1,A,B,30", "E2,B,C,10", "E3,C,D,40"],
    "deliveries": ["K1,5,A,C"],
    "trains": ["Q1,6,B"]
  }
*/

// ************************ //
// ************************ //
// ************************ //

// Destructure what we need from input
const {
  // stations, // NOTE: we dont need this!
  edges,
  deliveries,
  trains: [TRAIN], // NOTE: To simplify; lets imagine there is only one train!
} = input;

// NOTE: we'll also ignore the weight constraint entirely

// Reduce input edges to produce connection-map and distances
const { connections, distances } = edges.reduce(
  (acc, cur) => {
    const [, src, dst, distance] = cur.split(",");
    acc.connections[src] = acc.connections[src] ?? [];
    acc.connections[dst] = acc.connections[dst] ?? [];
    acc.connections[src].push(dst);
    acc.connections[dst].push(src);

    acc.distances[`${src}-${dst}`] = +distance;
    acc.distances[`${dst}-${src}`] = +distance;
    return acc;
  },
  { connections: {}, distances: {} }
);

console.log(connections);
//{ A: [ 'B' ], B: [ 'A', 'C' ], C: [ 'B', 'D' ], D: [ 'C' ] }

console.log(distances);
// { 'A-B': 30, 'B-A': 30, 'B-C': 10, 'C-B': 10, 'C-D': 40, 'D-C': 40 }

// Destructure train name and its initial language
const [train, , initialLocation] = TRAIN.split(","); // NOTE: ignoring capacity
`initialLocation: ${initialLocation}`;

// Out global state
const moves = [];
let time = 0;
let current = initialLocation;

// Return the immediate next possible move
const getNext = (from, to) => {
  // Possible next moves
  let [next, alt] = connections[from];

  // The alteranative is the destination
  if (alt === to) {
    next = alt;
  }

  // Dont know which direction to go?
  if (alt && alt !== to) {
    // TODO: greedy traverse both end
    // TODO: figure out which direction to go!!!
    console.log("AT JUNCTION!");
  }

  return next;
};

// Move the train towards a destination ( ? -> F )
function moveTrain(to, pkg = null) {
  log`move train from ${current} to ${to} with ${pkg}`;

  // Our local state
  let next = getNext(current, to);

  // NOTE: Temporary for debug purposes
  let DEBUG_ESCAPE_HATCH = 0;

  // Move untill we've reached destinations
  while (current !== to) {
    DEBUG_ESCAPE_HATCH++;

    log`next: ${next}`;

    // Append the output
    moves.push(`W=${time}, T=${train}, N1=${current}, N2=${next}, P2=[${pkg}]`);

    // Update local state
    time += distances[`${current}-${next}`];
    current = next;
    next = getNext(current, to);

    log`current: ${current}`;

    // NOTE: Temporary for debug purposes
    if (DEBUG_ESCAPE_HATCH > 10) {
      console.error(C.red.bold("REACHED ESCAPE HATCH LIMIT!"), "exiting...");
      process.exit();
    }
    logSeparator("-");
  }
}

// XXX: DEBUG:
// moveTrain("B");
// moveTrain("C");
// moveTrain("A");
// moveTrain("D");
// ^^^^^^^^^^^^^^^^^^^

// Iterate over deliveries
for (const delivery of deliveries) {
  // Destructure delivery detail
  const [pkg, , src, dst] = delivery.split(","); // NOTE: ignoring weight

  // Move train to delivery pickup location
  moveTrain(src);

  // Move train to destination
  moveTrain(dst, pkg);
}

logSeparator();

// Output the result
console.log(moves);
