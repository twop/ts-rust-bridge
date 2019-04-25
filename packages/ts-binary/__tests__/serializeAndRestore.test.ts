import {
  write_str,
  write_seq,
  write_u32,
  read_seq,
  read_u32,
  read_str,
  Sink,
  Serializer,
  Deserializer,
  read_u16,
  write_u16,
  read_bool,
  write_bool,
  read_u8,
  write_u8,
  write_opt,
  read_opt,
  read_f32,
  write_f32
} from '../src/index';

let sink: Sink = {
  arr: new Uint8Array(1), // small on purpose
  pos: 0
};

const serialize = <T>(thing: T, ser: Serializer<T>): Uint8Array => {
  sink.pos = 0;
  sink = ser(sink, thing);
  return sink.arr.slice(0, sink.pos);
};

const restore = <T>(deserializer: Deserializer<T>, from: Uint8Array): T =>
  deserializer({ arr: from, pos: 0 });

test('it reads and writes string', () => {
  const str = 'abc + абс';
  expect(restore(read_str, serialize(str, write_str))).toBe(str);
});

test('it reads and writes u32', () => {
  const u32 = 100500;
  expect(restore(read_u32, serialize(u32, write_u32))).toBe(u32);
});

test('it reads and writes f32', () => {
  const f32 = 100.5;
  expect(restore(read_f32, serialize(f32, write_f32))).toBe(f32);
});

test('it reads and writes u16', () => {
  const u16 = 253 * 4; // will require two bytes to store
  expect(restore(read_u16, serialize(u16, write_u16))).toBe(u16);
});

test('it reads and writes bool', () => {
  const bool = false;
  expect(restore(read_bool, serialize(bool, write_bool))).toBe(bool);
});

test('it reads and writes u8', () => {
  const u8 = 173;
  expect(restore(read_u8, serialize(u8, write_u8))).toBe(u8);
});

test('it reads and writes sequence of strings', () => {
  const seq = ['abc', 'бла', 'some other str'];

  const writeStrings: Serializer<string[]> = (s, arr) =>
    write_seq(s, arr, write_str);

  const readStrings: Deserializer<string[]> = s => read_seq(s, read_str);

  expect(restore(readStrings, serialize(seq, writeStrings))).toEqual(seq);
});

test('it reads and writes optional string', () => {
  const writeOptString: Serializer<string | undefined> = (s, maybeVal) =>
    write_opt(s, maybeVal, write_str);

  const readOptString: Deserializer<string | undefined> = s =>
    read_opt(s, read_str);

  const str = 'some str';
  expect(restore(readOptString, serialize(str, writeOptString))).toEqual(str);

  expect(restore(readOptString, serialize(undefined, writeOptString))).toEqual(
    undefined
  );
});
