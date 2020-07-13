import {
  Message,
  Message_Two,
  Message_VStruct,
  NType,
  Container,
  Figure,
  Color,
  Vec3,
  NewtypeAlias,
  NormalStruct,
  MyTuple,
  MyEnum
} from './simple.g';

import {
  write_u32,
  write_f32,
  opt_writer,
  write_bool,
  write_str,
  seq_writer,
  write_u8,
  nullable_writer,
  Sink,
  Serializer,
  read_u32,
  read_f32,
  opt_reader,
  read_bool,
  read_str,
  seq_reader,
  read_u8,
  nullable_reader,
  Deserializer
} from '../../../ts-binary/src/index';

// Serializers

const writeOptBool: Serializer<(boolean) | undefined> = opt_writer(write_bool);

export const writeVec3 = (sink: Sink, val: Vec3): Sink =>
  write_f32(write_f32(write_f32(sink, val[0]), val[1]), val[2]);

const writeVecVec3: Serializer<Array<Vec3>> = seq_writer(writeVec3);

export const writeColor = (sink: Sink, val: Color): Sink =>
  write_u8(write_u8(write_u8(sink, val[0]), val[1]), val[2]);

const writeVecColor: Serializer<Array<Color>> = seq_writer(writeColor);

export const writeFigure = (sink: Sink, { dots, colors }: Figure): Sink =>
  writeVecColor(writeVecVec3(sink, dots), colors);

const writeVecFigure: Serializer<Array<Figure>> = seq_writer(writeFigure);

const writeNullableBool: Serializer<(boolean) | null> = nullable_writer(
  write_bool
);

const writeVecStr: Serializer<Array<string>> = seq_writer(write_str);

const writeMessage_Two = (sink: Sink, val: Message_Two): Sink =>
  write_u32(writeOptBool(sink, val[0]), val[1]);

const writeMessage_VStruct = (
  sink: Sink,
  { id, data }: Message_VStruct
): Sink => write_str(write_str(sink, id), data);

export const writeMessage = (sink: Sink, val: Message): Sink => {
  switch (val.tag) {
    case 'Unit':
      return write_u32(sink, 0);
    case 'One':
      return write_f32(write_u32(sink, 1), val.value);
    case 'Two':
      return writeMessage_Two(write_u32(sink, 2), val.value);
    case 'VStruct':
      return writeMessage_VStruct(write_u32(sink, 3), val.value);
  }
};

export const writeNType: Serializer<NType> = write_u32;

export const writeContainer = (sink: Sink, val: Container): Sink => {
  switch (val.tag) {
    case 'Units':
      return write_u32(sink, 0);
    case 'JustNumber':
      return write_u32(write_u32(sink, 1), val.value);
    case 'Figures':
      return writeVecFigure(write_u32(sink, 2), val.value);
  }
};

export const writeNewtypeAlias: Serializer<NewtypeAlias> = writeNType;

export const writeMyTuple = (sink: Sink, val: MyTuple): Sink =>
  writeVecStr(writeNullableBool(sink, val[0]), val[1]);

export const writeNormalStruct = (
  sink: Sink,
  { a, tuple }: NormalStruct
): Sink => writeMyTuple(write_u8(sink, a), tuple);

const MyEnumMap: { [key: string]: number } = { ONE: 0, TWO: 1, THREE: 2 };

export const writeMyEnum = (sink: Sink, val: MyEnum): Sink =>
  write_u32(sink, MyEnumMap[val]);

// Deserializers

const readOptBool: Deserializer<(boolean) | undefined> = opt_reader(read_bool);

export const readVec3 = (sink: Sink): Vec3 =>
  Vec3(read_f32(sink), read_f32(sink), read_f32(sink));

const readVecVec3: Deserializer<Array<Vec3>> = seq_reader(readVec3);

export const readColor = (sink: Sink): Color =>
  Color(read_u8(sink), read_u8(sink), read_u8(sink));

const readVecColor: Deserializer<Array<Color>> = seq_reader(readColor);

export const readFigure = (sink: Sink): Figure => {
  const dots = readVecVec3(sink);
  const colors = readVecColor(sink);
  return { dots, colors };
};

const readVecFigure: Deserializer<Array<Figure>> = seq_reader(readFigure);

const readNullableBool: Deserializer<(boolean) | null> = nullable_reader(
  read_bool
);

const readVecStr: Deserializer<Array<string>> = seq_reader(read_str);

export const readMessage = (sink: Sink): Message => {
  switch (read_u32(sink)) {
    case 0:
      return Message.Unit;
    case 1:
      return Message.One(read_f32(sink));
    case 2:
      return Message.Two(readOptBool(sink), read_u32(sink));
    case 3:
      return Message.VStruct(readMessage_VStruct(sink));
  }
  throw new Error('bad variant index for Message');
};

const readMessage_VStruct = (sink: Sink): Message_VStruct => {
  const id = read_str(sink);
  const data = read_str(sink);
  return { id, data };
};

export const readNType = (sink: Sink): NType => NType(read_u32(sink));

export const readContainer = (sink: Sink): Container => {
  switch (read_u32(sink)) {
    case 0:
      return Container.Units;
    case 1:
      return Container.JustNumber(read_u32(sink));
    case 2:
      return Container.Figures(readVecFigure(sink));
  }
  throw new Error('bad variant index for Container');
};

export const readNewtypeAlias: Deserializer<NewtypeAlias> = readNType;

export const readMyTuple = (sink: Sink): MyTuple =>
  MyTuple(readNullableBool(sink), readVecStr(sink));

export const readNormalStruct = (sink: Sink): NormalStruct => {
  const a = read_u8(sink);
  const tuple = readMyTuple(sink);
  return { a, tuple };
};

const MyEnumReverseMap: MyEnum[] = [MyEnum.ONE, MyEnum.TWO, MyEnum.THREE];

export const readMyEnum = (sink: Sink): MyEnum =>
  MyEnumReverseMap[read_u32(sink)];
