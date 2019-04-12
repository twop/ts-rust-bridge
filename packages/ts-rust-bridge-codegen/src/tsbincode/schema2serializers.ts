import {
  Scalar,
  EntryType,
  EntryT,
  Type,
  TypeTag,
  VariantT,
  Variant,
  getVariantName
} from '../schema';

import { TsFileBlockT, TsFileBlock as ts } from '../ts/ast';
import { typeToString, variantPayloadTypeName } from '../ts/schema2ast';
import {
  BincodeLibTypes,
  traverseType,
  chainName,
  enumerateStructFields,
  RequiredImport,
  flatMap,
  unique,
  ReadOrWrite,
  collectRequiredImports
} from './sharedPieces';
// import { typeToString } from './schema2ast';

const WriteFuncs: ReadOrWrite = {
  [Scalar.Bool]: 'write_bool',
  [Scalar.Str]: 'write_str',
  [Scalar.F32]: 'write_f32',
  [Scalar.U8]: 'write_u8',
  [Scalar.U16]: 'write_u16',
  [Scalar.U32]: 'write_u32',
  [Scalar.USIZE]: 'write_u64',
  Opt: 'write_opt',
  Seq: 'write_seq'
};

const serializerType = (typeStr: string) =>
  `${BincodeLibTypes.SerFunc}<${typeStr}>`;
const enumMappingName = (enumName: string) => `${enumName}Map`;
const serFuncName = (typeName: string) => `write${typeName}`;

const serializerChainName = (types: Type[]): string =>
  chainName(types, WriteFuncs, serFuncName);

const serializerNameFor = (type: Type): string =>
  serializerChainName(traverseType(type));

type TypeSerializer = {
  typeChain: Type[];
  body: string;
  fromType: Type;
};

const { fromLibrary, fromTypesDeclaration } = RequiredImport;

type SerPiece = {
  requiredImports: RequiredImport[];
  typeSerializers: TypeSerializer[];
  blocks: TsFileBlockT[];
};

const entry2SerBlocks = EntryType.match({
  Enum: (name, { variants }): SerPiece => ({
    requiredImports: [
      fromTypesDeclaration(name),
      fromLibrary(WriteFuncs[Scalar.U32])
    ],
    blocks: [genEnumIndexMapping(name, variants), generateEnumSerializer(name)],
    typeSerializers: []
  }),

  Alias: (name, type): SerPiece => ({
    requiredImports: [
      fromTypesDeclaration(name),
      ...collectRequiredImports(type, WriteFuncs)
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
      ...collectRequiredImports(type, WriteFuncs)
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
      ...flatMap(types, t => collectRequiredImports(t, WriteFuncs))
    ],
    blocks: [generateTupleSerializer(name, types, true)],
    typeSerializers: flatMap(types, generateTypesSerializers)
  }),

  Struct: (name, members): SerPiece => {
    const fields = enumerateStructFields(members);

    return {
      requiredImports: [
        fromTypesDeclaration(name),
        ...flatMap(fields, f => collectRequiredImports(f.type, WriteFuncs))
      ],
      blocks: [generateStructSerializer(name, fields, true)],
      typeSerializers: flatMap(fields, f => generateTypesSerializers(f.type))
    };
  },

  Union: (unionName, variants): SerPiece => ({
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
      ts.ArrowFunc({
        name: serFuncName(unionName),
        body: genUnionSerializers(unionName, variants, 'sink'),
        returnType: BincodeLibTypes.Sink,
        params: [
          { name: 'sink', type: BincodeLibTypes.Sink },
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
        lib.concat(BincodeLibTypes.Sink, BincodeLibTypes.SerFunc),
        s => s
      ),
      from: pathToBincodeLib
    }),
    ...unique(flatMap(pieces, p => p.typeSerializers), s =>
      serializerChainName(s.typeChain)
    ).map(({ typeChain, body, fromType }) =>
      ts.ArrowFunc({
        name: serializerChainName(typeChain),
        body,
        dontExport: true,
        returnType: BincodeLibTypes.Sink,
        params: [
          { name: 'sink', type: BincodeLibTypes.Sink },
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
            type.tag === TypeTag.Option ? WriteFuncs.Opt : WriteFuncs.Seq
          }(sink, val, ${serializerChainName(traverseType(type.value))})`
        })
      );
  }
};

const generateEnumSerializer = (name: string): TsFileBlockT =>
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
): TsFileBlockT =>
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
): TsFileBlockT =>
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
