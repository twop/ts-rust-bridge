import { Schema, FileBlock } from './schema';
import { ast2ts } from './ts/ast2ts';
import { schema2ast } from './ts/schema2ast';
import { schema2serializersAST } from './serde/schema2serializers';
import { schema2deserializersAST } from './serde/schema2deserializers';
import { SerDeCodeGenInput } from './serde/sharedPieces';
import { TsFileBlock, Code } from './ts/ast';

export * from './schema';

export {
  schema2rust,
  SchemaDelcarationObject,
  SchemaRustOptions,
  RustTypeOptions
} from './rust/schema2rust';

export { SerDeCodeGenInput };
export const schema2ts = (schema: Schema): FileBlock[] =>
  ast2ts(schema2ast(schema));

export const schema2serde = (input: SerDeCodeGenInput): FileBlock[] => {
  const serAst = schema2serializersAST(input);
  const deserAst = schema2deserializersAST(input);
  return ast2ts(mergeTsBlocks(serAst, deserAst));
};

const mergeTsBlocks = (
  ser: TsFileBlock[],
  deser: TsFileBlock[]
): TsFileBlock[] => {
  const { imports, rest } = [
    TsFileBlock.LineComment('Serializers'),
    ...ser,
    TsFileBlock.LineComment('Deserializers'),
    ...deser
  ].reduce<{ imports: Code.Import[]; rest: TsFileBlock[] }>(
    ({ imports, rest }, cur) =>
      TsFileBlock.match(cur, {
        Import: i => ({ imports: append(imports, i), rest }),
        default: block => ({ imports, rest: append(rest, block) })
      }),
    { imports: [], rest: [] }
  );

  return smooshImports(imports)
    .map(i => TsFileBlock.Import(i))
    .concat(rest);
};

function smooshImports(imports: Code.Import[]): Code.Import[] {
  const fromToImportNames = imports.reduce(
    (map, { from, names }) => map.set(from, append(map.get(from), ...names)),
    new Map<string, string[]>()
  );

  return Array.from(fromToImportNames.entries()).map(
    ([from, names]): Code.Import => ({
      from,
      names: Array.from(new Set(names))
    })
  );
}

function append<T>(arr: T[] = [], ...values: T[]): T[] {
  arr.push(...values);
  return arr;
}
