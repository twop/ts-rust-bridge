import {
  Scalar,
  SchemaElement,
  matchSchemaElement,
  Type,
  TypeTag,
  Variant,
  getVariantName,
  LookupName,
  createLookupName
} from '../schema';

import { TsFileBlock, TsFileBlock as ts } from '../ts/ast';
import { variantPayloadTypeName } from '../ts/schema2ast';
import {
  BincodeLibTypes,
  traverseType,
  chainName,
  enumerateStructFields,
  RequiredImport,
  flatMap,
  ReadOrWrite,
  collectRequiredImports,
  TypeSerDe,
  CodePiece,
  schema2tsBlocks,
  SerDeCodeGenInput
} from './sharedPieces';
// import { typeToString } from './schema2ast';

const WriteFuncs: ReadOrWrite = {
  [Scalar.Bool]: 'write_bool',
  [Scalar.Str]: 'write_str',
  [Scalar.F32]: 'write_f32',
  [Scalar.F64]: 'write_f64',
  [Scalar.U8]: 'write_u8',
  [Scalar.U16]: 'write_u16',
  [Scalar.U32]: 'write_u32',
  [Scalar.USIZE]: 'write_u64',
  [Scalar.I32]: 'write_i32',
  Opt: 'opt_writer',
  Seq: 'seq_writer',
  Nullable: 'nullable_writer'
};

const serializerType = (typeStr: string) =>
  `${BincodeLibTypes.Serializer}<${typeStr}>`;
const enumMappingName = (enumName: string) => `${enumName}Map`;
const serFuncName = (typeName: string) => `write${typeName}`;

const serializerChainName = (types: Type[], lookup: LookupName): string =>
  chainName(types, WriteFuncs, serFuncName, lookup);

const serializerNameFor = (type: Type, lookup: LookupName): string =>
  serializerChainName(traverseType(type), lookup);

const { fromLibrary, fromTypesDeclaration } = RequiredImport;

