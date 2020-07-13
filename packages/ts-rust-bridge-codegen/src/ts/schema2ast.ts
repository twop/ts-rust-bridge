import {
  StructMembers,
  Scalar,
  Type,
  SchemaElement,
  TypeTag,
  Variant,
  getVariantName,
  matchSchemaElement,
  LookupName,
  createLookupName
} from '../schema';

import { TsFileBlock, TsFileBlock as ts, Code } from './ast';

export type Module = {
  type: 'ts-file-module';
  name: string;
  blocks: TsFileBlock[];
};

const Module = (name: string, blocks: TsFileBlock[]): Module => ({
  name,
  blocks,
  type: 'ts-file-module'
});

export const isModule = (block: Module | TsFileBlock): block is Module =>
  (block as Module).type === 'ts-file-module';

const entryToBlocks = (
  name: string,
  entry: SchemaElement,
  lookup: LookupName
): (TsFileBlock | Module)[] =>
  matchSchemaElement(entry, {
    Alias: type => [aliasToAlias(name, type, lookup)],
    Struct: members => [structToInterface(name, members, lookup)],
    Enum: ({ variants }) => [enumToStringEnum(name, variants)],
    Union: variants => [
      unionToTaggedUnion(name, variants, lookup),
      ...unionToPayloadInterfaces(name, variants, lookup),
      Module(name, unionToConstructors(name, variants, lookup))
    ],
    Tuple: fields => [
      tupleToInterface(name, fields, lookup),
      tupleToConstructor(name, fields, lookup)
    ],
    Newtype: type => [
      newtypeToTypeAlias(name, type, lookup),
      newtypeToConstructor(name, type, lookup)
    ]
  });

export const schema2ast = (entries: { [name: string]: SchemaElement }) =>
  Object.entries(entries).reduce(
    (blocks, [name, entry]) =>
      blocks.concat(entryToBlocks(name, entry, createLookupName(entries))),
    [] as (TsFileBlock | Module)[]
  );

const aliasToAlias = (
  name: string,
  type: Type,
  lookup: LookupName
): TsFileBlock => ts.Alias({ name, toType: typeToString(type, lookup) });

const enumToStringEnum = (name: string, variants: string[]): TsFileBlock =>
  ts.StringEnum({
    name,
    variants: variants.map((v): [string, string] => [v, v])
  });

const unionToTaggedUnion = (
  name: string,
  variants: Variant[],
  lookup: LookupName
): TsFileBlock =>
  ts.Union({
    name,
    tagField: 'tag',
    valueField: 'value',
    variants: variants.map(v => ({
      tag: getVariantName(v),
      valueType: variantPayloadType(name, v, lookup)
    }))
  });

const newtypeToTypeAlias = (
  name: string,
  type: Type,
  lookup: LookupName
): TsFileBlock =>
  ts.Alias({
    name,
    toType: newtypeToTypeStr(type, name, lookup)
  });

const newtypeToConstructor = (
  name: string,
  type: Type,
  lookup: LookupName
): TsFileBlock =>
  ts.ArrowFunc({
    name,
    params: [
      {
        name: 'val',
        type: typeToString(type, lookup)
      }
    ],
    body: `(val as any)`,
    returnType: newtypeToTypeStr(type, name, lookup)
  });

const unionToPayloadInterfaces = (
  unionName: string,
  variants: Variant[],
  lookup: LookupName
): TsFileBlock[] =>
  variants.reduce(
    (interfaces, v) =>
      Variant.match(v, {
        Struct: (structName, members) =>
          interfaces.concat(
            structToInterface(
              variantPayloadTypeName(unionName, structName),
              members,
              lookup
            )
          ),
        Tuple: (tupleName, types) =>
          interfaces.concat(
            tupleToInterface(
              variantPayloadTypeName(unionName, tupleName),
              types,
              lookup
            )
          ),
        default: () => interfaces
      }),
    [] as TsFileBlock[]
  );

