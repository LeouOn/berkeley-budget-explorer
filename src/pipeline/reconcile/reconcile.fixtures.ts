// SYNTHETIC TEST FIXTURES — DO NOT LOAD IN PRODUCTION.
// Production reads the five snapshots under `data/snapshots/`.

export {
  scoExpenditurePerCapitaFixture,
  type ScoExpenditurePerCapitaFixtureRow,
} from "../sources/sco-per-capita.fixtures";
export { blsFixture, blsPartialFixture } from "../sources/bls-cpi.fixtures";
export { socrataFixture } from "../sources/berkeley-socrata.fixtures";
