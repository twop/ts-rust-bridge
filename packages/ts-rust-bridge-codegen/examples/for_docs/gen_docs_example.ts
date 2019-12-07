import { schema2ts, schema2rust, schema2serde, Type } from '../../src/index';
import * as fs from 'fs';

const { Enum, Struct, Str, F32 } = Type;

const Size = Enum('S', 'M', 'L');
const Shirt = Struct({ size: Size, color: Str, price: F32 });
const schema = { Size, Shirt };

const tsCode = schema2ts(schema).join('\n\n');

const rustCode = `
use serde::{Deserialize, Serialize};

${schema2rust(schema).join('\n')}
`;

const tsSerDeCode = `
${schema2serde({
  schema: schema,
  typesDeclarationFile: `./schema`
}).join('\n\n')}
`;

// save to disc
fs.writeFileSync('schema.ts', tsCode);
fs.writeFileSync('schema.rs', rustCode);
fs.writeFileSync('schema_serde.ts', tsSerDeCode);
