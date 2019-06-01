import { Sink } from '..';
import { BinType, bindesc, Static } from './core';
import { U8, U16, U32, I32, F32 } from './types/numbers';
import { Bool } from './types/bool';
import { Str } from './types/str';
import { Option } from './types/option';
import { Enum } from './types/enum';
import { Vec } from './types/vector';
import { Tuple } from './lib';
import { Struct } from './types/struct';
import { Union } from './types/union';

const saveAndRestore = <T>(
  val: T,
  bintype: BinType<string, T>
  //   deser: Deserializer<T>,
  //   ser: Serializer<T>
): T => {
  const { arr }: Sink = bintype[bindesc].write(
    {
      arr: new Uint8Array(1), // small on purpose
      pos: 0
    },
    val
  );

  return bintype[bindesc].read({ arr, pos: 0 });
};

describe('numbers', () => {
  it('can save and restore U8', () => {
    expect(saveAndRestore(5, U8)).toBe(5);
    // out of 0-255
    expect(saveAndRestore(255 + 2, U8)).toBe(1);
  });

  it('can save and restore U16', () => {
    expect(saveAndRestore(257, U16)).toBe(257);
    // out of U16
    expect(saveAndRestore(2 ** 16 + 1, U16)).toBe(1);
  });

  it('can save and restore U32', () => {
    expect(saveAndRestore(2 ** 31, U32)).toBe(2 ** 31);
    // out of U32
    expect(saveAndRestore(2 ** 32 + 1, U32)).toBe(1);
  });

  it('can save and restore I32', () => {
    expect(saveAndRestore(-(2 ** 30), I32)).toBe(-(2 ** 30));
  });

  it('can save and restore F32', () => {
    // FLoat32 are not exactly js numbers. They are being rounded a bit
    expect(saveAndRestore(-100.6, F32) === -100.6).toBe(false);

    const arr = new Float32Array(1);
    arr[0] = -100.6;
    const f32 = arr[0];

    expect(saveAndRestore(-100.6, F32)).toBe(f32);
  });
});

test('can save and restore Bool', () => {
  expect(saveAndRestore(true, Bool)).toBe(true);
  expect(saveAndRestore(false, Bool)).toBe(false);
});

test('can save and restore Str', () => {
  expect(saveAndRestore('', Str)).toBe('');
  expect(saveAndRestore('abc', Str)).toBe('abc');
});

test('can save and restore Option(Str)', () => {
  const OptStr = Option(Str);
  expect(saveAndRestore(undefined, OptStr)).toBe(undefined);
  expect(saveAndRestore('abc', OptStr)).toBe('abc');
});

test('can save and restore Enum', () => {
  const AorB = Enum('A', 'B');
  expect(saveAndRestore(AorB.A, AorB)).toBe('A');
  expect(saveAndRestore(AorB.B, AorB)).toBe('B');
});

test('can save and restore Vector(Bool)', () => {
  const VecBool = Vec(Bool);
  expect(saveAndRestore([true, false], VecBool)).toEqual([true, false]);
});

describe('Tuple', () => {
  it('can save and restore Tuple2', () => {
    const BoolStr = Tuple(Bool, Str);
    expect(saveAndRestore(BoolStr(true, 'a'), BoolStr)).toEqual([true, 'a']);
  });

  it('can save and restore Tuple3', () => {
    const BoolStrU32 = Tuple(Bool, Str, U32);
    expect(saveAndRestore(BoolStrU32(true, 'a', 100500), BoolStrU32)).toEqual([
      true,
      'a',
      100500
    ]);
  });
});

test('can save and restore Struct', () => {
  const S = Struct({ bool: Bool, str: Str });
  const val: Static<typeof S> = { bool: true, str: 'a' };
  expect(saveAndRestore(val, S)).toEqual({ ...val });
});

test('can save and restore Struct', () => {
  const U = Union({
    Unit: null,
    B: Bool,
    S: Str
  });

  expect(saveAndRestore(U.Unit, U)).toEqual({ tag: 'Unit' });
  expect(saveAndRestore(U.B(false), U)).toEqual({ tag: 'B', val: false });
  expect(saveAndRestore(U.S('a'), U)).toEqual({ tag: 'S', val: 'a' });
});
