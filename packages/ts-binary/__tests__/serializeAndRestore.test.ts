import {
  write_str,
  seq_writer,
  write_u32,
  seq_reader,
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
  opt_writer,
  opt_reader,
  nullable_reader,
  nullable_writer,
  read_f32,
  write_f32,
  write_i32,
  read_i32,
  write_f64,
  read_f64,
} from '../src/index';

const serializeAndRestore = <T>(
  thing: T,
  serializer: Serializer<T>,
  deserializer: Deserializer<T>
): T => {
  let sink = Sink(new ArrayBuffer(1));
  sink = serializer(sink, thing);
  sink.pos = 0;
  return deserializer(sink);
};

test('it reads and writes string', () => {
  const str = 'abc + абс';
  expect(serializeAndRestore(str, write_str, read_str)).toBe(str);
});

test('it reads and writes u32', () => {
  const u32 = 100500;
  expect(serializeAndRestore(u32, write_u32, read_u32)).toBe(u32);
});

test('it reads and writes f32', () => {
  const f32 = 100.5;
  expect(serializeAndRestore(f32, write_f32, read_f32)).toBe(f32);
});

test('it reads and writes f64', () => {
  const f64 = Number.MAX_VALUE;
  expect(serializeAndRestore(f64, write_f64, read_f64)).toBe(f64);
});

test('it reads and writes i32', () => {
  const i32 = -100;
  expect(serializeAndRestore(i32, write_i32, read_i32)).toBe(i32);
});

test('it reads and writes u16', () => {
  const u16 = 253 * 4; // will require two bytes to store
  expect(serializeAndRestore(u16, write_u16, read_u16)).toBe(u16);
});

test('it reads and writes bool', () => {
  const bool = false;
  expect(serializeAndRestore(bool, write_bool, read_bool)).toBe(bool);
});

test('it reads and writes u8', () => {
  const u8 = 173;
  expect(serializeAndRestore(u8, write_u8, read_u8)).toBe(u8);
});

test('it reads and writes sequence of strings', () => {
  const seq = ['abc', 'бла', 'some other str'];

  const writeStrings = seq_writer(write_str);

  const readStrings = seq_reader(read_str);

  expect(serializeAndRestore(seq, writeStrings, readStrings)).toEqual(seq);
});

test('it reads and writes optional string', () => {
  const writeOptString = opt_writer(write_str);
  const readOptString = opt_reader(read_str);

  const str = 'some str';
  expect(serializeAndRestore(str, writeOptString, readOptString)).toEqual(str);

  expect(serializeAndRestore(undefined, writeOptString, readOptString)).toEqual(
    undefined
  );
});

test('it reads and writes nullable string', () => {
  const writeNullableString = nullable_writer(write_str);
  const readNullableString = nullable_reader(read_str);

  const str = 'some str';
  expect(
    serializeAndRestore(str, writeNullableString, readNullableString)
  ).toEqual(str);

  expect(
    serializeAndRestore(null, writeNullableString, readNullableString)
  ).toEqual(null);
});
