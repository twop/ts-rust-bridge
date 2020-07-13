import {
  Scalar,
  SchemaElement,
  Type,
  TypeTag,
  Variant,
  LookupName,
  matchSchemaElement,
  createLookupName
} from '../schema';

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
  schema2tsBlocks,
  SerDeCodeGenInput
} from './sharedPieces';

const ReadFuncs: ReadOrWrite = {
  [Scalar.Bool]: 'read_bool',
  [Scalar.Str]: 'read_str',
  [Scalar.F32]: 'read_f32',
  [Scalar.F64]: 'read_f64',
  [Scalar.I32]: 'read_i32',
  [Scalar.U8]: 'read_u8',
  [Scalar.U16]: 'read_u16',
  [Scalar.U32]: 'read_u32',
  [Scalar.USIZE]: 'read_u64',
  Opt: 'opt_reader',
  Seq: 'seq_reader',
  Nullable: 'nullable_reader'
};

const deserializerType = (typeStr: string) =>
  `${BincodeLibTypes.Deserializer}<${typeStr}>`;
const enumMappingArrayName = (enumName: string) => `${enumName}ReverseMap`;
const deserFuncName = (typeName: string) => `read${typeName}`;

const deserializerChainName = (types: Type[], lookup: LookupName): string =>
  chainName(types, ReadFuncs, deserFuncName, lookup);

const deserializerNameFor = (type: Type, lookup: LookupName): string =>
  deserializerChainName(traverseType(type), lookup);

const { fromLibrary, fromTypesDeclaration } = RequiredImport;

