import {
  Scalar,
  EntryType,
  EntryT,
  Type,
  TypeTag,
  VariantT,
  Variant,
  getVariantName,
  StructMembers
} from '../schema';

import { TsFileBlockT, TsFileBlock as ts } from './ast';
import { Union, of } from 'ts-union';
import { typeToString, variantPayloadTypeName } from './schema2ast';
// import { typeToString } from './schema2ast';

enum Write {
  // sink: Sink,
  // val: T | undefined,
  // serEl: SerFunc<T>
  Opt = 'write_opt',

  // sink: Sink, seq: T[], serEl: SerFunc<T>
  Seq = 'write_seq'
}

const WriteScalar: { [K in Scalar]: string } = {
  [Scalar.Bool]: 'write_bool',
  [Scalar.Str]: 'write_str',
  [Scalar.F32]: 'write_f32',
  [Scalar.U8]: 'write_u8',
  [Scalar.U16]: 'write_u16',
  [Scalar.U32]: 'write_u32',
  [Scalar.USIZE]: 'write_u64'
};

const enum Types {
  Sink = 'Sink',
  SerFunc = 'SerFunc'
}

const serializerType = (typeStr: string) => `${Types.SerFunc}<${typeStr}>`;
const enumMappingName = (enumName: string) => `${enumName}Map`;
const serFuncName = (typeName: string) => `write${typeName}`;

const serializerChainName = (types: Type[]): string => {
  if (types.length === 1) {
    const type = types[0];

    switch (type.tag) {
      case TypeTag.Scalar:
        return WriteScalar[type.value];

      case TypeTag.RefTo:
        return `${serFuncName(type.value)}`;

      default:
        throw new Error('incomplete chain');
    }
  }

  return serFuncName(types.map(nameTopLevelTypeOnly).join(''));
};

const serializerNameFor = (type: Type): string =>
  serializerChainName(traverseType(type));

type TypeSerializer = {
  typeChain: Type[];
  body: string;
  fromType: Type;
};

const Import = Union({
  fromLibrary: of<string>(),
  fromTypesDeclaration: of<string>()
});

const { fromLibrary, fromTypesDeclaration } = Import;

type SerPiece = {
  requiredImports: typeof Import.T[];
  typeSerializers: TypeSerializer[];
  blocks: TsFileBlockT[];
};

const entry2SerBlocks = EntryType.match({
  Enum: (name, { variants }): SerPiece => ({
    requiredImports: [
      fromTypesDeclaration(name),
      fromLibrary(WriteScalar[Scalar.U32])
    ],
    blocks: [genEnumIndexMapping(name, variants), generateEnumSerializer(name)],
    typeSerializers: []
  }),

  Alias: (name, type): SerPiece => ({
    requiredImports: [
      fromTypesDeclaration(name),
      ...collectRequiredImports(type)
    ],
    typeSerializers: generateTypesSerializers(type),
    blocks: [
      ts.ConstVar({
        name: serFuncName(name),
        type: serializerType(name),
        expression: serializerNameFor(type)
      })
    ]
  }),

  Newtype: (name, type): SerPiece => ({
    requiredImports: [
      fromTypesDeclaration(name),
      ...collectRequiredImports(type)
    ],
    typeSerializers: generateTypesSerializers(type),
    blocks: [
      ts.ConstVar({
        name: serFuncName(name),
        type: serializerType(name),
        expression: serializerNameFor(type)
      })
    ]
  }),

  Tuple: (name, types): SerPiece => ({
    requiredImports: [
      fromTypesDeclaration(name),
      ...flatMap(types, collectRequiredImports)
    ],
    blocks: [generateTupleSerializer(name, types, true)],
    typeSerializers: flatMap(types, generateTypesSerializers)
  }),

  Struct: (name, members): SerPiece => {
    const fields = enumerateStructFields(members);

    return {
      requiredImports: [
        fromTypesDeclaration(name),
        ...flatMap(fields, f => collectRequiredImports(f.type))
      ],
      blocks: [generateStructSerializer(name, fields, true)],
      typeSerializers: flatMap(fields, f => generateTypesSerializers(f.type))
    };
  },

  Union: (unionName, variants): SerPiece => ({
    requiredImports: [
      fromTypesDeclaration(unionName),
      fromLibrary(WriteScalar[Scalar.U32]),
      ...flatMap(
        variants,
        Variant.match({
          Unit: () => [] as typeof Import.T[],
          NewType: (_, type) => collectRequiredImports(type),
          Struct: (variantName, members) =>
            flatMap(enumerateStructFields(members), m =>
              collectRequiredImports(m.type)
            ).concat(
              fromTypesDeclaration(
                variantPayloadTypeName(unionName, variantName)
              )
            ),
          Tuple: (variantName, types) =>
            flatMap(types, collectRequiredImports).concat(
              fromTypesDeclaration(
                variantPayloadTypeName(unionName, variantName)
              )
            )
        })
      )
    ],
    blocks: [
      // genEnumIndexMapping(unionName, variants.map(getVariantName)),
      ts.ArrowFunc({
        name: serFuncName(unionName),
        body: genUnionSerializers(unionName, variants, 'sink'),
        returnType: Types.Sink,
        params: [
          { name: 'sink', type: Types.Sink },
          { name: 'val', type: unionName }
        ]
      }),
      ...flatMap(
        variants,
        Variant.match({
          Tuple: (variantName, types) => [
            generateTupleSerializer(
              variantPayloadTypeName(unionName, variantName),
              types,
              false
            )
          ],
          Struct: (variantName, members) => [
            generateStructSerializer(
              variantPayloadTypeName(unionName, variantName),
              enumerateStructFields(members),
              false
            )
          ],
          default: () => [] as TsFileBlockT[]
        })
      )
    ],
    typeSerializers: flatMap(
      variants,
      Variant.match({
        Unit: () => [] as TypeSerializer[],
        NewType: (_, type) => generateTypesSerializers(type),
        Struct: (_, members) =>
          flatMap(enumerateStructFields(members), m =>
            generateTypesSerializers(m.type)
          ),
        Tuple: (_, types) => flatMap(types, generateTypesSerializers)
      })
    )
  })
});

