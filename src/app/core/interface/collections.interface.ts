export interface CollectionData {
  id: string;
  symbol: string;
  kind: string;
  description: string;
  tickSize: number;
}

export interface Paging {
  page: number;
  pages: number;
  items: number;
}

export interface ApiResponse {
  paging: Paging;
  data: CollectionData[];
}
