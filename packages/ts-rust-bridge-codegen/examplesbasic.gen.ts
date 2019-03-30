export type Message =
  | { tag: 'Unit' }
  | { tag: 'One'; value: number }
  | { tag: 'Two'; value: [(boolean) | undefined, number] }
  | { tag: 'VStruct'; value: MessageVStruct };

export interface MessageVStruct {
  id: string;
  data: string;
}

export module Message {
  export const Unit: Message = { tag: 'Unit' };

  export const One = (value: number): Message => ({ tag: 'One', value });

  export const Two = (p0: (boolean) | undefined, p1: number): Message => ({
    tag: 'Two',
    value: [p0, p1]
  });

  export const VStruct = (value: MessageVStruct): Message => ({
    tag: 'VStruct',
    value
  });
}

export type Newtype = number & { type: 'Newtype' };

export module Newtype {
  export const mk = (val: number): number & { type: 'Newtype' } => val as any;
}

export type NewtypeAlias = boolean;

export interface NormalStruct {
  a: number;
  msg: Message;
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
