export type Message =
  | { tag: 'Unit' }
  | { tag: 'AnotherUnit' }
  | { tag: 'One'; value: number }
  | { tag: 'Two'; value: Message_Two }
  | { tag: 'VStruct'; value: Message_VStruct };

export interface Message_Two {
  0: (boolean) | undefined;
  1: number;
  length: 2;
}

export interface Message_VStruct {
  id: string;
  data: string;
}

export module Message {
  export const Unit: Message = { tag: 'Unit' };

  export const AnotherUnit: Message = { tag: 'AnotherUnit' };

  export const One = (value: number): Message => ({ tag: 'One', value });

  export const Two = (p0: (boolean) | undefined, p1: number): Message => ({
    tag: 'Two',
    value: [p0, p1]
  });

  export const VStruct = (value: Message_VStruct): Message => ({
    tag: 'VStruct',
    value
  });
}

export type NType = number & { type: 'NType' };

export module NType {
  export const mk = (val: number): number & { type: 'NType' } => val as any;
}

export type Container =
  | { tag: 'Units' }
  | { tag: 'JustNumber'; value: number }
  | { tag: 'Figures'; value: Array<Figure> };

export module Container {
  export const Units: Container = { tag: 'Units' };

  export const JustNumber = (value: number): Container => ({
    tag: 'JustNumber',
    value
  });

  export const Figures = (value: Array<Figure>): Container => ({
    tag: 'Figures',
    value
  });
}

export interface Color {
  0: number;
  1: number;
  2: number;
  length: 3;
}

export module Color {
  export const mk = (p0: number, p1: number, p2: number): Color => [p0, p1, p2];
}

export interface Figure {
  dots: Array<Vec3>;
  colors: Array<Color>;
}

export interface Vec3 {
  0: number;
  1: number;
  2: number;
  length: 3;
}

export module Vec3 {
  export const mk = (p0: number, p1: number, p2: number): Vec3 => [p0, p1, p2];
}

export interface NormalStruct {
  a: number;
  tuple: Tuple;
}

export enum Enum {
  ONE = 'ONE',
  TWO = 'TWO',
  THREE = 'THREE'
}

export interface Tuple {
  0: (boolean) | undefined;
  1: Array<string>;
  length: 2;
}

export module Tuple {
  export const mk = (p0: (boolean) | undefined, p1: Array<string>): Tuple => [
    p0,
    p1
  ];
}

export type Aha = Array<(Array<string>) | undefined>;
