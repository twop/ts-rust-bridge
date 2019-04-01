export type Sink = {
  pos: number;
  arr: Uint8Array;
};

export type SerFunc<T> = (sink: Sink, val: T) => Sink;

const ai32 = new Int32Array(2);
const af32 = new Float32Array(ai32.buffer);

const reserve = (sink: Sink, numberOfBytes: number): Sink => {
  const { arr, pos } = sink;

  if (arr.length - pos > numberOfBytes) return sink;

  const newLen = Math.max(arr.length * 2, arr.length + numberOfBytes);
  const newArr = new Uint8Array(newLen);

  for (let i = 0; i < pos; i++) {
    newArr[i] = arr[i];
  }

  return { arr: newArr, pos };
};

// write a byte without any checks
const wb = (sink: Sink, byte: number): Sink => {
  const { arr, pos } = sink;
  arr[pos] = byte;
  sink.pos += 1;
  return sink;
};

const write_bytes = (sink: Sink, bytes: Uint8Array): Sink => {
  sink = reserve(sink, bytes.length);
  const { arr, pos } = sink;
  for (let i = 0; i < bytes.length; i++) {
    arr[pos + i] = bytes[i];
  }
  sink.pos += bytes.length;
  return sink;
};

export const write_u8: SerFunc<number> = (sink, val) =>
  wb(reserve(sink, 1), val);

export const write_u32: SerFunc<number> = (sink, val) =>
  wb(wb(wb(wb(reserve(sink, 4), val), val >> 8), val >> 16), val >> 24);

export const write_u16: SerFunc<number> = (sink, val) =>
  wb(wb(reserve(sink, 2), val), val >> 8);

export const write_u64: SerFunc<number> = (sink, val) =>
  write_u32(write_u32(reserve(sink, 8), 0), val);

export const write_f32: SerFunc<number> = (sink, val) => {
  af32[0] = val; // just translate the bytes from float to i32
  return write_u32(reserve(sink, 4), ai32[0]);
};

export const write_str: SerFunc<string> = (sink, val) =>
  write_bytes(write_u64(sink, val.length), encoder.encode(val));

export const write_bool: SerFunc<boolean> = (sink, val) =>
  write_u8(sink, val ? 1 : 0);

const encoder = new TextEncoder();

export const write_seq = <T>(sink: Sink, seq: T[], serEl: SerFunc<T>) =>
  seq.reduce(serEl, write_u64(sink, seq.length));

export const write_opt = <T>(
  sink: Sink,
  val: T | undefined,
  serEl: SerFunc<T>
) => (val === undefined ? write_u8(sink, 0) : serEl(write_u8(sink, 1), val));
