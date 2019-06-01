import {
  Struct,
  Str,
  Union,
  F32,
  Tuple,
  Bool,
  U32,
  Static,
  U8,
  Vec,
  Option
} from '../lib';

// import { Struct } from './types/struct';
// import { Static } from './core';
// import { Str } from './types/str';
// import { Union } from './types/union';
// import { Tuple } from './types/tuple';
// import { Option } from './types/option';
// import { Bool } from './types/bool';
// import { U32, F32, U8 } from './types/numbers';
// import { Vec } from './types/vector';

// import {
//   Union,
//   F32,
//   Record,
//   Tuple,
//   Str,
//   Option,
//   Bool,
//   U32,
//   Static,
//   U8,
//   Vec
// } from './lib';

// pub enum Message {
//   Unit,
//   One(f32),
//   Two(Option<bool>, u32),
//   VStruct { id: String, data: String },
// }

export const VStruct = Struct({
  id: Str,
  data: Str
});

export const Message = Union({
  Unit: null,
  One: F32,
  Two: Tuple(Option(Bool), U32),
  VStruct
});

export interface VStruct extends Static<typeof VStruct> {}
export type Message = Static<typeof Message>;

export interface Color extends Static<typeof Color> {}
export const Color = Tuple(U8, U8, U8);
export interface Vec3 extends Static<typeof Vec3> {}

export const Vec3 = Tuple(F32, F32, F32);

export const Figure = Struct({
  dots: Vec(Vec3),
  colors: Vec(Color)
});

export interface Figure extends Static<typeof Figure> {}

export const Container = Union({
  Units: null,
  JustNumber: U32,
  Figures: Vec(Figure)
});

export type Container = Static<typeof Container>;

// #[derive(Deserialize, Serialize, Debug, Clone)]
// pub enum Container {
//     Units,
//     JustNumber(u32),
//     Figures(Vec<Figure>),
// }

// #[derive(Deserialize, Serialize, Debug, Clone)]
// pub struct Color(pub u8, pub u8, pub u8);

// #[derive(Deserialize, Serialize, Debug, Clone)]
// pub struct Figure {
//     pub dots: Vec<Vec3>,
//     pub colors: Vec<Color>,
// }

// #[derive(Deserialize, Serialize, Debug, Clone)]
// pub struct Vec3(pub f32, pub f32, pub f32);

// export type Message =
//   | { tag: "Unit" }
//   | { tag: "One"; value: number }
//   | { tag: "Two"; value: Message_Two }
//   | { tag: "VStruct"; value: Message_VStruct };

// export interface Message_Two {
//   0: (boolean) | undefined;
//   1: number;
//   length: 2;
// }

// export interface Message_VStruct {
//   id: string;
//   data: string;
// }

// export module Message {
//   export const Unit: Message = { tag: "Unit" };

//   export const One = (value: number): Message => ({ tag: "One", value });

//   export const Two = (p0: (boolean) | undefined, p1: number): Message => ({
//     tag: "Two",
//     value: [p0, p1]
//   });

//   export const VStruct = (value: Message_VStruct): Message => ({
//     tag: "VStruct",
//     value
//   });
// }

// export type NType = number & { type: "NType" };

// export const NType = (val: number): number & { type: "NType" } => val as any;

// export type Container =
//   | { tag: "Units" }
//   | { tag: "JustNumber"; value: number }
//   | { tag: "Figures"; value: Array<Figure> };

// export module Container {
//   export const Units: Container = { tag: "Units" };

//   export const JustNumber = (value: number): Container => ({
//     tag: "JustNumber",
//     value
//   });

//   export const Figures = (value: Array<Figure>): Container => ({
//     tag: "Figures",
//     value
//   });
// }

// export interface Color {
//   0: number;
//   1: number;
//   2: number;
//   length: 3;
// }

// export const Color = (p0: number, p1: number, p2: number): Color => [
//   p0,
//   p1,
//   p2
// ];

// export interface Figure {
//   dots: Array<Vec3>;
//   colors: Array<Color>;
// }

// export interface Vec3 {
//   0: number;
//   1: number;
//   2: number;
//   length: 3;
// }

// export const Vec3 = (p0: number, p1: number, p2: number): Vec3 => [p0, p1, p2];

// export interface NormalStruct {
//   a: number;
//   tuple: Tuple;
// }

// export enum Enum {
//   ONE = "ONE",
//   TWO = "TWO",
//   THREE = "THREE"
// }

// export interface Tuple {
//   0: (boolean) | undefined;
//   1: Array<string>;
//   length: 2;
// }

// export const Tuple = (p0: (boolean) | undefined, p1: Array<string>): Tuple => [
//   p0,
//   p1
// ];

// export type Aha = Array<(Array<string>) | undefined>;