const entry2SerPiece = (
  entryName: string,
  entry: SchemaElement,
  lookup: LookupName
): CodePiece =>
  matchSchemaElement(entry, {
    Enum: ({ variants }): CodePiece => ({
      requiredImports: [
        fromTypesDeclaration(entryName),
        fromLibrary(WriteFuncs[Scalar.U32])
      ],
      blocks: [
        genEnumIndexMapping(entryName, variants),
        generateEnumSerializer(entryName)
      ],
      serdes: [],
      name: entryName
    }),

    Alias: (type): CodePiece => ({
      requiredImports: [
        fromTypesDeclaration(entryName),
        ...collectRequiredImports(type, WriteFuncs, lookup)
      ],
      serdes: generateTypesSerializers(type, lookup),
      blocks: [
        ts.ConstVar({
          name: serFuncName(entryName),
          type: serializerType(entryName),
          expression: serializerNameFor(type, lookup)
        })
      ],
      dependsOn: [serializerNameFor(type, lookup)],
      name: entryName
    }),

    Newtype: (type): CodePiece => ({
      requiredImports: [
        fromTypesDeclaration(entryName),
        ...collectRequiredImports(type, WriteFuncs, lookup)
      ],
      serdes: generateTypesSerializers(type, lookup),
      blocks: [
        ts.ConstVar({
          name: serFuncName(entryName),
          type: serializerType(entryName),
          expression: serializerNameFor(type, lookup)
        })
      ],
      dependsOn: [serializerNameFor(type, lookup)],
      name: entryName
    }),

    Tuple: (types): CodePiece => ({
      requiredImports: [
        fromTypesDeclaration(entryName),
        ...flatMap(types, t => collectRequiredImports(t, WriteFuncs, lookup))
      ],
      blocks: [generateTupleSerializer(entryName, types, true, lookup)],
      serdes: flatMap(types, t => generateTypesSerializers(t, lookup)),
      dependsOn: types.map(t => serializerNameFor(t, lookup)),
      name: entryName
    }),

    Struct: (members): CodePiece => {
      const fields = enumerateStructFields(members);

      return {
        requiredImports: [
          fromTypesDeclaration(entryName),
          ...flatMap(fields, f =>
            collectRequiredImports(f.type, WriteFuncs, lookup)
          )
        ],
        blocks: [generateStructSerializer(entryName, fields, true, lookup)],
        serdes: flatMap(fields, f => generateTypesSerializers(f.type, lookup)),
        dependsOn: fields.map(f => serializerNameFor(f.type, lookup)),
        name: entryName
      };
    },

    Union: (variants): CodePiece => ({
      requiredImports: [
        fromTypesDeclaration(entryName),
        fromLibrary(WriteFuncs[Scalar.U32]),
        ...flatMap(
          variants,
          Variant.match({
            Unit: () => [] as RequiredImport[],
            NewType: (_, type) =>
              collectRequiredImports(type, WriteFuncs, lookup),
            Struct: (variantName, members) =>
              flatMap(enumerateStructFields(members), m =>
                collectRequiredImports(m.type, WriteFuncs, lookup)
              ).concat(
                fromTypesDeclaration(
                  variantPayloadTypeName(entryName, variantName)
                )
              ),
            Tuple: (variantName, types) =>
              flatMap(types, t =>
                collectRequiredImports(t, WriteFuncs, lookup)
              ).concat(
                fromTypesDeclaration(
                  variantPayloadTypeName(entryName, variantName)
                )
              )
          })
        )
      ],
      blocks: [
        // genEnumIndexMapping(unionName, variants.map(getVariantName)),
        ...flatMap(
          variants,
          Variant.match({
            Tuple: (variantName, types) => [
              generateTupleSerializer(
                variantPayloadTypeName(entryName, variantName),
                types,
                false,
                lookup
              )
            ],
            Struct: (variantName, members) => [
              generateStructSerializer(
                variantPayloadTypeName(entryName, variantName),
                enumerateStructFields(members),
                false,
                lookup
              )
            ],
            default: () => [] as TsFileBlock[]
          })
        ),
        ts.ArrowFunc({
          name: serFuncName(entryName),
          body: genUnionSerializers(entryName, variants, 'sink', lookup),
          returnType: BincodeLibTypes.Sink,
          params: [
            { name: 'sink', type: BincodeLibTypes.Sink },
            { name: 'val', type: entryName }
          ]
        })
      ],
      serdes: flatMap(
        variants,
        Variant.match({
          Unit: () => [] as TypeSerDe[],
          NewType: (_, type) => generateTypesSerializers(type, lookup),
          Struct: (_, members) =>
            flatMap(enumerateStructFields(members), m =>
              generateTypesSerializers(m.type, lookup)
            ),
          Tuple: (_, types) =>
            flatMap(types, t => generateTypesSerializers(t, lookup))
        })
      ),
      dependsOn: flatMap(
        variants,
        Variant.match({
          Unit: () => [] as string[],
          NewType: (_, type) => [serializerNameFor(type, lookup)],
          Struct: (_, members) =>
            enumerateStructFields(members).map(m =>
              serializerNameFor(m.type, lookup)
            ),
          Tuple: (_, types) => types.map(t => serializerNameFor(t, lookup))
        })
      ),
      name: entryName
    })
  });

// aka write_u32(write_u32(sink, 0), val)
const composeTypeSerializers = (
  params: { name: string; type: Type }[],
  sinkArg: string,
  lookup: LookupName
): string => {
  if (params.length === 0) {
    return sinkArg;
  }

  const [{ name, type }, ...rest] = params;

  return composeTypeSerializers(
    rest,
    `${serializerNameFor(type, lookup)}(${sinkArg}, ${name})`,
    lookup
  );
};

