import { TypeTag, Type, Scalar, StructMembers } from '../schema';
import { Union, of } from 'ts-union';

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
