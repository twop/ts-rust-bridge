export enum MyEnum {
  One = 'One',
  Two = 'Two',
  Three = 'Three'
}

export type NewTypeU32 = number & { type: 'NewTypeU32' };

export const NewTypeU32 = (val: number): number & { type: 'NewTypeU32' } =>
  val as any;

export type AliasToStr = string;

export type SimpleUnion =
  | { tag: 'Unit' }
  | { tag: 'Float32'; value: number }
  | { tag: 'BoolAndU32'; value: SimpleUnion_BoolAndU32 }
  | { tag: 'StructVariant'; value: SimpleUnion_StructVariant };

export interface SimpleUnion_BoolAndU32 {
  0: (boolean) | undefined;
  1: number;
  length: 2;
}

export interface SimpleUnion_StructVariant {
  id: string;
  tuple: MyTuple;
}

export module SimpleUnion {
  export const Unit: SimpleUnion = { tag: 'Unit' };

  export const Float32 = (value: number): SimpleUnion => ({
    tag: 'Float32',
    value
  });

  export const BoolAndU32 = (
    p0: (boolean) | undefined,
    p1: number
  ): SimpleUnion => ({ tag: 'BoolAndU32', value: [p0, p1] });

  export const StructVariant = (
    value: SimpleUnion_StructVariant
  ): SimpleUnion => ({ tag: 'StructVariant', value });
}

export interface JustAStruct {
  u8: number;
  myTuple: MyTuple;
}

export interface MyTuple {
  0: (boolean) | null;
  1: Array<string>;
  length: 2;
}

export const MyTuple = (p0: (boolean) | null, p1: Array<string>): MyTuple => [
  p0,
  p1
];
