import { schema2ts, schema2serde, schema2rust } from '../src/index';

import { format } from 'prettier';
import * as fs from 'fs';

import { Type } from '../src/schema';

const {
  Alias,
  Enum,
  Tuple,
  Struct,
  Union,
  Newtype,
  Option,
  Nullable,
  Vec,
  Str,
  U32,
  Bool,
  U8,
  F32
} = Type;

const Size = Enum('S', 'M', 'L');
const Shirt = Struct({ size: Size, color: Str, price: F32 });

const MyTuple = Tuple(Nullable(Bool), Vec(Str));

const JustAStruct = Struct({
  u8: U8,
  myTuple: MyTuple
});

const SimpleUnion = Union({
  Unit: null,
  Float32: F32,
  BoolAndU32: [Option(Bool), U32],
  StructVariant: { id: Str, tuple: MyTuple }
});

const MyEnum = Enum('One', 'Two', 'Three');
const NewTypeU32 = Newtype(U32);
const AliasToStr = Alias(Str);

const typesToCodegen = {
  MyEnum,
  NewTypeU32,
  AliasToStr,
  SimpleUnion,
  JustAStruct,
  MyTuple
};

const tsFile = __dirname + '/generated/types.g.ts';
const tsSerFile = __dirname + '/generated/types.serde.g.ts';

const tsSerDeContent = `
  ${schema2serde({
    schema: typesToCodegen,
    typesDeclarationFile: `./types.g`,
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

fs.writeFileSync(tsFile, pretty(schema2ts(typesToCodegen).join('\n\n')));
fs.writeFileSync('types.ts', pretty(schema2ts({ Shirt, Size }).join('\n')));
fs.writeFileSync(tsSerFile, pretty(tsSerDeContent));
fs.writeFileSync('types.rs', schema2rust({ Shirt, Size }).join('\n'));

console.log('\n\n', JSON.stringify(typesToCodegen));
