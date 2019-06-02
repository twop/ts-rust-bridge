import { Deserializer, Serializer } from "ts-binary";

export const bindesc = Symbol("bindesc");

export interface BinTypeDesc<TTag extends string, T = any> {
  read: Deserializer<T>;
  write: Serializer<T>;
  tag: TTag;
  _phantomType: T;
}

type Omit<ToExclude, T> = Pick<T, Exclude<keyof T, ToExclude>>;

export type AnyBinType = BinType<any, any, any>;

export interface BinType<TypeTag extends string, T = any, Extra = {}> {
  [bindesc]: BinTypeDesc<TypeTag, T> & Extra;
}

export type Static<
  A extends BinType<any, any>
> = A[typeof bindesc]["_phantomType"];

export const createBinType = <R extends BinType<any, any>>(
  read: Deserializer<Static<R>>,
  write: Serializer<Static<R>>,
  tag: R[typeof bindesc]["tag"],
  extra: Omit<"read" | "write" | "tag" | "_phantomType", R[typeof bindesc]>,
  baseObj: Omit<typeof bindesc, R>
): R => {
  (baseObj as any)[bindesc] = Object.assign(extra, { read, write, tag });
  return baseObj as any;
};

export enum TypeTag {
  Bool = "Bool",
  Str = "Str",
  U32 = "U32",
  F32 = "F32",
  F64 = "F64",
  U16 = "U16",
  I32 = "I32",
  U8 = "U8",
  Enum = "Enum",
  Struct = "Struct",
  Tuple = "Tuple",
  Union = "Union",
  Option = "Option",
  Nullable = "Nullable",
  Vec = "Vec"
}
