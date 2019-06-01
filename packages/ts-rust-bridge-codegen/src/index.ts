import { EntryType, FileBlock } from './schema';
import { ast2ts } from './ts/ast2ts';
import { schema2ast } from './ts/schema2ast';

export * from './schema';

export { schema2rust } from './rust/schema2rust';
export { ast2ts } from './ts/ast2ts';
export { schema2ast } from './ts/schema2ast';
export { schema2serializers } from './tsbincode/schema2serializers';
export { schema2deserializers } from './tsbincode/schema2deserializers';

export const schema2ts = (entries: EntryType[]): FileBlock[] =>
  ast2ts(schema2ast(entries));
