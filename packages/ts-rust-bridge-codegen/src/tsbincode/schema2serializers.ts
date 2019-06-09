import {
  Scalar,
  EntryType,
  Type,
  TypeTag,
  Variant,
  getVariantName
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
  schema2tsBlocks
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
  Seq: 'seq_writer'
};

const serializerType = (typeStr: string) =>
  `${BincodeLibTypes.Serializer}<${typeStr}>`;
const enumMappingName = (enumName: string) => `${enumName}Map`;
const serFuncName = (typeName: string) => `write${typeName}`;

const serializerChainName = (types: Type[]): string =>
  chainName(types, WriteFuncs, serFuncName);

const serializerNameFor = (type: Type): string =>
  serializerChainName(traverseType(type));

const { fromLibrary, fromTypesDeclaration } = RequiredImport;

const entry2SerPiece = EntryType.match({
  Enum: (name, { variants }): CodePiece => ({
    requiredImports: [
      fromTypesDeclaration(name),
      fromLibrary(WriteFuncs[Scalar.U32])
    ],
    blocks: [genEnumIndexMapping(name, variants), generateEnumSerializer(name)],
    serdes: [],
    name
  }),

  Alias: (name, type): CodePiece => ({
    requiredImports: [
      fromTypesDeclaration(name),
      ...collectRequiredImports(type, WriteFuncs)
    ],
    serdes: generateTypesSerializers(type),
    blocks: [
      ts.ConstVar({
        name: serFuncName(name),
        type: serializerType(name),
        expression: serializerNameFor(type)
      })
    ],
    dependsOn: [serializerNameFor(type)],
    name
  }),

  Newtype: (name, type): CodePiece => ({
    requiredImports: [
      fromTypesDeclaration(name),
      ...collectRequiredImports(type, WriteFuncs)
    ],
    serdes: generateTypesSerializers(type),
    blocks: [
      ts.ConstVar({
        name: serFuncName(name),
        type: serializerType(name),
        expression: serializerNameFor(type)
      })
    ],
    dependsOn: [serializerNameFor(type)],
    name
  }),

  Tuple: (name, types): CodePiece => ({
    requiredImports: [
      fromTypesDeclaration(name),
      ...flatMap(types, t => collectRequiredImports(t, WriteFuncs))
    ],
    blocks: [generateTupleSerializer(name, types, true)],
    serdes: flatMap(types, generateTypesSerializers),
    dependsOn: types.map(serializerNameFor),
    name
  }),

  Struct: (name, members): CodePiece => {
    const fields = enumerateStructFields(members);

    return {
      requiredImports: [
        fromTypesDeclaration(name),
        ...flatMap(fields, f => collectRequiredImports(f.type, WriteFuncs))
      ],
      blocks: [generateStructSerializer(name, fields, true)],
      serdes: flatMap(fields, f => generateTypesSerializers(f.type)),
      dependsOn: fields.map(f => serializerNameFor(f.type)),
      name
    };
  },

  Union: (unionName, variants): CodePiece => ({
    requiredImports: [
      fromTypesDeclaration(unionName),
      fromLibrary(WriteFuncs[Scalar.U32]),
      ...flatMap(
        variants,
        Variant.match({
          Unit: () => [] as RequiredImport[],
          NewType: (_, type) => collectRequiredImports(type, WriteFuncs),
          Struct: (variantName, members) =>
            flatMap(enumerateStructFields(members), m =>
              collectRequiredImports(m.type, WriteFuncs)
            ).concat(
              fromTypesDeclaration(
                variantPayloadTypeName(unionName, variantName)
              )
            ),
          Tuple: (variantName, types) =>
            flatMap(types, t => collectRequiredImports(t, WriteFuncs)).concat(
              fromTypesDeclaration(
                variantPayloadTypeName(unionName, variantName)
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
          default: () => [] as TsFileBlock[]
        })
      ),
      ts.ArrowFunc({
        name: serFuncName(unionName),
        body: genUnionSerializers(unionName, variants, 'sink'),
        returnType: BincodeLibTypes.Sink,
        params: [
          { name: 'sink', type: BincodeLibTypes.Sink },
          { name: 'val', type: unionName }
        ]
      })
    ],
    serdes: flatMap(
      variants,
      Variant.match({
        Unit: () => [] as TypeSerDe[],
        NewType: (_, type) => generateTypesSerializers(type),
        Struct: (_, members) =>
          flatMap(enumerateStructFields(members), m =>
            generateTypesSerializers(m.type)
          ),
        Tuple: (_, types) => flatMap(types, generateTypesSerializers)
      })
    ),
    dependsOn: flatMap(
      variants,
      Variant.match({
        Unit: () => [] as string[],
        NewType: (_, type) => [serializerNameFor(type)],
        Struct: (_, members) =>
          enumerateStructFields(members).map(m => serializerNameFor(m.type)),
        Tuple: (_, types) => types.map(serializerNameFor)
      })
    ),
    name: unionName
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
  entries: EntryType[];
  typesDeclarationFile: string;
  pathToBincodeLib?: string;
}): TsFileBlock[] =>
  schema2tsBlocks({
    pieces: entries.map(entry2SerPiece),
    serdeChainName: serializerChainName,
    serdeType: serializerType,
    serdeName: serFuncName,
    libImports: [BincodeLibTypes.Serializer],
    pathToBincodeLib,
    typesDeclarationFile,
    readOrWrite: WriteFuncs
  });

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
  sinkArg: string
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

const generateTypesSerializers = (
  type: Type,
  descriptions: TypeSerDe[] = []
): TypeSerDe[] => {
  switch (type.tag) {
    case TypeTag.Scalar:
    case TypeTag.RefTo:
      // skip ref and scalars
      return descriptions;

    case TypeTag.Vec:
    case TypeTag.Option:
      return generateTypesSerializers(type.value, [
        {
          typeChain: traverseType(type),
          toOrFrom: type,
          body: `${
            type.tag === TypeTag.Option ? WriteFuncs.Opt : WriteFuncs.Seq
          }(${serializerChainName(traverseType(type.value))})`
        },
        ...descriptions
      ]);
  }
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
  shouldExport: boolean
): TsFileBlock =>
  ts.ArrowFunc({
    name: serFuncName(name),
    returnType: BincodeLibTypes.Sink,
    body: composeTypeSerializers(fields, 'sink'),
    dontExport: !shouldExport || undefined,
    params: [
      { name: 'sink', type: BincodeLibTypes.Sink },
      { name: `{${fields.map(f => f.name).join(', ')}}`, type: name }
    ]
  });

const generateTupleSerializer = (
  tupleName: string,
  types: Type[],
  shouldExport: boolean
): TsFileBlock =>
  ts.ArrowFunc({
    name: serFuncName(tupleName),
    returnType: BincodeLibTypes.Sink,
    body: composeTypeSerializers(
      types.map((type, i) => ({ type, name: `val[${i}]` })),
      'sink'
    ),
    dontExport: !shouldExport || undefined,
    params: [
      { name: 'sink', type: BincodeLibTypes.Sink },
      { name: 'val', type: tupleName }
    ]
  });
