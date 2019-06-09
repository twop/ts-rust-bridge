import { TypeTag, Type, Scalar, StructMembers } from '../schema';
import { Union, of } from 'ts-union';
import { TsFileBlock, TsFileBlock as ts } from '../ts/ast';
import { findOrder } from './topologicalSort';
import { typeToString } from '../ts/schema2ast';

export const enum BincodeLibTypes {
  Sink = 'Sink',
  Deserializer = 'Deserializer',
  Serializer = 'Serializer'
}

export const traverseType = (type: Type, parts: Type[] = []): Type[] => {
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

const nameOfTopLevelTypeOnly = (type: Type): string => {
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

export type ReadOrWrite = { [K in Scalar]: string } & {
  Seq: string;
  Opt: string;
};

export const chainName = (
  types: Type[],
  readOrWrite: ReadOrWrite,
  makeFuncName: (typeName: string) => string
): string => {
  if (types.length === 1) {
    const type = types[0];

    switch (type.tag) {
      case TypeTag.Scalar:
        return readOrWrite[type.value];

      case TypeTag.RefTo:
        return `${makeFuncName(type.value)}`;

      default:
        throw new Error('incomplete chain');
    }
  }

  return makeFuncName(types.map(nameOfTopLevelTypeOnly).join(''));
};

export const enumerateStructFields = (members: StructMembers) =>
  Object.keys(members).map(name => ({
    name,
    type: members[name]
  }));

export const RequiredImport = Union({
  fromLibrary: of<string>(),
  fromTypesDeclaration: of<string>()
});

export type RequiredImport = typeof RequiredImport.T;

export const unique = <T, U>(arr: T[], key: (el: T) => U): T[] =>
  arr.reduce(
    ({ res, set }, el) =>
      set.has(key(el))
        ? { res, set }
        : { res: res.concat(el), set: set.add(key(el)) },
    { res: [] as T[], set: new Set<U>() }
  ).res;

export const flatMap = <T, U>(a: T[], f: (t: T) => U[]): U[] =>
  a.reduce((s, el) => s.concat(f(el)), [] as U[]);

const { fromLibrary, fromTypesDeclaration } = RequiredImport;

export const collectRequiredImports = (
  type: Type,
  readOrWrite: ReadOrWrite,
  imports: RequiredImport[] = []
): RequiredImport[] => {
  switch (type.tag) {
    case TypeTag.Scalar:
      return imports.concat(fromLibrary(readOrWrite[type.value]));
    case TypeTag.RefTo:
      return imports.concat(fromTypesDeclaration(type.value));
    case TypeTag.Vec:
      return imports.concat(
        fromLibrary(readOrWrite.Seq),
        ...collectRequiredImports(type.value, readOrWrite)
      );
    case TypeTag.Option:
      return imports.concat(
        fromLibrary(readOrWrite.Opt),
        ...collectRequiredImports(type.value, readOrWrite)
      );
  }
};

export type TypeSerDe = {
  typeChain: Type[];
  body: string;
  toOrFrom: Type;
};

export type CodePiece = {
  requiredImports: RequiredImport[];
  serdes: TypeSerDe[];
  blocks: TsFileBlock[];
  dependsOn?: string[];
  name: string;
};

type PieceToSort = {
  dependsOn: string[];
  blocks: TsFileBlock[];
  id: string;
};

const sortPiecesByDependencies = (
  pieces: PieceToSort[],
  readOrWrite: ReadOrWrite
): PieceToSort[] => {
  const allFuncNames = pieces.map(p => p.id);

  const primitive = new Set(Object.values(readOrWrite));

  // console.log({ primitiveSerializers });

  const dependencyEdges = flatMap(pieces, p =>
    p.dependsOn
      .filter(dep => !primitive.has(dep))
      .map((dep): [string, string] => [p.id, dep])
  );

  const sorted = findOrder(allFuncNames, dependencyEdges);

  console.log({ sorted });

  return sorted.map(i => pieces.find(p => p.id === i)!);
};

export const schema2tsBlocks = ({
  serdeName,
  serdeType,
  serdeChainName,
  readOrWrite,
  pieces,
  typesDeclarationFile,
  libImports,
  pathToBincodeLib = 'ts-binary'
}: {
  serdeName: (_: string) => string;
  serdeType: (_: string) => string;
  serdeChainName: (_: Type[]) => string;
  readOrWrite: ReadOrWrite;
  pieces: CodePiece[];
  typesDeclarationFile: string;
  pathToBincodeLib?: string;
  libImports: string[];
}): TsFileBlock[] => {
  // const pieces = entries.map(entry2SerPiece);

  // TODO cleanup
  const { lib, decl } = flatMap(pieces, p => p.requiredImports).reduce(
    ({ lib, decl }, imp) =>
      RequiredImport.match(imp, {
        fromTypesDeclaration: s => ({ lib, decl: decl.concat(s) }),
        fromLibrary: s => ({ lib: lib.concat(s), decl })
      }),
    { lib: [] as string[], decl: [] as string[] }
  );

  const typeSerdesToSort: PieceToSort[] = unique(
    flatMap(pieces, p => p.serdes),
    s => serdeChainName(s.typeChain)
  ).map(({ typeChain, body, toOrFrom: fromType }) => {
    const name = serdeChainName(typeChain);
    const sourceTypeAsString = typeToString(fromType);

    const dependsOnTypes = typeChain.slice(1);
    const dependsOn =
      dependsOnTypes.length > 0 ? [serdeChainName(dependsOnTypes)] : [];

    return {
      id: name,
      dependsOn,

      blocks: [
        ts.ConstVar({
          name,
          expression: `${body}`,
          dontExport: true,
          type: serdeType(sourceTypeAsString)
        })
      ]
    };
  });

  const codePiecesToSort: PieceToSort[] = pieces.map(
    ({ blocks, dependsOn = [], name }): PieceToSort => ({
      blocks,
      dependsOn,
      id: serdeName(name)
    })
  );

  // console.log(
  //   'typeSerializersToSort',
  //   // JSON.stringify(
  //   typeSerializersToSort.map(({ dependsOn, id }) => ({ id, dependsOn }))
  //   // )
  // );
  // console.log(
  //   'piecesToSort',
  //   piecesToSort.map(({ dependsOn, id }) => ({ id, dependsOn }))
  // );
  // // console.log(JSON.stringify(piecesToSort));

  return [
    ts.Import({ names: unique(decl, s => s), from: typesDeclarationFile }),
    ts.Import({
      names: unique(
        lib.concat(BincodeLibTypes.Sink).concat(libImports),
        s => s
      ),
      from: pathToBincodeLib
    }),

    ...flatMap(
      sortPiecesByDependencies(
        typeSerdesToSort.concat(codePiecesToSort),
        readOrWrite
      ),
      p => p.blocks
    )
  ];
};
