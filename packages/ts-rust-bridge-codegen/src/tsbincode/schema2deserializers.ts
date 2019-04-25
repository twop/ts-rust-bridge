import {
  Scalar,
  EntryType,
  EntryT,
  Type,
  TypeTag,
  VariantT,
  Variant
} from '../schema';

import { TsFileBlockT, TsFileBlock as ts } from '../ts/ast';
import { typeToString, variantPayloadTypeName } from '../ts/schema2ast';
import {
  BincodeLibTypes,
  traverseType,
  chainName,
  RequiredImport,
  flatMap,
  unique,
  ReadOrWrite,
  collectRequiredImports,
  enumerateStructFields
} from './sharedPieces';

const ReadFuncs: ReadOrWrite = {
  [Scalar.Bool]: 'read_bool',
  [Scalar.Str]: 'read_str',
  [Scalar.F32]: 'read_f32',
  [Scalar.U8]: 'read_u8',
  [Scalar.U16]: 'read_u16',
  [Scalar.U32]: 'read_u32',
  [Scalar.USIZE]: 'read_u64',
  Opt: 'read_opt',
  Seq: 'read_seq'
};

const deserializerType = (typeStr: string) =>
  `${BincodeLibTypes.Deserializer}<${typeStr}>`;
const enumMappingArrayName = (enumName: string) => `${enumName}ReverseMap`;
const deserializerName = (typeName: string) => `read${typeName}`;

const deserializerChainName = (types: Type[]): string =>
  chainName(types, ReadFuncs, deserializerName);

const deserializerNameFor = (type: Type): string =>
  deserializerChainName(traverseType(type));

type TypeDeserializer = {
  typeChain: Type[];
  body: string;
  toType: Type;
};

const { fromLibrary, fromTypesDeclaration } = RequiredImport;

type Piece = {
  requiredImports: RequiredImport[];
  typeDeserializers: TypeDeserializer[];
  blocks: TsFileBlockT[];
};

const entry2DeserBlocks = EntryType.match({
  Enum: (name, { variants }): Piece => ({
    requiredImports: [
      fromTypesDeclaration(name),
      fromLibrary(ReadFuncs[Scalar.U32])
    ],
    blocks: [
      genEnumIndexMapping(name, variants),
      generateEnumDeserializer(name)
    ],
    typeDeserializers: []
  }),
  default: (): Piece => ({
    requiredImports: [],
    blocks: [],
    typeDeserializers: []
  }),

  Alias: (name, type): Piece => ({
    requiredImports: [
      fromTypesDeclaration(name),
      ...collectRequiredImports(type, ReadFuncs)
    ],
    typeDeserializers: generateTypesDeserializers(type),
    blocks: [
      ts.ConstVar({
        name: deserializerName(name),
        type: deserializerType(name),
        expression: deserializerNameFor(type)
      })
    ]
  }),

  Newtype: (name, type): Piece => ({
    requiredImports: [
      fromTypesDeclaration(name),
      ...collectRequiredImports(type, ReadFuncs)
    ],
    typeDeserializers: generateTypesDeserializers(type),
    blocks: [
      ts.ArrowFunc({
        name: deserializerName(name),
        returnType: name,
        body: `${name}(${deserializerNameFor(type)}(sink))`,
        params: [{ name: 'sink', type: BincodeLibTypes.Sink }]
      })
    ]
  }),

  Tuple: (name, types): Piece => ({
    requiredImports: [
      fromTypesDeclaration(name),
      ...flatMap(types, t => collectRequiredImports(t, ReadFuncs))
    ],
    blocks: [
      generateTupleDeserializer(name, types, args => `${name}(${args})`, true)
    ],
    typeDeserializers: flatMap(types, generateTypesDeserializers)
  }),

  Struct: (name, members): Piece => {
    const fields = enumerateStructFields(members);

    return {
      requiredImports: [
        fromTypesDeclaration(name),
        ...flatMap(fields, f => collectRequiredImports(f.type, ReadFuncs))
      ],
      blocks: [generateStructDeserializer(name, fields, true)],
      typeDeserializers: flatMap(fields, f =>
        generateTypesDeserializers(f.type)
      )
    };
  },

  Union: (unionName, variants): Piece => ({
    // this can be potentially sharable?
    requiredImports: [
      fromTypesDeclaration(unionName),
      fromLibrary(ReadFuncs[Scalar.U32]),
      ...flatMap(
        variants,
        Variant.match({
          Unit: () => [] as RequiredImport[],
          NewType: (_, type) => collectRequiredImports(type, ReadFuncs),
          Struct: (variantName, members) =>
            flatMap(enumerateStructFields(members), m =>
              collectRequiredImports(m.type, ReadFuncs)
            ).concat(
              fromTypesDeclaration(
                variantPayloadTypeName(unionName, variantName)
              )
            ),
          Tuple: (_, types) =>
            flatMap(types, t => collectRequiredImports(t, ReadFuncs))
        })
      )
    ],
    blocks: [
      ts.ArrowFunc({
        name: deserializerName(unionName),
        body: genUnionDeserializers(unionName, variants, 'sink'),
        returnType: unionName,
        params: [{ name: 'sink', type: BincodeLibTypes.Sink }]
      }),
      ...flatMap(
        variants,
        Variant.match({
          Struct: (variantName, members) => [
            generateStructDeserializer(
              variantPayloadTypeName(unionName, variantName),
              enumerateStructFields(members),
              false
            )
          ],
          default: () => [] as TsFileBlockT[]
        })
      )
    ],
    typeDeserializers: flatMap(
      variants,
      Variant.match({
        Unit: () => [] as TypeDeserializer[],
        NewType: (_, type) => generateTypesDeserializers(type),
        Struct: (_, members) =>
          flatMap(enumerateStructFields(members), m =>
            generateTypesDeserializers(m.type)
          ),
        Tuple: (_, types) => flatMap(types, generateTypesDeserializers)
      })
    )
  })
});

