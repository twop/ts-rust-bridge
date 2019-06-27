import {
  Struct,
  Vec,
  Tuple,
  Bool,
  Str,
  F64,
  Static,
  bindesc,
  Union
} from "../src/index";

// const BoolStr = Tuple(Bool, F64);
const BoolStr = Tuple(Bool, Str);

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

function randomStr(length: number): string {
  var text = "";
  var possible = "авыджалдллтЛОЫФДЛВдфульсвдыолдо";

  for (var i = 0; i < length; i++)
    text += possible.charAt(Math.floor(Math.random() * possible.length));

  return text;
}

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
    () => BoolStr(genBool(), randomStr(vecSize))
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

export const writeMessage = (msg: Msg, arr: ArrayBuffer): ArrayBuffer =>
  Msg[bindesc].write({ arr: new Uint8Array(arr), pos: 0 }, msg).arr.buffer;

export const readMessage = (arr: ArrayBuffer): Msg =>
  Msg[bindesc].read({ arr: new Uint8Array(arr), pos: 0 });

function genBool(): boolean {
  return Math.random() > 0.5;
}

export type WorkerMsg =
  | { tag: "json"; val: Msg }
  | { tag: "msg_arr"; val: ArrayBuffer }
  | { tag: "shared_arr"; val: SharedArrayBuffer };
