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

const writeOptBool = (sink: Sink, val: (boolean) | undefined): Sink =>
  write_opt(sink, val, write_bool);

const writeVecFigure = (sink: Sink, val: Array<Figure>): Sink =>
  write_seq(sink, val, writeFigure);

const writeVecVec3 = (sink: Sink, val: Array<Vec3>): Sink =>
  write_seq(sink, val, writeVec3);

const writeVecColor = (sink: Sink, val: Array<Color>): Sink =>
  write_seq(sink, val, writeColor);

const writeVecStr = (sink: Sink, val: Array<string>): Sink =>
  write_seq(sink, val, write_str);

const writeVecOptVecStr = (
  sink: Sink,
  val: Array<(Array<string>) | undefined>
): Sink => write_seq(sink, val, writeOptVecStr);

const writeOptVecStr = (sink: Sink, val: (Array<string>) | undefined): Sink =>
  write_opt(sink, val, writeVecStr);

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

const writeMessage_Two = (sink: Sink, val: Message_Two): Sink =>
  write_u32(writeOptBool(sink, val[0]), val[1]);

const writeMessage_VStruct = (
  sink: Sink,
  { id, data }: Message_VStruct
): Sink => write_str(write_str(sink, id), data);

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

export const writeColor = (sink: Sink, val: Color): Sink =>
  write_u8(write_u8(write_u8(sink, val[0]), val[1]), val[2]);

export const writeFigure = (sink: Sink, { dots, colors }: Figure): Sink =>
  writeVecColor(writeVecVec3(sink, dots), colors);

export const writeVec3 = (sink: Sink, val: Vec3): Sink =>
  write_f32(write_f32(write_f32(sink, val[0]), val[1]), val[2]);

export const writeNormalStruct = (
  sink: Sink,
  { a, tuple }: NormalStruct
): Sink => writeTuple(write_u8(sink, a), tuple);

const EnumMap: { [key: string]: number } = { ONE: 0, TWO: 1, THREE: 2 };

export const writeEnum = (sink: Sink, val: Enum): Sink =>
  write_u32(sink, EnumMap[val]);

export const writeTuple = (sink: Sink, val: Tuple): Sink =>
  writeVecStr(writeOptBool(sink, val[0]), val[1]);

export const writeAha: Serializer<Aha> = writeVecOptVecStr;