const unionToConstructors = (
  unionName: string,
  variants: Variant[],
  lookup: LookupName
): TsFileBlock[] =>
  variants.map(v => {
    const params = variantToCtorParameters(unionName, v, lookup);
    const name = getVariantName(v);
    return params.length > 0
      ? ts.ArrowFunc({
          name,
          params,
          body: `(${variantToCtorBody(v)})`,
          returnType: unionName
        })
      : ts.ConstVar({
          name,
          type: unionName,
          expression: variantToCtorBody(v)
        });
  });

const variantToCtorParameters = (
  unionName: string,
  v: Variant,
  lookup: LookupName
): Code.Field[] =>
  Variant.match(v, {
    Struct: name => [
      { name: 'value', type: variantPayloadTypeName(unionName, name) }
    ],
    Unit: () => [],
    NewType: (_, type) => [{ name: 'value', type: typeToString(type, lookup) }],
    Tuple: (_, fields) =>
      fields.map((f, i) => ({ name: `p${i}`, type: typeToString(f, lookup) }))
  });

const variantToCtorBody = Variant.match({
  Struct: name => `{ tag: "${name}", value}`,
  Unit: name => `{ tag: "${name}"}`,
  NewType: name => `{ tag: "${name}", value}`,
  Tuple: (name, fields) =>
    `{ tag: "${name}", value: [${fields.map((_, i) => `p${i}`)}]}`
});

const variantPayloadType = (
  unionName: string,
  v: Variant,
  lookup: LookupName
): string | undefined =>
  Variant.match(v, {
    Struct: name => variantPayloadTypeName(unionName, name),
    Tuple: name => variantPayloadTypeName(unionName, name),
    Unit: () => undefined,
    NewType: (_, type) => typeToString(type, lookup)
    // Tuple: (_, fields) => `[${fields.map(typeToString).join(', ')}]`
  });

const structToInterface = (
  name: string,
  members: StructMembers,
  lookup: LookupName
): TsFileBlock =>
  ts.Interface({
    name,
    fields: Object.keys(members).map(
      (name): Code.Field => ({
        name,
        type: typeToString(members[name], lookup)
      })
    )
  });

const tupleToInterface = (
  name: string,
  fields: Type[],
  lookup: LookupName
): TsFileBlock =>
  ts.Interface({
    name,
    fields: fields
      .map(
        (field, i): Code.Field => ({
          name: i.toString(),
          type: typeToString(field, lookup)
        })
      )
      .concat({ name: 'length', type: fields.length.toString() })
  });

const tupleToConstructor = (
  name: string,
  fields: Type[],
  lookup: LookupName
): TsFileBlock =>
  ts.ArrowFunc({
    name,
    params: fields.map(
      (f, i): Code.Field => ({
        name: 'p' + i.toString(),
        type: typeToString(f, lookup)
      })
    ),
    body: `[${fields.map((_, i) => 'p' + i.toString()).join(', ')}]`,
    returnType: name
  });

const scalarToTypeString = (scalar: Scalar): string => {
  switch (scalar) {
    case Scalar.Bool:
      return 'boolean';
    case Scalar.F32:
    case Scalar.F64:
    case Scalar.I32:
    case Scalar.U8:
    case Scalar.U16:
    case Scalar.U32:
    case Scalar.USIZE:
      return 'number';
    case Scalar.Str:
      return 'string';
  }
};

export const typeToString = (type: Type, lookup: LookupName): string => {
  switch (type.tag) {
    case TypeTag.Option:
      return `(${typeToString(type.value, lookup)}) | undefined`;
    case TypeTag.Nullable:
      return `(${typeToString(type.value, lookup)}) | null`;
    case TypeTag.Scalar:
      return scalarToTypeString(type.value);
    case TypeTag.Vec:
      return `Array<${typeToString(type.value, lookup)}>`;
  }
  return lookup(type);
};

const newtypeToTypeStr = (
  type: Type,
  name: string,
  lookup: LookupName
): string => `${typeToString(type, lookup)} & { type: '${name}'}`;

export const variantPayloadTypeName = (
  unionName: string,
  variantName: string
): string => unionName + '_' + variantName;