export const schema2deserializers = ({
  entries,
  typesDeclarationFile,
  pathToBincodeLib = 'ts-binary'
}: {
  entries: EntryT[];
  typesDeclarationFile: string;
  pathToBincodeLib?: string;
}): TsFileBlockT[] => {
  const pieces = entries.map(entry2DeserBlocks);

  // TODO cleanup
  const { lib, decl } = flatMap(pieces, p => p.requiredImports).reduce(
    ({ lib, decl }, imp) =>
      RequiredImport.match(imp, {
        fromTypesDeclaration: s => ({ lib, decl: decl.concat(s) }),
        fromLibrary: s => ({ lib: lib.concat(s), decl })
      }),
    { lib: [] as string[], decl: [] as string[] }
  );

  return [
    ts.Import({ names: unique(decl, s => s), from: typesDeclarationFile }),
    ts.Import({
      names: unique(
        lib.concat(BincodeLibTypes.Sink, BincodeLibTypes.Deserializer),
        s => s
      ),
      from: pathToBincodeLib
    }),
    ...unique(flatMap(pieces, p => p.typeDeserializers), s =>
      deserializerChainName(s.typeChain)
    ).map(({ typeChain, body, toType: fromType }) =>
      ts.ArrowFunc({
        name: deserializerChainName(typeChain),
        body,
        dontExport: true,
        returnType: typeToString(fromType),
        params: [{ name: 'sink', type: BincodeLibTypes.Sink }]
      })
    ),
    ...flatMap(pieces, p => p.blocks)
  ];
};

const genEnumIndexMapping = (enumName: string, variants: string[]) =>
  ts.ConstVar({
    name: enumMappingArrayName(enumName),
    dontExport: true,
    expression: `[${variants.map(v => `${enumName}.${v}`).join(', ')}]`,
    type: `${enumName}[]`
  });

const genUnionDeserializers = (
  unionName: string,
  variants: VariantT[],
  sinkArg: string
) => {
  const unionCtor = (variantName: string) => `${unionName}.${variantName}`;
  return `{
  switch (${ReadFuncs[Scalar.U32]}(${sinkArg})) {
  ${variants
    .map(v => ({
      exp: Variant.match(v, {
        Unit: unionCtor,
        Struct: name =>
          `${unionCtor(name)}(${deserializerName(
            variantPayloadTypeName(unionName, name)
          )}(${sinkArg}))`,
        NewType: (name, type) =>
          `${unionCtor(name)}(${deserializerNameFor(type)}(${sinkArg}))`,
        Tuple: (name, types) =>
          `${unionCtor(name)}(${types
            .map(type => `${deserializerNameFor(type)}(${sinkArg})`)
            .join(', ')})`
      })
    }))
    .map(({ exp }, i) => `case ${i}: return ${exp};`)
    .join('\n')}
  };
  throw new Error("bad variant index for ${unionName}");
 }`;
};

const generateTypesDeserializers = (
  type: Type,
  typeDeserializers: TypeDeserializer[] = []
): TypeDeserializer[] => {
  switch (type.tag) {
    case TypeTag.Scalar:
    case TypeTag.RefTo:
      // skip ref and scalars
      return typeDeserializers;

    case TypeTag.Vec:
    case TypeTag.Option:
      return generateTypesDeserializers(
        type.value,
        typeDeserializers.concat({
          typeChain: traverseType(type),
          toType: type,
          body: `${
            type.tag === TypeTag.Option ? ReadFuncs.Opt : ReadFuncs.Seq
          }(sink, ${deserializerChainName(traverseType(type.value))})`
        })
      );
  }
};

const generateEnumDeserializer = (enumName: string): TsFileBlockT =>
  ts.ArrowFunc({
    name: deserializerName(enumName),
    returnType: enumName,
    params: [{ name: 'sink', type: BincodeLibTypes.Sink }],
    body: `${enumMappingArrayName(enumName)}[${ReadFuncs[Scalar.U32]}(sink)]`
  });

const generateStructDeserializer = (
  name: string,
  fields: { name: string; type: Type }[],
  shouldExport: boolean
): TsFileBlockT =>
  ts.ArrowFunc({
    name: deserializerName(name),
    wrappedInBraces: true,
    returnType: name,
    dontExport: !shouldExport || undefined,
    params: [{ name: 'sink', type: BincodeLibTypes.Sink }],
    body: `${fields
      .map(f => `const ${f.name} = ${deserializerNameFor(f.type)}(sink);`)
      .join('\n')}
    return {${fields.map(f => f.name).join(', ')}};
    `
  });

const generateTupleDeserializer = (
  tupleName: string,
  types: Type[],
  tupleCtorFunc: (argsStr: string) => string,
  shouldExport: boolean
): TsFileBlockT =>
  ts.ArrowFunc({
    name: deserializerName(tupleName),
    returnType: tupleName,
    body: tupleCtorFunc(
      `${types.map(type => `${deserializerNameFor(type)}(sink)`).join(', ')}`
    ),
    dontExport: !shouldExport || undefined,
    params: [{ name: 'sink', type: BincodeLibTypes.Sink }]
  });
