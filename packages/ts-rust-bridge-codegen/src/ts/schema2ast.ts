import {
  StructMembers,
  Scalar,
  Type,
  EntryType,
  TypeTag,
  Variant,
  getVariantName
} from '../schema';

import { TsFileBlock, TsFileBlock as ts, D } from './ast';

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

const entryToBlocks = EntryType.match({
  Alias: (name, type): (TsFileBlock | Module)[] => [aliasToAlias(name, type)],
  Struct: (name, members) => [structToInterface(name, members)],
  Enum: (name, { variants }) => [enumToStringEnum(name, variants)],
  Union: (name, variants) => [
    unionToTaggedUnion(name, variants),
    ...unionToPayloadInterfaces(name, variants),
    Module(name, unionToConstructors(name, variants))
  ],
  Tuple: (name, fields) => [
    tupleToInterface(name, fields),
    tupleToConstructor(name, fields)
  ],
  Newtype: (name, type) => [
    newtypeToTypeAlias(name, type),
    newtypeToConstructor(name, type)
  ]
});

export const schema2ast = (entries: EntryType[]) =>
  entries.reduce((blocks, entry) => blocks.concat(entryToBlocks(entry)), [] as (
    | TsFileBlock
    | Module)[]);

const aliasToAlias = (name: string, type: Type): TsFileBlock =>
  ts.Alias({ name, toType: typeToString(type) });

const enumToStringEnum = (name: string, variants: string[]): TsFileBlock =>
  ts.StringEnum({
    name,
    variants: variants.map((v): [string, string] => [v, v])
  });

const unionToTaggedUnion = (name: string, variants: Variant[]): TsFileBlock =>
  ts.Union({
    name,
    tagField: 'tag',
    valueField: 'value',
    variants: variants.map(v => ({
      tag: getVariantName(v),
      valueType: variantPayloadType(name, v)
    }))
  });

const newtypeToTypeAlias = (name: string, type: Type): TsFileBlock =>
  ts.Alias({
    name,
    toType: newtypeToTypeStr(type, name)
  });

const newtypeToConstructor = (name: string, type: Type): TsFileBlock =>
  ts.ArrowFunc({
    name,
    params: [
      {
        name: 'val',
        type: typeToString(type)
      }
    ],
    body: `(val as any)`,
    returnType: newtypeToTypeStr(type, name)
  });

const unionToPayloadInterfaces = (
  unionName: string,
  variants: Variant[]
): TsFileBlock[] =>
  variants.reduce(
    (interfaces, v) =>
      Variant.match(v, {
        Struct: (structName, members) =>
          interfaces.concat(
            structToInterface(
              variantPayloadTypeName(unionName, structName),
              members
            )
          ),
        Tuple: (tupleName, types) =>
          interfaces.concat(
            tupleToInterface(
              variantPayloadTypeName(unionName, tupleName),
              types
            )
          ),
        default: () => interfaces
      }),
    [] as TsFileBlock[]
  );

const unionToConstructors = (
  unionName: string,
  variants: Variant[]
): TsFileBlock[] =>
  variants.map(v => {
    const params = variantToCtorParameters(unionName, v);
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

const variantToCtorParameters = (unionName: string, v: Variant): D.Field[] =>
  Variant.match(v, {
    Struct: name => [
      { name: 'value', type: variantPayloadTypeName(unionName, name) }
    ],
    Unit: () => [],
    NewType: (_, type) => [{ name: 'value', type: typeToString(type) }],
    Tuple: (_, fields) =>
      fields.map((f, i) => ({ name: `p${i}`, type: typeToString(f) }))
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
  v: Variant
): string | undefined =>
  Variant.match(v, {
    Struct: name => variantPayloadTypeName(unionName, name),
    Tuple: name => variantPayloadTypeName(unionName, name),
    Unit: () => undefined,
    NewType: (_, type) => typeToString(type)
    // Tuple: (_, fields) => `[${fields.map(typeToString).join(', ')}]`
  });

const structToInterface = (name: string, members: StructMembers): TsFileBlock =>
  ts.Interface({
    name,
    fields: Object.keys(members).map(
      (name): D.Field => ({ name, type: typeToString(members[name]) })
    )
  });

const tupleToInterface = (name: string, fields: Type[]): TsFileBlock =>
  ts.Interface({
    name,
    fields: fields
      .map(
        (field, i): D.Field => ({
          name: i.toString(),
          type: typeToString(field)
        })
      )
      .concat({ name: 'length', type: fields.length.toString() })
  });

const tupleToConstructor = (name: string, fields: Type[]): TsFileBlock =>
  ts.ArrowFunc({
    name,
    params: fields.map(
      (f, i): D.Field => ({
        name: 'p' + i.toString(),
        type: typeToString(f)
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
    case Scalar.U8:
    case Scalar.U16:
    case Scalar.U32:
    case Scalar.USIZE:
      return 'number';
    case Scalar.Str:
      return 'string';
  }
};

export const typeToString = (type: Type): string => {
  switch (type.tag) {
    case TypeTag.Option:
      return `(${typeToString(type.value)}) | undefined`;
    case TypeTag.Scalar:
      return scalarToTypeString(type.value);
    case TypeTag.Vec:
      return `Array<${typeToString(type.value)}>`;
    case TypeTag.RefTo:
      return type.value;
  }
};

const newtypeToTypeStr = (type: Type, name: string): string =>
  `${typeToString(type)} & { type: '${name}'}`;

export const variantPayloadTypeName = (
  unionName: string,
  variantName: string
): string => unionName + '_' + variantName;
