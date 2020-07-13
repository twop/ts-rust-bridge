import { Sink, Deserializer, Serializer } from '../../ts-binary/src/index';

import * as t from './generated/types.g';
import * as sd from './generated/types.serde.g';

const serde = <T>(val: T, ser: Serializer<T>, deser: Deserializer<T>): T => {
  let sink = Sink(new ArrayBuffer(1));

  sink = ser(sink, val);
  sink.pos = 0;

  return deser(sink);
};

test('it reads and writes Enum', () => {
  const val = t.MyEnum.Three;
  expect(serde(val, sd.writeMyEnum, sd.readMyEnum)).toBe(val);
});

test('it reads and writes Tuple', () => {
  const val = t.MyTuple(false, ['a', 'b', 'ccs']);
  expect(serde(val, sd.writeMyTuple, sd.readMyTuple)).toEqual(val);
  const val2 = t.MyTuple(null, ['a']);
  expect(serde(val2, sd.writeMyTuple, sd.readMyTuple)).toEqual(val2);
});

test('it reads and writes NewType', () => {
  const val = t.NewTypeU32(3);
  expect(serde(val, sd.writeNewTypeU32, sd.readNewTypeU32)).toBe(val);
});

test('it reads and writes Alias', () => {
  const val: t.AliasToStr = 'str';
  expect(serde(val, sd.writeAliasToStr, sd.readAliasToStr)).toBe(val);
});

test('it reads and writes Structs', () => {
  const val: t.JustAStruct = { u8: 5, myTuple: t.MyTuple(true, ['aha!']) };
  expect(serde(val, sd.writeJustAStruct, sd.readJustAStruct)).toEqual(val);
});

test('it reads and writes Union variants', () => {
  const { BoolAndU32, Float32, Unit, StructVariant } = t.SimpleUnion;

  const f32Arr = new Float32Array(1);
  f32Arr[0] = 4.1; // this is needed because of issues like 4.1 -> 4.099999999998
  const values: t.SimpleUnion[] = [
    Unit,
    Float32(f32Arr[0]),
    BoolAndU32(false, 445),
    StructVariant({ id: 'str', tuple: t.MyTuple(false, ['bla']) })
  ];

  values.forEach(val =>
    expect(serde(val, sd.writeSimpleUnion, sd.readSimpleUnion)).toEqual(val)
  );
});
