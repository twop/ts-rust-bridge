import { Union, of } from 'ts-union';

export enum Scalar {
  U8 = 'U8',
  U16 = 'U16',
  U32 = 'U32',
  I32 = 'I32',
  USIZE = 'USIZE',
  F32 = 'F32',
  F64 = 'F64',
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

export type SchemaElement =
  | { tag: 'Alias'; val: Type }
  | { tag: 'Struct'; val: StructMembers }
  | { tag: 'Enum'; val: EnumVariants }
  | { tag: 'Tuple'; val: Type[] }
  | { tag: 'Newtype'; val: Type }
  | { tag: 'Union'; val: [Variant[], UnionOptions] };

export type Schema = { [name: string]: SchemaElement };

const possibleSchemaElementTags = [
  'Alias',
  'Struct',
  'Enum',
  'Tuple',
  'Newtype',
  'Union'
];

export const isSchemaElement = (val: unknown): val is SchemaElement =>
  typeof val === 'object' &&
  val !== null &&
  'tag' in val &&
  possibleSchemaElementTags.includes((val as any).tag);

type MatchSchemaElement<Res> = {
  Alias: (val: Type) => Res;
  Struct: (val: StructMembers) => Res;
  Enum: (val: EnumVariants) => Res;
  Tuple: (val: Type[]) => Res;
  Newtype: (val: Type) => Res;
  Union: (variants: Variant[], options: UnionOptions) => Res;
};

export const matchSchemaElement = <Res>(
  entry: SchemaElement,
  m: MatchSchemaElement<Res>
): Res => {
  switch (entry.tag) {
    case 'Alias':
      return m.Alias(entry.val);
    case 'Struct':
      return m.Struct(entry.val);
    case 'Enum':
      return m.Enum(entry.val);
    case 'Tuple':
      return m.Tuple(entry.val);
    case 'Newtype':
      return m.Newtype(entry.val);
    case 'Union':
      return m.Union(entry.val[0], entry.val[1]);
  }
};

export type LookupName = (element: SchemaElement) => string;

export const createLookupName = (schema: Schema): LookupName => {
  const mapping = Object.entries(schema).reduce(
    (map, [name, entry]) => map.set(entry, name),
    new Map<SchemaElement, string>()
  );

  return element => {
    const name = mapping.get(element);
    if (name === undefined) {
      throw new Error(
        'not found name for:]n' + JSON.stringify(element, undefined, 2)
      );
    }

    return name;
  };
};

// export type Entry = Entry2; //typeof Entry.T;
// export type Entry = UnionOf<typeof Entry3>; //typeof Entry.T;

export const Variant = Union({
  Unit: of<string>(),
  Tuple: of<string, Type[]>(),
  NewType: of<string, Type>(),
  Struct: of<string, StructMembers>()
});

export enum TypeTag {
  Scalar = 'Scalar',
  Vec = 'Vec',
  Option = 'Option'
  // RefTo = 'RefTo'
}

const scalarsToType: { [K in Scalar]: { tag: TypeTag.Scalar; value: K } } = {
  [Scalar.U8]: { tag: TypeTag.Scalar, value: Scalar.U8 },
  [Scalar.U16]: { tag: TypeTag.Scalar, value: Scalar.U16 },
  [Scalar.U32]: { tag: TypeTag.Scalar, value: Scalar.U32 },
  [Scalar.I32]: { tag: TypeTag.Scalar, value: Scalar.I32 },
  [Scalar.USIZE]: { tag: TypeTag.Scalar, value: Scalar.USIZE },
  [Scalar.F32]: { tag: TypeTag.Scalar, value: Scalar.F32 },
  [Scalar.F64]: { tag: TypeTag.Scalar, value: Scalar.F64 },
  [Scalar.Str]: { tag: TypeTag.Scalar, value: Scalar.Str },
  [Scalar.Bool]: { tag: TypeTag.Scalar, value: Scalar.Bool }
};

export type Type =
  | { tag: TypeTag.Scalar; value: Scalar }
  | { tag: TypeTag.Vec; value: Type }
  | { tag: TypeTag.Option; value: Type }
  | SchemaElement;

const isTypeDefinition = (val: unknown): val is Type => {
  if (isSchemaElement(val)) return true;

  const possibleTypeTags = [TypeTag.Scalar, TypeTag.Vec, TypeTag.Option];
  if (typeof val === 'object' && val != null && 'tag' in val) {
    return possibleTypeTags.includes((val as any).tag);
  }
  return false;
};

type UnionVariantValue =
  | null
  | Type
  | [Type, Type, ...Type[]]
  | { [field: string]: Type };

type UnionDef = { [variant: string]: UnionVariantValue };
const isTupleVariant = (
  val: UnionVariantValue
): val is [Type, Type, ...Type[]] => Array.isArray(val);

const unionDefToVariants = (def: UnionDef): Variant[] =>
  Object.entries(def).map(([field, val]) => {
    if (val === null) return Variant.Unit(field);
    if (isTupleVariant(val)) return Variant.Tuple(field, val);
    if (isTypeDefinition(val)) return Variant.NewType(field, val);

    return Variant.Struct(field, val);
  });

const getName = (s: string) => s;
export const Type = {
  ...scalarsToType,
  Vec: (value: Type): Type => ({ tag: TypeTag.Vec, value }),
  Option: (value: Type): Type => ({ tag: TypeTag.Option, value }),
  Alias: (val: Type): SchemaElement => ({ tag: 'Alias', val }),
  Struct: (val: StructMembers): SchemaElement => ({ tag: 'Struct', val }),
  Enum: (...variants: string[]): SchemaElement => ({
    tag: 'Enum',
    val: { variants }
  }),
  Tuple: (...val: Type[]): SchemaElement => ({ tag: 'Tuple', val }),
  Newtype: (val: Type): SchemaElement => ({ tag: 'Newtype', val }),
  Union: (
    def: UnionDef,
    options: UnionOptions = { tagAnnotation: false }
  ): SchemaElement => ({
    tag: 'Union',
    val: [unionDefToVariants(def), options]
  })
};

export const getVariantName = Variant.match({
  Struct: getName,
  Tuple: getName,
  NewType: getName,
  Unit: getName
});

// export type EntryType = typeof Entry.T;
export type Variant = typeof Variant.T;

export type FileBlock = string;