// aka write_u32(write_u32(sink, 0), val)
const composeTypeSerializers = (
  params: { name: string; type: Type }[],
  sinkArg: string
): string => {
  if (params.length === 0) {
    return sinkArg;
  }

  const [{ name, type }, ...rest] = params;

  return composeTypeSerializers(
    rest,
    `${serializerNameFor(type)}(${sinkArg}, ${name})`
  );
};

export const schema2serializers = ({
  entries,
  typesDeclarationFile,
  pathToBincodeLib
}: {
  entries: EntryT[];
  typesDeclarationFile: string;
  pathToBincodeLib: string;
}): TsFileBlockT[] => {
  const pieces = entries.map(entry2SerBlocks);

  // TODO cleanup
  const { lib, decl } = flatMap(pieces, p => p.requiredImports).reduce(
    ({ lib, decl }, imp) =>
      Import.match(imp, {
        fromTypesDeclaration: s => ({ lib, decl: decl.concat(s) }),
        fromLibrary: s => ({ lib: lib.concat(s), decl })
      }),
    { lib: [] as string[], decl: [] as string[] }
  );

  return [
    ts.Import({ names: unique(decl, s => s), from: typesDeclarationFile }),
    ts.Import({
      names: unique(lib.concat(Types.Sink, Types.SerFunc), s => s),
      from: pathToBincodeLib
    }),
    ...unique(flatMap(pieces, p => p.typeSerializers), s =>
      serializerChainName(s.typeChain)
    ).map(({ typeChain, body, fromType }) =>
      ts.ArrowFunc({
        name: serializerChainName(typeChain),
        body,
        dontExport: true,
        returnType: Types.Sink,
        params: [
          { name: 'sink', type: Types.Sink },
          { name: 'val', type: typeToString(fromType) }
        ]
      })
    ),
    ...flatMap(pieces, p => p.blocks)
  ];
};

const genEnumIndexMapping = (enumName: string, variants: string[]) =>
  ts.ConstVar({
    name: enumMappingName(enumName),
    dontExport: true,
    expression: `{${variants.map((v, i) => ` ${v}: ${i}`).join(',\n')}}`,
    type: '{[key: string]:number}'
  });

const genUnionSerializers = (
  unionName: string,
  variants: VariantT[],
  sinkArg: string
) =>
  `{
  switch (val.tag) {
  ${variants
    .map(v => ({
      v,
      tag: getVariantName(v),
      sink: `${WriteScalar[Scalar.Str]}(${sinkArg}, "${getVariantName(v)}")`
    }))
    // .map((v, i) => ({
    //   v,
    //   tag: getVariantName(v),
    //   sink: `${WriteScalar[Scalar.U32]}(${sinkArg}, ${i})`
    // }))
    .map(({ v, tag, sink }) => ({
      exp: Variant.match(v, {
        Unit: () => sink,
        Struct: name =>
          `${serFuncName(
            variantPayloadTypeName(unionName, name)
          )}(${sink}, val.value)`,
        NewType: (_, type) => `${serializerNameFor(type)}(${sink}, val.value)`,
        Tuple: name =>
          `${serFuncName(
            variantPayloadTypeName(unionName, name)
          )}(${sink}, val.value)`
      }),
      tag
    }))
    .map(({ tag, exp }) => `case "${tag}": return ${exp};`)
    .join('\n')}
  };
 }`;

