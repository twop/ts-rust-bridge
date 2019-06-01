import {
  Message,
  Message_Two,
  Message_VStruct,
  NType,
  Container,
  Figure,
  Color,
  Vec3,
  NormalStruct,
  Tuple,
  Enum,
  Aha2,
  Aha
} from './basic.generated';

import {
  write_u32,
  write_f32,
  write_opt,
  write_bool,
  write_str,
  write_seq,
  write_u8,
  Sink,
  Serializer
} from '../../../ts-binary/src/index';

const writeOptBool: Serializer<(boolean) | undefined> = write_opt(write_bool);

export const writeVec3 = (sink: Sink, val: Vec3): Sink =>
  write_f32(write_f32(write_f32(sink, val[0]), val[1]), val[2]);

const writeVecVec3: Serializer<Array<Vec3>> = write_seq(writeVec3);

export const writeColor = (sink: Sink, val: Color): Sink =>
  write_u8(write_u8(write_u8(sink, val[0]), val[1]), val[2]);

const writeVecColor: Serializer<Array<Color>> = write_seq(writeColor);

export const writeFigure = (sink: Sink, { dots, colors }: Figure): Sink =>
  writeVecColor(writeVecVec3(sink, dots), colors);

const writeVecFigure: Serializer<Array<Figure>> = write_seq(writeFigure);

const writeVecStr: Serializer<Array<string>> = write_seq(write_str);

const writeOptVecStr: Serializer<(Array<string>) | undefined> = write_opt(
  writeVecStr
);

const writeVecOptVecStr: Serializer<
  Array<(Array<string>) | undefined>
> = write_seq(writeOptVecStr);

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

export const writeTuple = (sink: Sink, val: Tuple): Sink =>
  writeVecStr(writeOptBool(sink, val[0]), val[1]);

export const writeNormalStruct = (
  sink: Sink,
  { a, tuple }: NormalStruct
): Sink => writeTuple(write_u8(sink, a), tuple);

const EnumMap: { [key: string]: number } = { ONE: 0, TWO: 1, THREE: 2 };

export const writeEnum = (sink: Sink, val: Enum): Sink =>
  write_u32(sink, EnumMap[val]);

export const writeAha: Serializer<Aha> = writeVecOptVecStr;

export const writeAha2: Serializer<Aha2> = writeAha;