const entry2DeserBlocks = (
  name: string,
  entry: SchemaElement,
  lookup: LookupName
) =>
  matchSchemaElement(entry, {
    Enum: ({ variants }): CodePiece => ({
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

    Alias: (type): CodePiece => ({
      name,
      requiredImports: [
        fromTypesDeclaration(name),
        ...collectRequiredImports(type, ReadFuncs, lookup)
      ],
      serdes: generateTypesDeserializers(type, lookup),
      blocks: [
        ts.ConstVar({
          name: deserFuncName(name),
          type: deserializerType(name),
          expression: deserializerNameFor(type, lookup)
        })
      ],
      dependsOn: [deserializerNameFor(type, lookup)]
    }),

    Newtype: (type): CodePiece => ({
      name,
      requiredImports: [
        fromTypesDeclaration(name),
        ...collectRequiredImports(type, ReadFuncs, lookup)
      ],
      serdes: generateTypesDeserializers(type, lookup),
      blocks: [
        ts.ArrowFunc({
          name: deserFuncName(name),
          returnType: name,
          body: `${name}(${deserializerNameFor(type, lookup)}(sink))`,
          params: [{ name: 'sink', type: BincodeLibTypes.Sink }]
        })
      ],
      dependsOn: [deserializerNameFor(type, lookup)]
    }),

    Tuple: (types): CodePiece => ({
      name,
      requiredImports: [
        fromTypesDeclaration(name),
        ...flatMap(types, t => collectRequiredImports(t, ReadFuncs, lookup))
      ],
      blocks: [
        generateTupleDeserializer(
          name,
          types,
          args => `${name}(${args})`,
          true,
          lookup
        )
      ],
      serdes: flatMap(types, t => generateTypesDeserializers(t, lookup)),
      dependsOn: types.map(t => deserializerNameFor(t, lookup))
    }),

    Struct: (members): CodePiece => {
      const fields = enumerateStructFields(members);

      return {
        name,
        requiredImports: [
          fromTypesDeclaration(name),
          ...flatMap(fields, f =>
            collectRequiredImports(f.type, ReadFuncs, lookup)
          )
        ],
        blocks: [generateStructDeserializer(name, fields, true, lookup)],
        serdes: flatMap(fields, f =>
          generateTypesDeserializers(f.type, lookup)
        ),
        dependsOn: fields.map(f => deserializerNameFor(f.type, lookup))
      };
    },

    Union: (variants): CodePiece => ({
      // this can be potentially sharable?
      name: name,
      requiredImports: [
        fromTypesDeclaration(name),
        fromLibrary(ReadFuncs[Scalar.U32]),
        ...flatMap(
          variants,
          Variant.match({
            Unit: () => [] as RequiredImport[],
            NewType: (_, type) =>
              collectRequiredImports(type, ReadFuncs, lookup),
            Struct: (variantName, members) =>
              flatMap(enumerateStructFields(members), m =>
                collectRequiredImports(m.type, ReadFuncs, lookup)
              ).concat(
                fromTypesDeclaration(variantPayloadTypeName(name, variantName))
              ),
            Tuple: (_, types) =>
              flatMap(types, t => collectRequiredImports(t, ReadFuncs, lookup))
          })
        )
      ],
      blocks: [
        ts.ArrowFunc({
          name: deserFuncName(name),
          body: genUnionDeserializers(name, variants, 'sink', lookup),
          returnType: name,
          params: [{ name: 'sink', type: BincodeLibTypes.Sink }]
        }),
        ...flatMap(
          variants,
          Variant.match({
            Struct: (variantName, members) => [
              generateStructDeserializer(
                variantPayloadTypeName(name, variantName),
                enumerateStructFields(members),
                false,
                lookup
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
          NewType: (_, type) => generateTypesDeserializers(type, lookup),
          Struct: (_, members) =>
            flatMap(enumerateStructFields(members), m =>
              generateTypesDeserializers(m.type, lookup)
            ),
          Tuple: (_, types) =>
            flatMap(types, t => generateTypesDeserializers(t, lookup))
        })
      ),
      dependsOn: flatMap(
        variants,
        Variant.match({
          Unit: () => [] as string[],
          NewType: (_, type) => [deserializerNameFor(type, lookup)],
          Struct: (_, members) =>
            enumerateStructFields(members).map(m =>
              deserializerNameFor(m.type, lookup)
            ),
          Tuple: (_, types) => types.map(t => deserializerNameFor(t, lookup))
        })
      )
    })
  });

export const schema2deserializersAST = ({
  schema,
  typesDeclarationFile,
  pathToBincodeLib
}: SerDeCodeGenInput): TsFileBlock[] => {
  const lookup = createLookupName(schema);
  return schema2tsBlocks({
    pieces: Object.entries(schema).map(([name, element]) =>
      entry2DeserBlocks(name, element, lookup)
    ),
    serdeName: deserFuncName,
    serdeType: deserializerType,
    serdeChainName: types => deserializerChainName(types, lookup),
    lookup,
    libImports: [BincodeLibTypes.Deserializer],
    pathToBincodeLib,
    typesDeclarationFile,
    readOrWrite: ReadFuncs
  });
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
  variants: Variant[],
  sinkArg: string,
  lookup: LookupName
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
          `${unionCtor(name)}(${deserializerNameFor(
            type,
            lookup
          )}(${sinkArg}))`,
        Tuple: (name, types) =>
          `${unionCtor(name)}(${types
            .map(type => `${deserializerNameFor(type, lookup)}(${sinkArg})`)
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
  lookup: LookupName,
  typeDeserializers: TypeSerDe[] = []
): TypeSerDe[] => {
  switch (type.tag) {
    case TypeTag.Scalar:
      // skip scalars
      return typeDeserializers;

    case TypeTag.Vec:
    case TypeTag.Nullable:
    case TypeTag.Option:
      return generateTypesDeserializers(
        type.value,
        lookup,
        typeDeserializers.concat({
          typeChain: traverseType(type),
          toOrFrom: type,
          body: `${
            type.tag === TypeTag.Option
              ? ReadFuncs.Opt
              : type.tag === TypeTag.Nullable
              ? ReadFuncs.Nullable
              : ReadFuncs.Seq
          }(${deserializerChainName(traverseType(type.value), lookup)})`
        })
      );
  }
  // skip direct references
  return typeDeserializers;
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
  shouldExport: boolean,
  lookup: LookupName
): TsFileBlock =>
  ts.ArrowFunc({
    name: deserFuncName(name),
    wrappedInBraces: true,
    returnType: name,
    dontExport: !shouldExport || undefined,
    params: [{ name: 'sink', type: BincodeLibTypes.Sink }],
    body: `${fields
      .map(
        f => `const ${f.name} = ${deserializerNameFor(f.type, lookup)}(sink);`
      )
      .join('\n')}
    return {${fields.map(f => f.name).join(', ')}};
    `
  });

const generateTupleDeserializer = (
  tupleName: string,
  types: Type[],
  tupleCtorFunc: (argsStr: string) => string,
  shouldExport: boolean,
  lookup: LookupName
): TsFileBlock =>
  ts.ArrowFunc({
    name: deserFuncName(tupleName),
    returnType: tupleName,
    body: tupleCtorFunc(
      `${types
        .map(type => `${deserializerNameFor(type, lookup)}(sink)`)
        .join(', ')}`
    ),
    dontExport: !shouldExport || undefined,
    params: [{ name: 'sink', type: BincodeLibTypes.Sink }]
  });
