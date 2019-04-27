import { Sink, Deserializer, Serializer } from '../../ts-binary/src/index';

import * as t from './generated/types';
import * as s from './generated/serializers';
import * as d from './generated/deserializers';

const serde = <T>(val: T, ser: Serializer<T>, deser: Deserializer<T>): T => {
  let sink: Sink = {
    arr: new Uint8Array(1), // small on purpose
    pos: 0
  };

  sink = ser(sink, val);
  sink.pos = 0;

  return deser(sink);
};

test('it reads and writes Enum', () => {
  const val = t.MyEnum.Three;
  expect(serde(val, s.writeMyEnum, d.readMyEnum)).toBe(val);
});

test('it reads and writes Tuple', () => {
  const val = t.Tuple(false, ['a', 'b', 'ccs']);
  expect(serde(val, s.writeTuple, d.readTuple)).toEqual(val);
});

test('it reads and writes Tuple', () => {
  const val = t.Tuple(false, ['a', 'b', 'ccs']);
  expect(serde(val, s.writeTuple, d.readTuple)).toEqual(val);
});

test('it reads and writes NewType', () => {
  const val = t.NewTypeU32(3);
  expect(serde(val, s.writeNewTypeU32, d.readNewTypeU32)).toBe(val);
});

test('it reads and writes Alias', () => {
  const val: t.AliasToStr = 'str';
  expect(serde(val, s.writeAliasToStr, d.readAliasToStr)).toBe(val);
});

test('it reads and writes Structs', () => {
  const val: t.JustAStruct = { u8: 5, myTuple: t.Tuple(true, ['aha!']) };
  expect(serde(val, s.writeJustAStruct, d.readJustAStruct)).toEqual(val);
});

test('it reads and writes Union variants', () => {
  const { BoolAndU32, Float32, Unit, StructVariant } = t.SimpleUnion;

  const f32Arr = new Float32Array(1);
  f32Arr[0] = 4.1; // this is needed because of issues like 4.1 -> 4.099999999998
  const values: t.SimpleUnion[] = [
    Unit,
    Float32(f32Arr[0]),
    BoolAndU32(false, 445),
    StructVariant({ id: 'str', tuple: t.Tuple(false, ['bla']) })
  ];

  values.forEach(val =>
    expect(serde(val, s.writeSimpleUnion, d.readSimpleUnion)).toEqual(val)
  );
});
