import {
  schema2rust,
  schema2ts,
  ast2ts,
  entries2SerBlocks
} from '../src/index';
import { exampleEntries } from './basic.ast';
import { format } from 'prettier';
import * as fs from 'fs';

const tsFile = __dirname + '/basic.gen.ts';
const tsSerFile = __dirname + '/basic.ser.gen.ts';
const testRustFile = __dirname + '/basic.gen.rs';
// fs.unlinkSync(testFile)

const rustContent = `
use bincode;
use serde::Deserialize;

${schema2rust(exampleEntries).join('\n')}
`;

const tsContent = `
${schema2ts(exampleEntries).join('\n\n')}
`;

const tsSerContent = `
${ast2ts(
  entries2SerBlocks(exampleEntries, `./basic.gen`, `../src/ser/ser`)
).join('\n\n')}
`;

const prettierOptions = JSON.parse(
  fs.readFileSync(__dirname + '/../.prettierrc').toString()
);

const pretty = (content: string) =>
  format(content, {
    ...prettierOptions,
    parser: 'typescript'
  });

fs.writeFileSync(testRustFile, rustContent);
fs.writeFileSync(tsFile, pretty(tsContent));
fs.writeFileSync(tsSerFile, pretty(tsSerContent));

console.log('\n\n', JSON.stringify(exampleEntries));
