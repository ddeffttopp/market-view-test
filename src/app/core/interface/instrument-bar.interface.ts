export interface InstrumentBar {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export interface FintachartsBarsResponse {
  data: InstrumentBar[];
}

export interface ChartBarData {
  x: number;
  o: number;
  h: number;
  l: number;
  c: number;
}
