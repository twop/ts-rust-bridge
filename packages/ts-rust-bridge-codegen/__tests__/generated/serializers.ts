import {
  Tuple,
  SimpleUnion,
  SimpleUnion_BoolAndU32,
  SimpleUnion_StructVariant,
  JustAStruct,
  MyEnum,
  NewTypeU32,
  AliasToStr
} from './types';

import {
  opt_writer,
  write_bool,
  seq_writer,
  write_str,
  write_u32,
  write_f32,
  write_u8,
  Sink,
  Serializer
} from '../../../ts-binary/src/index';

const writeOptBool: Serializer<(boolean) | undefined> = opt_writer(write_bool);

const writeVecStr: Serializer<Array<string>> = seq_writer(write_str);

export const writeTuple = (sink: Sink, val: Tuple): Sink =>
  writeVecStr(writeOptBool(sink, val[0]), val[1]);

const writeSimpleUnion_BoolAndU32 = (
  sink: Sink,
  val: SimpleUnion_BoolAndU32
): Sink => write_u32(writeOptBool(sink, val[0]), val[1]);

const writeSimpleUnion_StructVariant = (
  sink: Sink,
  { id, tuple }: SimpleUnion_StructVariant
): Sink => writeTuple(write_str(sink, id), tuple);

export const writeSimpleUnion = (sink: Sink, val: SimpleUnion): Sink => {
  switch (val.tag) {
    case 'Unit':
      return write_u32(sink, 0);
    case 'Float32':
      return write_f32(write_u32(sink, 1), val.value);
    case 'BoolAndU32':
      return writeSimpleUnion_BoolAndU32(write_u32(sink, 2), val.value);
    case 'StructVariant':
      return writeSimpleUnion_StructVariant(write_u32(sink, 3), val.value);
  }
};

export const writeJustAStruct = (
  sink: Sink,
  { u8, myTuple }: JustAStruct
): Sink => writeTuple(write_u8(sink, u8), myTuple);

const MyEnumMap: { [key: string]: number } = { One: 0, Two: 1, Three: 2 };

export const writeMyEnum = (sink: Sink, val: MyEnum): Sink =>
  write_u32(sink, MyEnumMap[val]);

export const writeNewTypeU32: Serializer<NewTypeU32> = write_u32;

export const writeAliasToStr: Serializer<AliasToStr> = write_str;
