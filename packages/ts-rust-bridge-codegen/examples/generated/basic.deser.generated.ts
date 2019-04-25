import {
  Message,
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
  read_u32,
  read_f32,
  read_opt,
  read_bool,
  read_str,
  read_seq,
  read_u8,
  Sink,
  Deserializer
} from '../../../ts-binary/src/index';

const readOptBool = (sink: Sink): (boolean) | undefined =>
  read_opt(sink, read_bool);

const readVecFigure = (sink: Sink): Array<Figure> => read_seq(sink, readFigure);

const readVecVec3 = (sink: Sink): Array<Vec3> => read_seq(sink, readVec3);

const readVecColor = (sink: Sink): Array<Color> => read_seq(sink, readColor);

const readVecStr = (sink: Sink): Array<string> => read_seq(sink, read_str);

const readVecOptVecStr = (sink: Sink): Array<(Array<string>) | undefined> =>
  read_seq(sink, readOptVecStr);

const readOptVecStr = (sink: Sink): (Array<string>) | undefined =>
  read_opt(sink, readVecStr);

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

export const readColor = (sink: Sink): Color =>
  Color(read_u8(sink), read_u8(sink), read_u8(sink));

export const readFigure = (sink: Sink): Figure => {
  const dots = readVecVec3(sink);
  const colors = readVecColor(sink);
  return { dots, colors };
};

export const readVec3 = (sink: Sink): Vec3 =>
  Vec3(read_f32(sink), read_f32(sink), read_f32(sink));

export const readNormalStruct = (sink: Sink): NormalStruct => {
  const a = read_u8(sink);
  const tuple = readTuple(sink);
  return { a, tuple };
};

const EnumReverseMap: Enum[] = [Enum.ONE, Enum.TWO, Enum.THREE];

export const readEnum = (sink: Sink): Enum => EnumReverseMap[read_u32(sink)];

export const readTuple = (sink: Sink): Tuple =>
  Tuple(readOptBool(sink), readVecStr(sink));

export const readAha: Deserializer<Aha> = readVecOptVecStr;
