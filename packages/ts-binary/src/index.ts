export type Sink = {
  pos: number;
  view: DataView;
  littleEndian: boolean;
};

export const Sink = (
  arr: ArrayBuffer,
  pos: number = 0,
  littleEndian: boolean = true
): Sink => ({
  pos,
  littleEndian,
  view: new DataView(arr)
});

export type Serializer<T> = (sink: Sink, val: T) => Sink;
export type Deserializer<T> = (sink: Sink) => T;

const reserve = (sink: Sink, numberOfBytes: number): Sink => {
  const {
    view: { buffer },
    pos
  } = sink;

  const curLen = buffer.byteLength;
  if (curLen - pos > numberOfBytes) return sink;

  const newLen = Math.max(curLen * 2, curLen + numberOfBytes);
  const newArr = new Uint8Array(newLen);
  newArr.set(new Uint8Array(buffer));
  return Sink(newArr.buffer, pos, sink.littleEndian);
};

export const write_u8: Serializer<number> = (sink, val) => {
  sink = reserve(sink, 1);
  const { view, pos } = sink;
  view.setUint8(pos, val);
  return (sink.pos += 1), sink;
};

export const write_u32: Serializer<number> = (sink, val) => {
  sink = reserve(sink, 4);
  const { view, pos, littleEndian } = sink;
  view.setUint32(pos, val, littleEndian);
  return (sink.pos += 4), sink;
};

export const write_u16: Serializer<number> = (sink, val) => {
  sink = reserve(sink, 2);
  const { view, pos, littleEndian } = sink;
  view.setUint16(pos, val, littleEndian);
  return (sink.pos += 2), sink;
};

function write_u64_unchecked(sink: Sink, val: number) {
  const { view, pos, littleEndian } = sink;
  // Even though we only support writing 4 byte values from JS, it's important
  // to write 8 bytes in case the buffer is not filled with 0. Otherwise, other
  // languages that can support 64 bit values (e.g. rust) risk reading garbage
  // in the other 4 bytes and getting an incorrect value.
  //
  // We could require that the Sink buffer be zeroed as part of the API, but
  // that's easy to forget (and it might be less efficient - it may require the
  // caller to zero out the entire buffer when that may be mostly unnecessary).
  view.setUint32(littleEndian ? pos : pos + 4, val, littleEndian);
  view.setUint32(littleEndian ? pos + 4 : pos, 0, littleEndian);
  return (sink.pos += 8), sink;
}

export const write_u64: Serializer<number> = (sink, val) =>
  write_u64_unchecked(reserve(sink, 8), val);

export const write_f32: Serializer<number> = (sink, val) => {
  sink = reserve(sink, 4);
  const { view, pos, littleEndian } = sink;
  view.setFloat32(pos, val, littleEndian);
  return (sink.pos += 4), sink;
};

export const write_f64: Serializer<number> = (sink, val) => {
  sink = reserve(sink, 8);
  const { view, pos, littleEndian } = sink;
  view.setFloat64(pos, val, littleEndian);
  return (sink.pos += 8), sink;
};

export const write_i32: Serializer<number> = (sink, val) => {
  sink = reserve(sink, 4);
  const { view, pos, littleEndian } = sink;
  view.setInt32(pos, val, littleEndian);
  return (sink.pos += 4), sink;
};

const encoder = new TextEncoder();

const encodeStrInto: (str: string, resArr: Uint8Array) => number =
  'encodeInto' in encoder
    ? (str, arr) => encoder.encodeInto(str, arr).written!
    : (str, arr) => {
        const bytes: Uint8Array = (encoder as any).encode(str);
        arr.set(bytes);
        return bytes.length;
      };

export const write_str: Serializer<string> = (sink, val) => {
  // reserve 8 bytes for the u64 len
  sink = reserve(sink, val.length * 3 + 8);
  const bytesWritten = encodeStrInto(
    val,
    new Uint8Array(sink.view.buffer, sink.pos + 8)
  );
  sink = write_u64_unchecked(sink, bytesWritten);
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

export const read_u8: Deserializer<number> = sink => {
  const { pos, view } = sink;
  return (sink.pos += 1), view.getUint8(pos);
};

export const read_u16: Deserializer<number> = sink => {
  const { pos, view, littleEndian } = sink;
  return (sink.pos += 2), view.getUint16(pos, littleEndian);
};

export const read_u32: Deserializer<number> = sink => {
  const { pos, view, littleEndian } = sink;
  return (sink.pos += 4), view.getUint32(pos, littleEndian);
};

export const read_u64: Deserializer<number> = sink => {
  const { view, pos, littleEndian } = sink;

  // we don't support numbers more than u32 (yet)
  return (
    (sink.pos += 8), view.getUint32(littleEndian ? pos : pos + 4, littleEndian)
  );
};

export const read_f32: Deserializer<number> = sink => {
  const { pos, view, littleEndian } = sink;
  return (sink.pos += 4), view.getFloat32(pos, littleEndian);
};

export const read_f64: Deserializer<number> = sink => {
  const { pos, view, littleEndian } = sink;
  return (sink.pos += 8), view.getFloat64(pos, littleEndian);
};

export const read_i32: Deserializer<number> = sink => {
  const { pos, view, littleEndian } = sink;
  return (sink.pos += 4), view.getInt32(pos, littleEndian);
};

export const read_bool: Deserializer<boolean> = sink => read_u8(sink) === 1;

export const opt_reader = <T>(
  readEl: Deserializer<T>
): Deserializer<T | undefined> => sink =>
  read_u8(sink) === 1 ? readEl(sink) : undefined;

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
  const {
    pos,
    view: { buffer }
  } = sink;
  const str = decoder.decode(new Uint8Array(buffer, pos, len));
  return (sink.pos += len), str;
};
