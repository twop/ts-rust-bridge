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

import { TsFileBlockT, TsFileBlock as ts } from './ast';
import { Union, of } from 'ts-union';
import { typeToString, variantName } from './schema2ast';
// import { typeToString } from './schema2ast';

enum Ser {
  // sink: Sink,
  // val: T | undefined,
  // serEl: SerFunc<T>
  Opt = 'write_opt',

  // sink: Sink, seq: T[], serEl: SerFunc<T>
  Seq = 'write_seq',

  // f.32
  Scalar = 'write_scalar'
}

const enum Types {
  Sink = 'Sink',
  SerFunc = 'SerFunc'
}

const serializerType = (typeStr: string) => `${Types.SerFunc}<${typeStr}>`;
const enumMappingName = (enumName: string) => `${enumName}Map`;
const serFuncName = (typeName: string) => `serialize${typeName}`;

const serializerChainName = (types: Type[]): string => {
  if (types.length === 1) {
    const type = types[0];

    switch (type.tag) {
      case TypeTag.Scalar:
        return `${Ser.Scalar}.${type.value}`;

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
    requiredImports: [fromTypesDeclaration(name), fromLibrary(Ser.Scalar)],
    blocks: [genEnumIndexMapping(name, variants), genEnumSerialization(name)],
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

  Tuple: (name, types): SerPiece => ({
    requiredImports: [
      fromTypesDeclaration(name),
      ...flatMap(types, collectRequiredImports)
    ],
    blocks: [
      ts.ArrowFunc({
        name: serFuncName(name),
        returnType: Types.Sink,
        body: composeTypeSerializers(
          types.map((type, i) => ({ type, name: `val[${i}]` })),
          'sink'
        ),
        params: [
          { name: 'sink', type: Types.Sink },
          { name: 'val', type: name }
        ]
      })
    ],
    typeSerializers: flatMap(types, generateTypesSerializers)
  }),

  Struct: (name, members): SerPiece => {
    const fields = Object.keys(members).map(name => ({
      name,
      type: members[name]
    }));

    return {
      requiredImports: [
        fromTypesDeclaration(name),
        ...flatMap(fields, f => collectRequiredImports(f.type))
      ],
      blocks: [
        ts.ArrowFunc({
          name: serFuncName(name),
          returnType: Types.Sink,
          body: composeTypeSerializers(fields, 'sink'),
          params: [
            { name: 'sink', type: Types.Sink },
            { name: `{${fields.map(f => f.name).join(', ')}}`, type: name }
          ]
        })
      ],
      typeSerializers: flatMap(fields, f => generateTypesSerializers(f.type))
    };
  },
  Union: (name, variants) => ({
    requiredImports: [fromTypesDeclaration(name), fromLibrary(Ser.Scalar)],
    blocks: [
      genEnumIndexMapping(name, variants.map(variantName)),
      ts.ConstVar({
        name: `${name}Serializers`,
        expression: genUnionSerializers(name, variants)
      })
      // genEnumSerialization(name)
    ],
    typeSerializers: []
  }),
  default: () => ({ blocks: [], requiredImports: [], typeSerializers: [] })
  // Newtype: (name, type) => [
  //   newtypeToTypeAlias(name, type),
  //   Module(name, [newtypeToConstructor(name, type)])
  // ]
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

export const entries2SerBlocks = (
  entries: EntryT[],
  typesDeclarationFile: string,
  serLib: string
): TsFileBlockT[] => {
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
      from: serLib
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

const unique = <T, U>(arr: T[], key: (el: T) => U): T[] =>
  arr.reduce(
    ({ res, set }, el) =>
      set.has(key(el))
        ? { res, set }
        : { res: res.concat(el), set: set.add(key(el)) },
    { res: [] as T[], set: new Set<U>() }
  ).res;

const genEnumIndexMapping = (enumName: string, variants: string[]) =>
  ts.ConstVar({
    name: enumMappingName(enumName),
    expression: `{${variants.map((v, i) => ` ${v}: ${i}`).join(',\n')}}`,
    type: '{[key: string]:number}'
  });

const genUnionSerializers = (
  unionName: string,
  variants: VariantT[],
  sinkArg: string
) =>
  `{
  const s = ${Ser.Scalar}.${Scalar.U32}(${sinkArg}, ${enumMappingName(
    unionName
  )}[val.tag])
  
  ${variants.map(
    v => `
  if (val.tag === "${getVariantName(v)}") {
    return ${Variant.match({
      Unit: name => `${name}: (${sinkArg}: ${Types.Sink}) => ${sinkArg}`,
      Struct: name => `${name}: (${sinkArg}: ${Types.Sink}) => ${sinkArg}`,
      default: () => ''
    })}
  }
  `
  )}
 }`;

// const genAliasSerialization = (aliasName: string, type: Type): TsFileBlockT[] =>
//   generateTypesSerializers(type)
//     .map(({ body, serType, typeChain }) =>
//       ts.ArrowFunc({
//         name: serializerChainName(typeChain),
//         params: [
//           { name: 'sink', type: Types.Sink },
//           { name: 'val', type: typeToString(serType) }
//         ],
//         dontExport: true,
//         returnType: Types.Sink,
//         body
//       })
//     )
//     .concat(
//       ts.ConstVar({
//         name: serFuncName(aliasName),
//         expression: serializerChainName(traverseType(type))
//       })
//     ); // ts.ArrowFunc({
//   name: serFuncName(aliasName),
//   params: [
//     { name: 'sink', type: Types.Sink },
//     { name: 'val', type: aliasName }
//   ],
//   returnType: Types.Sink,
//   body:
//     genTypeSerializationBody(type, 'sink', 'val') +
//     '\n' +
//     '//' +
//     enumerateType(type)
// });

// `
// Option<bool>
// write_opt(sink, val, write_scalar.BOOL)
// `;

// `

// const Bla = Alias('Aha', T.Vec(T.Option(T.Vec(T.Scalar.Str))));

// export type Aha = Array<(Array<string>) | undefined>;

// export const serializeAha = (sink: Sink, val: Aha): Sink =>
//   write_seq(sink, val, (s, v) =>
//     write_opt(s, v, (s, v) => write_seq(s, v, write_scalar.Str))
//   );
// `;
const collectRequiredImports = (
  type: Type,
  imports: typeof Import.T[] = []
): typeof Import.T[] => {
  switch (type.tag) {
    case TypeTag.Scalar:
      return imports.concat(fromLibrary(Ser.Scalar));
    case TypeTag.RefTo:
      return imports.concat(fromTypesDeclaration(type.value));
    case TypeTag.Vec:
      return imports.concat(
        fromLibrary(Ser.Seq),
        ...collectRequiredImports(type.value)
      );
    case TypeTag.Option:
      return imports.concat(
        fromLibrary(Ser.Opt),
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
            type.tag === TypeTag.Option ? Ser.Opt : Ser.Seq
          }(sink, val, ${serializerChainName(traverseType(type.value))})`
        })
      );
  }
};

// const genTypeSerializationBody = (
//   type: Type,
//   sinkArg: string,
//   valArg: string
// ): string => {
//   switch (type.tag) {
//     case TypeTag.Scalar:
//       return `${Ser.Scalar}.${type.value}(${sinkArg}, ${valArg})`;
//     case TypeTag.Option:
//       return `${Ser.Opt}(${sinkArg}, ${valArg}, ${genTypeSerFunction(
//         type.value
//       )})`;
//     case TypeTag.RefTo:
//       return `${serFuncName(type.value)}(${sinkArg}, ${valArg})`;
//     case TypeTag.Vec:
//       return `${Ser.Seq}(${sinkArg}, ${valArg}, ${genTypeSerFunction(
//         type.value
//       )})`;
//   }
// };

// const genTypeSerFunction = (type: Type): string => {
//   switch (type.tag) {
//     case TypeTag.Scalar:
//       return `${Ser.Scalar}.${type.value}`;
//     case TypeTag.RefTo:
//       return serFuncName(type.value);
//     case TypeTag.Option:
//     case TypeTag.Vec:
//       // return `(s:${Types.Sink}, v:${typeToString(
//       return `(s, v)=>${genTypeSerializationBody(type, `s`, `v`)}`;
//   }
// };

const genEnumSerialization = (name: string) =>
  ts.ArrowFunc({
    name: serFuncName(name),
    returnType: Types.Sink,
    params: [{ name: 'sink', type: Types.Sink }, { name: 'val', type: name }],
    body: `${Ser.Scalar}.${Scalar.U32}(sink, ${enumMappingName(name)}[val])`
  });

const flatMap = <T, U>(a: T[], f: (t: T) => U[]): U[] =>
  a.reduce((s, el) => s.concat(f(el)), [] as U[]);

// type Type = { tag: 'n'; value: number } | { tag: 's'; value: string };

// const Funcs = {
//   n: (n: number) => n.toString(),
//   s: (s: string) => s
// };

// const test = ({ tag, value }: Type) => {
//   if (tag === 'n') {
//     Funcs[tag](value);
//   }

//   const a = Funcs[tag](value as any);
// };
