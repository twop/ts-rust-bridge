import {
  schema2ts,
  ast2ts,
  schema2serializers,
  schema2deserializers
} from '../src/index';

import { format } from 'prettier';
import * as fs from 'fs';

import { EntryType, T, Variant as V } from '../src/schema';

const { Alias, Enum, Tuple, Struct, Union, Newtype } = EntryType;

const MyTuple = Tuple('Tuple', [T.Option(T.Scalar.Bool), T.Vec(T.Scalar.Str)]);

const JustAStruct = Struct('JustAStruct', {
  u8: T.Scalar.U8,
  myTuple: T.RefTo(MyTuple)
});

const SimpleUnion = Union(
  'SimpleUnion',
  [
    V.Unit('Unit'),
    V.NewType('Float32', T.Scalar.F32),
    V.Tuple('BoolAndU32', [T.Option(T.Scalar.Bool), T.Scalar.U32]),
    V.Struct('StructVariant', { id: T.Scalar.Str, tuple: T.RefTo(MyTuple) })
  ],
  { tagAnnotation: false }
);

const testTypes: EntryType[] = [
  MyTuple,
  SimpleUnion,
  JustAStruct,
  Enum('MyEnum', { variants: ['One', 'Two', 'Three'] }),
  Newtype('NewTypeU32', T.Scalar.U32),
  Alias('AliasToStr', T.Scalar.Str)
];

const tsFile = __dirname + '/generated/types.ts';
const tsSerFile = __dirname + '/generated/serializers.ts';
const tsDeserFile = __dirname + '/generated/deserializers.ts';

const tsContent = `
  ${schema2ts(testTypes).join('\n\n')}
  `;

const tsSerContent = `
  ${ast2ts(
    schema2serializers({
      entries: testTypes,
      typesDeclarationFile: `./types`,
      pathToBincodeLib: `../../../ts-binary/src/index`
    })
  ).join('\n\n')}
  `;

const tsDeserContent = `
  ${ast2ts(
    schema2deserializers({
      entries: testTypes,
      typesDeclarationFile: `./types`,
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

fs.writeFileSync(tsFile, pretty(tsContent));
fs.writeFileSync(tsSerFile, pretty(tsSerContent));
fs.writeFileSync(tsDeserFile, pretty(tsDeserContent));

console.log('\n\n', JSON.stringify(testTypes));
