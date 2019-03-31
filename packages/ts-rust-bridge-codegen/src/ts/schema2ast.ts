import {
  StructMembers,
  Scalar,
  Type,
  EntryT,
  EntryType,
  TypeTag,
  Variant,
  VariantT,
  getVariantName
} from '../schema';

import { TsFileBlockT, TsFileBlock as ts, D } from './ast';

export type Module = {
  type: 'ts-file-module';
  name: string;
  blocks: TsFileBlockT[];
};

const Module = (name: string, blocks: TsFileBlockT[]): Module => ({
  name,
  blocks,
  type: 'ts-file-module'
});

export const isModule = (block: Module | TsFileBlockT): block is Module =>
  (block as Module).type === 'ts-file-module';

const entryToBlocks = EntryType.match({
  Alias: (name, type): (TsFileBlockT | Module)[] => [aliasToAlias(name, type)],
  Struct: (name, members) => [structToInterface(name, members)],
  Enum: (name, { variants }) => [enumToStringEnum(name, variants)],
  Union: (name, variants) => [
    unionToTaggedUnion(name, variants),
    ...unionToPayloadInterfaces(name, variants),
    Module(name, unionToConstructors(name, variants))
  ],
  Tuple: (name, fields) => [
    tupleToInterface(name, fields),
    Module(name, [tupleToConstructor(name, fields)])
  ],
  Newtype: (name, type) => [
    newtypeToTypeAlias(name, type),
    Module(name, [newtypeToConstructor(name, type)])
  ]
});

export const schema2ast = (entries: EntryT[]) =>
  entries.reduce((blocks, entry) => blocks.concat(entryToBlocks(entry)), [] as (
    | TsFileBlockT
    | Module)[]);

const aliasToAlias = (name: string, type: Type): TsFileBlockT =>
  ts.Alias({ name, toType: typeToString(type) });

const enumToStringEnum = (name: string, variants: string[]): TsFileBlockT =>
  ts.StringEnum({
    name,
    variants: variants.map((v): [string, string] => [v, v])
  });

const unionToTaggedUnion = (name: string, variants: VariantT[]): TsFileBlockT =>
  ts.Union({
    name,
    tagField: 'tag',
    valueField: 'value',
    variants: variants.map(v => ({
      tag: getVariantName(v),
      valueType: variantPayloadType(name, v)
    }))
  });

const newtypeToTypeAlias = (name: string, type: Type): TsFileBlockT =>
  ts.Alias({
    name,
    toType: newtypeToTypeStr(type, name)
  });

const newtypeToConstructor = (name: string, type: Type): TsFileBlockT =>
  ts.ArrowFunc({
    name: 'mk',
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
  variants: VariantT[]
): TsFileBlockT[] =>
  variants.reduce(
    (interfaces, v) =>
      Variant.match(v, {
        Struct: (structName, members) =>
          interfaces.concat(structToInterface(variantStructName(unionName, structName), members)),
        Tuple: (tupleName, types) =>
          interfaces.concat(structToInterface(variantStructName(unionName, structName), members)),
        default: () => interfaces
      }),
    [] as TsFileBlockT[]
  );

const unionToConstructors = (
  unionName: string,
  variants: VariantT[]
): TsFileBlockT[] =>
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

const variantToCtorParameters = (unionName: string, v: VariantT): D.Field[] =>
  Variant.match(v, {
    Struct: name => [
      { name: 'value', type: variantInterfaceName(unionName, name) }
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

const variantPayloadType = (unionName: string, v: VariantT): string | undefined =>
  Variant.match(v, {
    Struct: name => variantInterfaceName(unionName, name),
    Unit: () => undefined,
    NewType: (_, type) => typeToString(type),
    Tuple: (_, fields) => `[${fields.map(typeToString).join(', ')}]`
  });

const variantInterfaceName = (unionName: string, variantName: string) =>
  `${unionName + variantName}`;

const structToInterface = (
  name: string,
  members: StructMembers
): TsFileBlockT =>
  ts.Interface({
    name,
    fields: Object.keys(members).map(
      (name): D.Field => ({ name, type: typeToString(members[name]) })
    )
  });

const tupleToInterface = (name: string, fields: Type[]): TsFileBlockT =>
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

const tupleToConstructor = (name: string, fields: Type[]): TsFileBlockT =>
  ts.ArrowFunc({
    name: 'mk',
    params: fields.map(
      (f, i): D.Field => ({
        name: 'p' + i.toString(),
        type: typeToString(f)
      })
    ),
    body: `[${fields.map((_, i) => 'p' + i.toString()).join(', ')}]`,
    returnType: name
  });

const scalarToString = (scalar: Scalar): string => {
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
      return scalarToString(type.value);
    case TypeTag.Vec:
      return `Array<${typeToString(type.value)}>`;
    case TypeTag.RefTo:
      return type.value;
  }
};

const newtypeToTypeStr = (type: Type, name: string): string =>
  `${typeToString(type)} & { type: '${name}'}`;

export const variantStructName = (unionName: string, structName: string): string => unionName + structName;

