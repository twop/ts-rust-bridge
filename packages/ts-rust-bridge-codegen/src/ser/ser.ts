import { Scalar } from '../schema';

export type Sink = {
  pos: number;
  arr: Uint8Array;
};

export type SerFunc<T> = (sink: Sink, val: T) => Sink;

const ai32 = new Int32Array(2);
const af32 = new Float32Array(ai32.buffer);

// write a byte
const wb = (sink: Sink, byte: number): Sink => {
  const { arr, pos } = sink;
  arr[pos] = byte;
  sink.pos += 1;
  return sink;
};


export const write_bytes = (sink: Sink, bytes: Uint8Array): Sink => {
  const { arr, pos } = sink;
  for (let i = 0; i < bytes.length; i++) {
    arr[pos + i] = bytes[i];
  }
  sink.pos += bytes.length;
  return sink;
};

const write_u32: SerFunc<TypeOfScalarVal<Scalar.U32>> = (sink, val) =>
  wb(wb(wb(wb(sink, val), val >> 8), val >> 16), val >> 24);

const write_u64: SerFunc<number> = (sink, val) =>
  write_u32(write_u32(sink, 0), val);

type TypeOfScalarVal<T extends Scalar> = T extends
  | Scalar.U8
  | Scalar.F32
  | Scalar.U16
  | Scalar.U32
  | Scalar.USIZE
  ? number
  : T extends Scalar.Bool
  ? boolean
  : T extends Scalar.Str
  ? string
  : never;

const encoder = new TextEncoder();

export const write_scalar: { [K in Scalar]: SerFunc<TypeOfScalarVal<K>> } = {
  [Scalar.U8]: wb,

  [Scalar.U16]: (sink, val) => wb(wb(sink, val), val >> 8),

  [Scalar.U32]: write_u32,

  [Scalar.USIZE]: write_u64,

  [Scalar.F32]: (sink, val) => {
    af32[0] = val; // just translate the bytes from float to i32
    return write_u32(sink, ai32[0]);
  },

  [Scalar.Str]: (sink, val) =>
    write_bytes(write_u64(sink, val.length), encoder.encode(val)),

  [Scalar.Bool]: (sink, val) => wb(sink, val ? 1 : 0)
};

export const write_seq = <T>(sink: Sink, seq: T[], serEl: SerFunc<T>) =>
  seq.reduce((s, el) => serEl(s, el), write_u64(sink, seq.length));

export const write_opt = <T>(
  sink: Sink,
  val: T | undefined,
  serEl: SerFunc<T>
) => (val === undefined ? wb(sink, 0) : serEl(wb(sink, 1), val));
