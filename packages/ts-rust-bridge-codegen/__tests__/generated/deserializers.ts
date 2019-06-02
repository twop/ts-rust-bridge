import {
  Tuple,
  SimpleUnion,
  SimpleUnion_StructVariant,
  JustAStruct,
  MyEnum,
  NewTypeU32,
  AliasToStr
} from './types';

import {
  opt_reader,
  read_bool,
  seq_reader,
  read_str,
  read_u32,
  read_f32,
  read_u8,
  Sink,
  Deserializer
} from '../../../ts-binary/src/index';

const readOptBool: Deserializer<(boolean) | undefined> = opt_reader(read_bool);

const readVecStr: Deserializer<Array<string>> = seq_reader(read_str);

export const readTuple = (sink: Sink): Tuple =>
  Tuple(readOptBool(sink), readVecStr(sink));

export const readSimpleUnion = (sink: Sink): SimpleUnion => {
  switch (read_u32(sink)) {
    case 0:
      return SimpleUnion.Unit;
    case 1:
      return SimpleUnion.Float32(read_f32(sink));
    case 2:
      return SimpleUnion.BoolAndU32(readOptBool(sink), read_u32(sink));
    case 3:
      return SimpleUnion.StructVariant(readSimpleUnion_StructVariant(sink));
  }
  throw new Error('bad variant index for SimpleUnion');
};

const readSimpleUnion_StructVariant = (
  sink: Sink
): SimpleUnion_StructVariant => {
  const id = read_str(sink);
  const tuple = readTuple(sink);
  return { id, tuple };
};

export const readJustAStruct = (sink: Sink): JustAStruct => {
  const u8 = read_u8(sink);
  const myTuple = readTuple(sink);
  return { u8, myTuple };
};

const MyEnumReverseMap: MyEnum[] = [MyEnum.One, MyEnum.Two, MyEnum.Three];

export const readMyEnum = (sink: Sink): MyEnum =>
  MyEnumReverseMap[read_u32(sink)];

export const readNewTypeU32 = (sink: Sink): NewTypeU32 =>
  NewTypeU32(read_u32(sink));

export const readAliasToStr: Deserializer<AliasToStr> = read_str;
