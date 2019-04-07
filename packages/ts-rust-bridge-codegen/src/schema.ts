import { Union, of } from 'ts-union';

export enum Scalar {
  U8 = 'U8',
  U16 = 'U16',
  U32 = 'U32',
  USIZE = 'USIZE',
  F32 = 'F32',
  Str = 'Str',
  Bool = 'Bool'
}

export type EnumVariants = {
  variants: string[];
};

export type StructMembers = {
  [prop: string]: Type;
};

export type UnionOptions = {
  tagAnnotation: boolean;
};

export const EntryType = Union({
  Alias: of<string, Type>(),
  Struct: of<string, StructMembers>(),
  Enum: of<string, EnumVariants>(),
  Tuple: of<string, Type[]>(),
  Newtype: of<string, Type>(),
  Union: of<string, VariantT[], UnionOptions>()
});

export const Variant = Union({
  Unit: of<string>(),
  Tuple: of<string, Type[]>(),
  NewType: of<string, Type>(),
  Struct: of<string, StructMembers>()
});

export enum TypeTag {
  Scalar = 'Scalar',
  Vec = 'Vec',
  Option = 'Option',
  RefTo = 'RefTo'
}

const scalarsToType: { [K in Scalar]: { tag: TypeTag.Scalar; value: K } } = {
  [Scalar.U8]: { tag: TypeTag.Scalar, value: Scalar.U8 },
  [Scalar.U16]: { tag: TypeTag.Scalar, value: Scalar.U16 },
  [Scalar.U32]: { tag: TypeTag.Scalar, value: Scalar.U32 },
  [Scalar.USIZE]: { tag: TypeTag.Scalar, value: Scalar.USIZE },
  [Scalar.F32]: { tag: TypeTag.Scalar, value: Scalar.F32 },
  [Scalar.Str]: { tag: TypeTag.Scalar, value: Scalar.Str },
  [Scalar.Bool]: { tag: TypeTag.Scalar, value: Scalar.Bool }
};

export type Type =
  | { tag: TypeTag.Scalar; value: Scalar }
  | { tag: TypeTag.Vec; value: Type }
  | { tag: TypeTag.Option; value: Type }
  | { tag: TypeTag.RefTo; value: string };

const getName = (s: string) => s;
export const T = {
  Scalar: scalarsToType,
  Vec: (value: Type): Type => ({ tag: TypeTag.Vec, value }),
  Option: (value: Type): Type => ({ tag: TypeTag.Option, value }),
  RefTo: (value: string | EntryT): Type => ({
    tag: TypeTag.RefTo,
    value: typeof value === 'string' ? value : getEntryName(value)
  })
};

const getEntryName = EntryType.match({
  Alias: getName,
  Struct: getName,
  Enum: getName,
  Tuple: getName,
  Newtype: getName,
  Union: getName
});

export const getVariantName = Variant.match({
  Struct: getName,
  Tuple: getName,
  NewType: getName,
  Unit: getName
});

export type EntryT = typeof EntryType.T;
export type VariantT = typeof Variant.T;

export type FileBlock = string;
