export type Sink = {
  pos: number;
  arr: Uint8Array;
};

export const Sink = (arr: ArrayBuffer): Sink => ({
  arr: new Uint8Array(arr),
  pos: 0
});

export type Serializer<T> = (sink: Sink, val: T) => Sink;
export type Deserializer<T> = (sink: Sink) => T;

// note that all of them look at the same memory (same 4 bytes)
const au32 = new Uint32Array(2);
const au16 = new Uint16Array(au32.buffer);
const au8 = new Uint8Array(au32.buffer);
const af32 = new Float32Array(au32.buffer);
const af64 = new Float64Array(au32.buffer);
const ai32 = new Int32Array(au32.buffer);

const reserve = (sink: Sink, numberOfBytes: number): Sink => {
  const { arr, pos } = sink;

  if (arr.length - pos > numberOfBytes) return sink;

  const newLen = Math.max(arr.length * 2, arr.length + numberOfBytes);
  const newArr = new Uint8Array(newLen);
  newArr.set(arr, 0);
  return { arr: newArr, pos };
};

// write a byte without any checks
const wb = (sink: Sink, byte: number): Sink => {
  const { arr, pos } = sink;
  arr[pos] = byte;
  sink.pos += 1;
  return sink;
};

export const write_u8: Serializer<number> = (sink, val) =>
  wb(reserve(sink, 1), val);

export const write_u32: Serializer<number> = (sink, val) =>
  wb(wb(wb(wb(reserve(sink, 4), val), val >> 8), val >> 16), val >> 24);

export const write_u16: Serializer<number> = (sink, val) =>
  wb(wb(reserve(sink, 2), val), val >> 8);

export const write_u64: Serializer<number> = (sink, val) =>
  write_u32(write_u32(reserve(sink, 8), val), 0);

export const write_f32: Serializer<number> = (sink, val) => {
  af32[0] = val; // just translate the bytes from float to u32
  return write_u32(reserve(sink, 4), au32[0]);
};

export const write_f64: Serializer<number> = (sink, val) => {
  af64[0] = val; // just translate the bytes from float64 to u32
  return write_u32(write_u32(reserve(sink, 8), au32[0]), au32[1]);
};

export const write_i32: Serializer<number> = (sink, val) => {
  ai32[0] = val; // just translate the bytes from i32 to u32
  return write_u32(reserve(sink, 4), au32[0]);
};

const encoder = new TextEncoder();

const encodeStrInto: (str: string, resArr: Uint8Array, pos: number) => number =
  'encodeInto' in encoder
    ? (str, arr, pos) =>
        encoder.encodeInto(str, new Uint8Array(arr.buffer, pos)).written!
    : (str, arr, pos) => {
        const bytes: Uint8Array = (encoder as any).encode(str);
        arr.set(bytes, pos);
        return bytes.length;
      };

export const write_str: Serializer<string> = (sink, val) => {
  // reserve 8 bytes for the u64 len
  sink = reserve(sink, val.length * 3 + 8);
  const bytesWritten = encodeStrInto(val, sink.arr, sink.pos + 8);
  sink = write_u64(sink, bytesWritten);
  sink.pos += bytesWritten;
  return sink;
};

export const write_bool: Serializer<boolean> = (sink, val) =>
  write_u8(sink, val ? 1 : 0);

export const seq_writer = <T>(serEl: Serializer<T>): Serializer<T[]> => (
  sink,
  seq: T[]
) => seq.reduce(serEl, write_u64(sink, seq.length));

export const opt_writer = <T>(
  serEl: Serializer<T>
): Serializer<T | undefined> => (sink: Sink, val: T | undefined) =>
  val === undefined ? write_u8(sink, 0) : serEl(write_u8(sink, 1), val);

// -------- Deserialization ----------

export const read_u8: Deserializer<number> = sink => sink.arr[sink.pos++];

// read 1 byte into a number + move pos in sink by 1
const rb = read_u8;

export const read_u32: Deserializer<number> = sink => {
  au8[0] = rb(sink);
  au8[1] = rb(sink);
  au8[2] = rb(sink);
  au8[3] = rb(sink);
  return au32[0];
};

export const read_u16: Deserializer<number> = sink => {
  au8[0] = rb(sink);
  au8[1] = rb(sink);
  return au16[0];
};

export const read_u64: Deserializer<number> = sink => {
  // we don't support numbers more than u32 (yet)
  const val = read_u32(sink);
  sink.pos += 4;
  return val;
};

export const read_f32: Deserializer<number> = sink => {
  au8[0] = rb(sink);
  au8[1] = rb(sink);
  au8[2] = rb(sink);
  au8[3] = rb(sink);
  return af32[0];
};

export const read_f64: Deserializer<number> = sink => {
  for (let i = 0; i < 8; i++) au8[i] = rb(sink);
  return af64[0];
};

export const read_i32: Deserializer<number> = sink => {
  au8[0] = rb(sink);
  au8[1] = rb(sink);
  au8[2] = rb(sink);
  au8[3] = rb(sink);
  return ai32[0];
};

export const read_bool: Deserializer<boolean> = sink => rb(sink) === 1;

export const opt_reader = <T>(
  readEl: Deserializer<T>
): Deserializer<T | undefined> => sink =>
  rb(sink) === 1 ? readEl(sink) : undefined;

export const seq_reader = <T>(
  readEl: Deserializer<T>
): Deserializer<T[]> => sink => {
  const count = read_u64(sink);

  // Note it doesn't make sense to set capacity here
  // because it will mess up shapes
  const res = new Array<T>();

  for (let i = 0; i < count; i++) {
    res.push(readEl(sink));
  }

  return res;
};

const decoder = new TextDecoder();

export const read_str: Deserializer<string> = sink => {
  const len = read_u64(sink);
  const str = decoder.decode(new Uint8Array(sink.arr.buffer, sink.pos, len));
  sink.pos += len;
  return str;
};
