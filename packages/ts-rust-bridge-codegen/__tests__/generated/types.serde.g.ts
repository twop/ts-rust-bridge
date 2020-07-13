import {
  MyEnum,
  NewTypeU32,
  AliasToStr,
  SimpleUnion,
  SimpleUnion_BoolAndU32,
  MyTuple,
  SimpleUnion_StructVariant,
  JustAStruct
} from './types.g';

import {
  write_u32,
  write_str,
  write_f32,
  opt_writer,
  write_bool,
  write_u8,
  nullable_writer,
  seq_writer,
  Sink,
  Serializer,
  read_u32,
  read_str,
  read_f32,
  opt_reader,
  read_bool,
  read_u8,
  nullable_reader,
  seq_reader,
  Deserializer
} from '../../../ts-binary/src/index';

// Serializers

const writeOptBool: Serializer<(boolean) | undefined> = opt_writer(write_bool);

const writeNullableBool: Serializer<(boolean) | null> = nullable_writer(
  write_bool
);

const writeVecStr: Serializer<Array<string>> = seq_writer(write_str);

const MyEnumMap: { [key: string]: number } = { One: 0, Two: 1, Three: 2 };

export const writeMyEnum = (sink: Sink, val: MyEnum): Sink =>
  write_u32(sink, MyEnumMap[val]);

export const writeNewTypeU32: Serializer<NewTypeU32> = write_u32;

export const writeAliasToStr: Serializer<AliasToStr> = write_str;

export const writeMyTuple = (sink: Sink, val: MyTuple): Sink =>
  writeVecStr(writeNullableBool(sink, val[0]), val[1]);

const writeSimpleUnion_BoolAndU32 = (
  sink: Sink,
  val: SimpleUnion_BoolAndU32
): Sink => write_u32(writeOptBool(sink, val[0]), val[1]);

const writeSimpleUnion_StructVariant = (
  sink: Sink,
  { id, tuple }: SimpleUnion_StructVariant
): Sink => writeMyTuple(write_str(sink, id), tuple);

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
): Sink => writeMyTuple(write_u8(sink, u8), myTuple);

// Deserializers

const readOptBool: Deserializer<(boolean) | undefined> = opt_reader(read_bool);

const readNullableBool: Deserializer<(boolean) | null> = nullable_reader(
  read_bool
);

const readVecStr: Deserializer<Array<string>> = seq_reader(read_str);

const MyEnumReverseMap: MyEnum[] = [MyEnum.One, MyEnum.Two, MyEnum.Three];

export const readMyEnum = (sink: Sink): MyEnum =>
  MyEnumReverseMap[read_u32(sink)];

export const readNewTypeU32 = (sink: Sink): NewTypeU32 =>
  NewTypeU32(read_u32(sink));

export const readAliasToStr: Deserializer<AliasToStr> = read_str;

export const readMyTuple = (sink: Sink): MyTuple =>
  MyTuple(readNullableBool(sink), readVecStr(sink));

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
  const tuple = readMyTuple(sink);
  return { id, tuple };
};

export const readJustAStruct = (sink: Sink): JustAStruct => {
  const u8 = read_u8(sink);
  const myTuple = readMyTuple(sink);
  return { u8, myTuple };
};
