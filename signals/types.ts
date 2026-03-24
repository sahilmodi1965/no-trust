/**
 * Shared signal interface — decouples signal modules from each other.
 * Every signal fetcher returns this shape so the monitor can aggregate uniformly.
 */

export interface Signal {
  name: string;
  value: number;
  score: number;
  detail: string;
}
