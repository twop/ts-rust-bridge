import { schema2rust, schema2ts, schema2serde } from '../src/index';
import { exampleSchema } from './simple.schema';
import { format } from 'prettier';
import * as fs from 'fs';

const tsFile = __dirname + '/generated/simple.g.ts';
const tsSerDeFile = __dirname + '/generated/simple_serde.g.ts';
const testRustFile = __dirname + '/generated/simple.g.rs';

const rustContent = `
use serde::Deserialize;

${schema2rust(exampleSchema, {
  MyEnum: { derive: ['Clone', 'Copy'] }
}).join('\n')}
`;

const tsSerDeContent = `
${schema2serde({
  schema: exampleSchema,
  typesDeclarationFile: `./simple.g`,
  pathToBincodeLib: `../../../ts-binary/src/index`
}).join('\n\n')}
`;

const prettierOptions = JSON.parse(
  fs.readFileSync(__dirname + '/../.prettierrc').toString()
);

const pretty = (content: string) =>
  format(content, {
    ...prettierOptions,
    parser: 'typescript'
  });
// const pretty = (content: string) => content;

fs.writeFileSync(testRustFile, rustContent);
fs.writeFileSync(tsFile, pretty(schema2ts(exampleSchema).join('\n\n')));
fs.writeFileSync(tsSerDeFile, pretty(tsSerDeContent));

console.log('\n\n', JSON.stringify(exampleSchema));
