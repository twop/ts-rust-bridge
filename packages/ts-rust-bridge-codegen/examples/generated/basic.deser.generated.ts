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
  Aha2,
  Aha
} from './basic.generated';

import {
  read_u32,
  read_f32,
  opt_reader,
  read_bool,
  read_str,
  seq_reader,
  read_u8,
  Sink,
  Deserializer
} from '../../../ts-binary/src/index';

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

const readVecStr: Deserializer<Array<string>> = seq_reader(read_str);

const readOptVecStr: Deserializer<(Array<string>) | undefined> = opt_reader(
  readVecStr
);

const readVecOptVecStr: Deserializer<
  Array<(Array<string>) | undefined>
> = seq_reader(readOptVecStr);

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

export const readTuple = (sink: Sink): Tuple =>
  Tuple(readOptBool(sink), readVecStr(sink));

export const readNormalStruct = (sink: Sink): NormalStruct => {
  const a = read_u8(sink);
  const tuple = readTuple(sink);
  return { a, tuple };
};

const EnumReverseMap: Enum[] = [Enum.ONE, Enum.TWO, Enum.THREE];

export const readEnum = (sink: Sink): Enum => EnumReverseMap[read_u32(sink)];

export const readAha: Deserializer<Aha> = readVecOptVecStr;

export const readAha2: Deserializer<Aha2> = readAha;
