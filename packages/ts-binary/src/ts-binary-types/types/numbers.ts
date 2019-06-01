import { BinType, createBinType, TypeTag } from '../core';
import {
  read_u8,
  write_u8,
  read_f32,
  write_f32,
  read_u32,
  write_u32,
  read_u16,
  write_u16,
  read_i32,
  write_i32
} from '../..';

export interface U32 extends BinType<TypeTag.U32, number> {}
export const U32 = createBinType<U32>(read_u32, write_u32, TypeTag.U32, {}, {});

export interface U8 extends BinType<TypeTag.U8, number> {}
export const U8 = createBinType<U8>(read_u8, write_u8, TypeTag.U8, {}, {});

export interface U16 extends BinType<TypeTag.U16, number> {}
export const U16 = createBinType<U16>(read_u16, write_u16, TypeTag.U16, {}, {});

export interface F32 extends BinType<TypeTag.F32, number> {}
export const F32 = createBinType<F32>(read_f32, write_f32, TypeTag.F32, {}, {});

export interface I32 extends BinType<TypeTag.I32, number> {}
export const I32 = createBinType<I32>(read_i32, write_i32, TypeTag.I32, {}, {});
