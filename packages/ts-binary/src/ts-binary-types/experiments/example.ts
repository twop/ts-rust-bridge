import { Static } from '../core';
import { U8, F32 } from '../types/numbers';
import { Tuple } from '../types/tuple';
import { Struct } from '../types/struct';
import { Enum } from '../types/enum';
import { Union } from '../types/union';
import { U32 } from '../types/numbers';
import { retype } from '../retype';
// import { Bool } from './bool';

const Color_ = Tuple(U8, U8, U8);
export interface Color extends Static<typeof Color_> {}
export const Color = retype(Color_).as<Color>();

const Vec3_ = Tuple(F32, F32, F32);
export interface Vec3 extends Static<typeof Vec3_> {}
export const Vec3 = retype(Vec3_).as<Vec3>();

const S_ = Struct({
  color: Color,
  vec3: Vec3
});

export interface S extends Static<typeof S_> {}
export const S = retype(S_).as<S>();

const E = Enum('A', 'B', 'C');
E;

type E = Static<typeof E>;

const U = Union({
  A: U32,
  B: S,
  C: null,
  Col: Color
});

// U.

type U = Static<typeof U>;
U.Col(Color(1, 2, 3));

// type BoxedBool = {
//   bool: boolean;
//   str: string;
// };

// export interface S extends Static<typeof S_> {}
