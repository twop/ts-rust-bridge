import {
  Struct,
  Vec,
  Tuple,
  Bool,
  // Str,
  F64,
  Static,
  bindesc,
  Union,
  I32,
  Sink
} from "../src/index";

const BoolStr = Tuple(Bool, I32);
// const BoolStr = Tuple(Bool, Str);

const Inner = Union({
  B: Bool,
  S: Tuple(Bool, F64),
  //   S: Struct({ bool: Bool, f64: F64 }),
  Color: Tuple(F64, F64, F64)
});

// export const Msg = Tuple(Vec(BoolStr), Vec(F64), Vec(Inner));
export const Msg = Struct({
  vec: Vec(BoolStr),
  nums: Vec(F64),
  unions: Vec(Inner)
});

export type Msg = Static<typeof Msg>;

const genF64 = () => Math.random() * 1000000;
const genI32 = () =>
  Math.floor(Math.random() * 1000000 * (Math.random() > 0.5 ? 1 : -1));

function randomStr(length: number): string {
  var text = "";
  var possible = "авыджалдллтЛОЫФДЛВдфульсвдыолдо";

  for (var i = 0; i < length; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}
randomStr;
// export const genMessage = (vecSize: number): Msg => [
//   Array.from({ length: vecSize }, () => BoolStr(genBool(), genF64())),
//   Array.from({ length: vecSize }, genF64),
//   Array.from({ length: vecSize }, () => {
//     const seed = Math.random();

//     return seed < 0.33
//       ? Inner.B(genBool())
//       : seed < 0.66
//       ? Inner.S([genBool(), genF64()])
//       : //   ? Inner.S({ bool: genBool(), f64: genF64() })
//         Inner.Color([genF64(), genF64(), genF64()]);
//   })
// ];
export const genMessage = (vecSize: number): Msg => ({
  vec: Array.from(
    { length: vecSize },
    // () => BoolStr(genBool(), genF64())
    // () => BoolStr(genBool(), randomStr(vecSize))
    () => BoolStr(genBool(), genI32())
  ),
  nums: Array.from({ length: vecSize }, genF64),
  unions: Array.from({ length: vecSize }, () => {
    const seed = Math.random();

    return seed < 0.33
      ? Inner.B(genBool())
      : seed < 0.66
      ? Inner.S([genBool(), genF64()])
      : //   ? Inner.S({ bool: genBool(), f64: genF64() })
        Inner.Color([genF64(), genF64(), genF64()]);
  })
});

export const writeMessage = (msg: Msg, arr: Uint8Array): Uint8Array =>
  Msg[bindesc].write({ arr, pos: 0 }, msg).arr;

export const readMessage = (arr: Uint8Array): Msg => {
  const sink: Sink = { arr, pos: 0 };
  const res = Msg[bindesc].read(sink);
  // console.log(`read ${sink.pos} bytes`);
  return res;
};

function genBool(): boolean {
  return Math.random() > 0.5;
}

export type WorkerMsg =
  | { tag: "json"; val: Msg }
  | { tag: "msg_arr"; val: ArrayBuffer }
  | { tag: "shared_arr"; val: SharedArrayBuffer };

export const printExecTime = (name: string, hrtime: [number, number]) =>
  console.info(name + " took (hr): %ds %dms", hrtime[0], hrtime[1] / 1000000);