const collectRequiredImports = (
  type: Type,
  imports: typeof Import.T[] = []
): typeof Import.T[] => {
  switch (type.tag) {
    case TypeTag.Scalar:
      return imports.concat(fromLibrary(WriteScalar[type.value]));
    case TypeTag.RefTo:
      return imports.concat(fromTypesDeclaration(type.value));
    case TypeTag.Vec:
      return imports.concat(
        fromLibrary(Write.Seq),
        ...collectRequiredImports(type.value)
      );
    case TypeTag.Option:
      return imports.concat(
        fromLibrary(Write.Opt),
        ...collectRequiredImports(type.value)
      );
  }
};

const traverseType = (type: Type, parts: Type[] = []): Type[] => {
  switch (type.tag) {
    case TypeTag.Scalar:
      return parts.concat(type);
    case TypeTag.RefTo:
      return parts.concat(type);
    case TypeTag.Vec:
      return traverseType(type.value, parts.concat(type));
    case TypeTag.Option:
      return traverseType(type.value, parts.concat(type));
  }
};

const nameTopLevelTypeOnly = (type: Type): string => {
  switch (type.tag) {
    case TypeTag.Scalar:
    case TypeTag.RefTo:
      return type.value;
    case TypeTag.Vec:
      return 'Vec';
    case TypeTag.Option:
      return 'Opt';
  }
};

const generateTypesSerializers = (
  type: Type,
  descriptions: TypeSerializer[] = []
): TypeSerializer[] => {
  switch (type.tag) {
    case TypeTag.Scalar:
    case TypeTag.RefTo:
      // skip ref and scalars
      return descriptions;

    case TypeTag.Vec:
    case TypeTag.Option:
      return generateTypesSerializers(
        type.value,
        descriptions.concat({
          typeChain: traverseType(type),
          fromType: type,
          body: `${
            type.tag === TypeTag.Option ? Write.Opt : Write.Seq
          }(sink, val, ${serializerChainName(traverseType(type.value))})`
        })
      );
  }
};

const generateEnumSerializer = (name: string): TsFileBlockT =>
  ts.ArrowFunc({
    name: serFuncName(name),
    returnType: Types.Sink,
    params: [{ name: 'sink', type: Types.Sink }, { name: 'val', type: name }],
    body: `${WriteScalar[Scalar.U32]}(sink, ${enumMappingName(name)}[val])`
  });

const generateStructSerializer = (
  name: string,
  fields: { name: string; type: Type }[],
  shouldExport: boolean
): TsFileBlockT =>
  ts.ArrowFunc({
    name: serFuncName(name),
    returnType: Types.Sink,
    body: composeTypeSerializers(fields, 'sink'),
    dontExport: !shouldExport || undefined,
    params: [
      { name: 'sink', type: Types.Sink },
      { name: `{${fields.map(f => f.name).join(', ')}}`, type: name }
    ]
  });

const enumerateStructFields = (members: StructMembers) =>
  Object.keys(members).map(name => ({
    name,
    type: members[name]
  }));

const generateTupleSerializer = (
  tupleName: string,
  types: Type[],
  shouldExport: boolean
): TsFileBlockT =>
  ts.ArrowFunc({
    name: serFuncName(tupleName),
    returnType: Types.Sink,
    body: composeTypeSerializers(
      types.map((type, i) => ({ type, name: `val[${i}]` })),
      'sink'
    ),
    dontExport: !shouldExport || undefined,
    params: [
      { name: 'sink', type: Types.Sink },
      { name: 'val', type: tupleName }
    ]
  });

const unique = <T, U>(arr: T[], key: (el: T) => U): T[] =>
  arr.reduce(
    ({ res, set }, el) =>
      set.has(key(el))
        ? { res, set }
        : { res: res.concat(el), set: set.add(key(el)) },
    { res: [] as T[], set: new Set<U>() }
  ).res;

const flatMap = <T, U>(a: T[], f: (t: T) => U[]): U[] =>
  a.reduce((s, el) => s.concat(f(el)), [] as U[]);
