import { readFileSync } from "node:fs";

const data = JSON.parse(readFileSync("./input.json", { encoding: "utf8" }));

console.log("data:", data);
