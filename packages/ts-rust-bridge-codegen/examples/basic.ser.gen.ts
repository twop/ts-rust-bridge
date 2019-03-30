import { Message, NormalStruct, Tuple, Enum, Aha } from './basic.gen';

import {
  write_scalar,
  write_opt,
  write_seq,
  Sink,
  SerFunc
} from '../src/ser/ser';

const serializeOptBool = (sink: Sink, val: (boolean) | undefined): Sink =>
  write_opt(sink, val, write_scalar.Bool);

const serializeVecStr = (sink: Sink, val: Array<string>): Sink =>
  write_seq(sink, val, write_scalar.Str);

const serializeVecOptVecStr = (
  sink: Sink,
  val: Array<(Array<string>) | undefined>
): Sink => write_seq(sink, val, serializeOptVecStr);

const serializeOptVecStr = (
  sink: Sink,
  val: (Array<string>) | undefined
): Sink => write_opt(sink, val, serializeVecStr);

export const MessageMap: { [key: string]: number } = {
  Unit: 0,
  One: 1,
  Two: 2,
  VStruct: 3
};

export const serializeNormalStruct = (
  sink: Sink,
  { a, tuple }: NormalStruct
): Sink => serializeTuple(write_scalar.F32(sink, a), tuple);

export const EnumMap: { [key: string]: number } = { ONE: 0, TWO: 1, THREE: 2 };

export const serializeEnum = (sink: Sink, val: Enum): Sink =>
  write_scalar.U32(sink, EnumMap[val]);

export const serializeTuple = (sink: Sink, val: Tuple): Sink =>
  serializeVecStr(serializeOptBool(sink, val[0]), val[1]);

export const serializeAha: SerFunc<Aha> = serializeVecOptVecStr;
