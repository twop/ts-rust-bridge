export enum Size {
  S = 'S',
  M = 'M',
  L = 'L'
}

export interface Shirt {
  size: Size;
  color: string;
  price: number;
}
