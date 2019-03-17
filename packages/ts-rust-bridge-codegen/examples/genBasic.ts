import { schema2rust, schema2ts } from '../src/index';
import { exampleEntries } from './basic.ast';
import { format } from 'prettier';
import * as fs from 'fs';

const tsFile = __dirname + '/basic.gen.ts';
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

const prettierOptions = JSON.parse(
  fs.readFileSync(__dirname + '/../.prettierrc').toString()
);

const prettyTsContent = format(tsContent, {
  ...prettierOptions,
  parser: 'typescript'
});

fs.writeFileSync(testRustFile, rustContent);
fs.writeFileSync(tsFile, prettyTsContent);

console.log('\n\n', JSON.stringify(exampleEntries));
