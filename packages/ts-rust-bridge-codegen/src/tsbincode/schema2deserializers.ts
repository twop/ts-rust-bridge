import { Scalar, EntryType, Type, TypeTag, Variant } from '../schema';

import { TsFileBlock, TsFileBlock as ts } from '../ts/ast';
import { variantPayloadTypeName } from '../ts/schema2ast';
import {
  BincodeLibTypes,
  traverseType,
  chainName,
  RequiredImport,
  flatMap,
  ReadOrWrite,
  collectRequiredImports,
  enumerateStructFields,
  CodePiece,
  TypeSerDe,
  schema2tsBlocks
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
const deserFuncName = (typeName: string) => `read${typeName}`;

const deserializerChainName = (types: Type[]): string =>
  chainName(types, ReadFuncs, deserFuncName);

const deserializerNameFor = (type: Type): string =>
  deserializerChainName(traverseType(type));

const { fromLibrary, fromTypesDeclaration } = RequiredImport;

const entry2DeserBlocks = EntryType.match({
  Enum: (name, { variants }): CodePiece => ({
    name,
    requiredImports: [
      fromTypesDeclaration(name),
      fromLibrary(ReadFuncs[Scalar.U32])
    ],
    blocks: [
      genEnumIndexMapping(name, variants),
      generateEnumDeserializer(name)
    ],
    serdes: []
  }),
  // default: (): Piece => ({

  //   requiredImports: [],
  //   blocks: [],
  //   typeDeserializers: []
  // }),

  Alias: (name, type): CodePiece => ({
    name,
    requiredImports: [
      fromTypesDeclaration(name),
      ...collectRequiredImports(type, ReadFuncs)
    ],
    serdes: generateTypesDeserializers(type),
    blocks: [
      ts.ConstVar({
        name: deserFuncName(name),
        type: deserializerType(name),
        expression: deserializerNameFor(type)
      })
    ],
    dependsOn: [deserializerNameFor(type)]
  }),

  Newtype: (name, type): CodePiece => ({
    name,
    requiredImports: [
      fromTypesDeclaration(name),
      ...collectRequiredImports(type, ReadFuncs)
    ],
    serdes: generateTypesDeserializers(type),
    blocks: [
      ts.ArrowFunc({
        name: deserFuncName(name),
        returnType: name,
        body: `${name}(${deserializerNameFor(type)}(sink))`,
        params: [{ name: 'sink', type: BincodeLibTypes.Sink }]
      })
    ],
    dependsOn: [deserializerNameFor(type)]
  }),

  Tuple: (name, types): CodePiece => ({
    name,
    requiredImports: [
      fromTypesDeclaration(name),
      ...flatMap(types, t => collectRequiredImports(t, ReadFuncs))
    ],
    blocks: [
      generateTupleDeserializer(name, types, args => `${name}(${args})`, true)
    ],
    serdes: flatMap(types, generateTypesDeserializers),
    dependsOn: types.map(deserializerNameFor)
  }),

  Struct: (name, members): CodePiece => {
    const fields = enumerateStructFields(members);

    return {
      name,
      requiredImports: [
        fromTypesDeclaration(name),
        ...flatMap(fields, f => collectRequiredImports(f.type, ReadFuncs))
      ],
      blocks: [generateStructDeserializer(name, fields, true)],
      serdes: flatMap(fields, f => generateTypesDeserializers(f.type)),
      dependsOn: fields.map(f => deserializerNameFor(f.type))
    };
  },

  Union: (unionName, variants): CodePiece => ({
    // this can be potentially sharable?
    name: unionName,
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
        name: deserFuncName(unionName),
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
          default: () => [] as TsFileBlock[]
        })
      )
    ],
    serdes: flatMap(
      variants,
      Variant.match({
        Unit: () => [] as TypeSerDe[],
        NewType: (_, type) => generateTypesDeserializers(type),
        Struct: (_, members) =>
          flatMap(enumerateStructFields(members), m =>
            generateTypesDeserializers(m.type)
          ),
        Tuple: (_, types) => flatMap(types, generateTypesDeserializers)
      })
    ),
    dependsOn: flatMap(
      variants,
      Variant.match({
        Unit: () => [] as string[],
        NewType: (_, type) => [deserializerNameFor(type)],
        Struct: (_, members) =>
          enumerateStructFields(members).map(m => deserializerNameFor(m.type)),
        Tuple: (_, types) => types.map(deserializerNameFor)
      })
    )
  })
});

export const schema2deserializers = ({
  entries,
  typesDeclarationFile,
  pathToBincodeLib
}: {
  entries: EntryType[];
  typesDeclarationFile: string;
  pathToBincodeLib?: string;
}): TsFileBlock[] =>
  schema2tsBlocks({
    pieces: entries.map(entry2DeserBlocks),
    serdeName: deserFuncName,
    serdeType: deserializerType,
    serdeChainName: deserializerChainName,
    libImports: [BincodeLibTypes.Deserializer],
    pathToBincodeLib,
    typesDeclarationFile,
    readOrWrite: ReadFuncs
  });

const genEnumIndexMapping = (enumName: string, variants: string[]) =>
  ts.ConstVar({
    name: enumMappingArrayName(enumName),
    dontExport: true,
    expression: `[${variants.map(v => `${enumName}.${v}`).join(', ')}]`,
    type: `${enumName}[]`
  });

const genUnionDeserializers = (
  unionName: string,
  variants: Variant[],
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
          `${unionCtor(name)}(${deserFuncName(
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
  typeDeserializers: TypeSerDe[] = []
): TypeSerDe[] => {
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
          toOrFrom: type,
          body: `${
            type.tag === TypeTag.Option ? ReadFuncs.Opt : ReadFuncs.Seq
          }(${deserializerChainName(traverseType(type.value))})`
        })
      );
  }
};

const generateEnumDeserializer = (enumName: string): TsFileBlock =>
  ts.ArrowFunc({
    name: deserFuncName(enumName),
    returnType: enumName,
    params: [{ name: 'sink', type: BincodeLibTypes.Sink }],
    body: `${enumMappingArrayName(enumName)}[${ReadFuncs[Scalar.U32]}(sink)]`
  });

const generateStructDeserializer = (
  name: string,
  fields: { name: string; type: Type }[],
  shouldExport: boolean
): TsFileBlock =>
  ts.ArrowFunc({
    name: deserFuncName(name),
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
): TsFileBlock =>
  ts.ArrowFunc({
    name: deserFuncName(tupleName),
    returnType: tupleName,
    body: tupleCtorFunc(
      `${types.map(type => `${deserializerNameFor(type)}(sink)`).join(', ')}`
    ),
    dontExport: !shouldExport || undefined,
    params: [{ name: 'sink', type: BincodeLibTypes.Sink }]
  });
