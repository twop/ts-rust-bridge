import {
  schema2rust,
  schema2ts,
  ast2ts,
  schema2serializers,
  schema2deserializers
} from '../src/index';
import { exampleEntries } from './basic.ast';
import { format } from 'prettier';
import * as fs from 'fs';

const tsFile = __dirname + '/generated/basic.generated.ts';
const tsSerFile = __dirname + '/generated/basic.ser.generated.ts';
const tsDeserFile = __dirname + '/generated/basic.deser.generated.ts';
const testRustFile = __dirname + '/generated/basic.generated.rs';

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
  schema2serializers({
    entries: exampleEntries,
    typesDeclarationFile: `./basic.generated`,
    pathToBincodeLib: `../../../ts-binary/src/index`
  })
).join('\n\n')}
`;

const tsDeserContent = `
${ast2ts(
  schema2deserializers({
    entries: exampleEntries,
    typesDeclarationFile: `./basic.generated`,
    pathToBincodeLib: `../../../ts-binary/src/index`
  })
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
// const pretty = (content: string) => content;

fs.writeFileSync(testRustFile, rustContent);
fs.writeFileSync(tsFile, pretty(tsContent));
fs.writeFileSync(tsSerFile, pretty(tsSerContent));
fs.writeFileSync(tsDeserFile, pretty(tsDeserContent));

console.log('\n\n', JSON.stringify(exampleEntries));