export const schema2serializersAST = ({
  schema,
  typesDeclarationFile,
  pathToBincodeLib
}: SerDeCodeGenInput): TsFileBlock[] => {
  const lookup = createLookupName(schema);
  return schema2tsBlocks({
    pieces: Object.entries(schema).map(([name, element]) =>
      entry2SerPiece(name, element, lookup)
    ),
    serdeChainName: types => serializerChainName(types, lookup),
    lookup,
    serdeType: serializerType,
    serdeName: serFuncName,
    libImports: [BincodeLibTypes.Serializer],
    pathToBincodeLib,
    typesDeclarationFile,
    readOrWrite: WriteFuncs
  });
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
  variants: Variant[],
  sinkArg: string,
  lookup: LookupName
) =>
  `{
  switch (val.tag) {
  ${variants
    // .map(v => ({
    //   v,
    //   tag: getVariantName(v),
    //   sink: `${WriteScalar[Scalar.Str]}(${sinkArg}, "${getVariantName(v)}")`
    // }))
    .map((v, i) => ({
      v,
      tag: getVariantName(v),
      sink: `${WriteFuncs[Scalar.U32]}(${sinkArg}, ${i})`
    }))
    .map(({ v, tag, sink }) => ({
      exp: Variant.match(v, {
        Unit: () => sink,
        Struct: name =>
          `${serFuncName(
            variantPayloadTypeName(unionName, name)
          )}(${sink}, val.value)`,
        NewType: (_, type) =>
          `${serializerNameFor(type, lookup)}(${sink}, val.value)`,
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

const generateTypesSerializers = (
  type: Type,
  lookup: LookupName,
  descriptions: TypeSerDe[] = []
): TypeSerDe[] => {
  switch (type.tag) {
    case TypeTag.Scalar:
      // skip scalars
      return descriptions;

    case TypeTag.Vec:
    case TypeTag.Nullable:
    case TypeTag.Option:
      return generateTypesSerializers(type.value, lookup, [
        {
          typeChain: traverseType(type),
          toOrFrom: type,
          body: `${
            type.tag === TypeTag.Option
              ? WriteFuncs.Opt
              : type.tag === TypeTag.Nullable
              ? WriteFuncs.Nullable
              : WriteFuncs.Seq
          }(${serializerChainName(traverseType(type.value), lookup)})`
        },
        ...descriptions
      ]);
  }
  // skip direct type reference
  return descriptions;
};

const generateEnumSerializer = (name: string): TsFileBlock =>
  ts.ArrowFunc({
    name: serFuncName(name),
    returnType: BincodeLibTypes.Sink,
    params: [
      { name: 'sink', type: BincodeLibTypes.Sink },
      { name: 'val', type: name }
    ],
    body: `${WriteFuncs[Scalar.U32]}(sink, ${enumMappingName(name)}[val])`
  });

const generateStructSerializer = (
  name: string,
  fields: { name: string; type: Type }[],
  shouldExport: boolean,
  lookup: LookupName
): TsFileBlock =>
  ts.ArrowFunc({
    name: serFuncName(name),
    returnType: BincodeLibTypes.Sink,
    body: composeTypeSerializers(fields, 'sink', lookup),
    dontExport: !shouldExport || undefined,
    params: [
      { name: 'sink', type: BincodeLibTypes.Sink },
      { name: `{${fields.map(f => f.name).join(', ')}}`, type: name }
    ]
  });

const generateTupleSerializer = (
  tupleName: string,
  types: Type[],
  shouldExport: boolean,
  lookup: LookupName
): TsFileBlock =>
  ts.ArrowFunc({
    name: serFuncName(tupleName),
    returnType: BincodeLibTypes.Sink,
    body: composeTypeSerializers(
      types.map((type, i) => ({ type, name: `val[${i}]` })),
      'sink',
      lookup
    ),
    dontExport: !shouldExport || undefined,
    params: [
      { name: 'sink', type: BincodeLibTypes.Sink },
      { name: 'val', type: tupleName }
    ]
  });
