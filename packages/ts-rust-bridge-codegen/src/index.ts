import { EntryT, FileBlock } from './schema';
import { ast2ts } from './ts/ast2ts';
import { schema2ast } from './ts/schema2ast';

export * from './schema';

export { schema2rust } from './rust/schema2rust';
export { ast2ts } from './ts/ast2ts';
export { schema2ast } from './ts/schema2ast';
export { entries2SerBlocks } from './ts/schema2serast';

export const schema2ts = (entries: EntryT[]): FileBlock[] =>
  ast2ts(schema2ast(entries));
