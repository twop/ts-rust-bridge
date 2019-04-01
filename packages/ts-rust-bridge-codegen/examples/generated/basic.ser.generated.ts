import {
  Message,
  Message_Two,
  Message_VStruct,
  NType,
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
  write_u8,
  write_seq,
  Sink,
  SerFunc
} from '../../src/ser/ser';

const writeOptBool = (sink: Sink, val: (boolean) | undefined): Sink =>
  write_opt(sink, val, write_bool);

const writeVecStr = (sink: Sink, val: Array<string>): Sink =>
  write_seq(sink, val, write_str);

const writeVecOptVecStr = (
  sink: Sink,
  val: Array<(Array<string>) | undefined>
): Sink => write_seq(sink, val, writeOptVecStr);

const writeOptVecStr = (sink: Sink, val: (Array<string>) | undefined): Sink =>
  write_opt(sink, val, writeVecStr);

const MessageMap: { [key: string]: number } = {
  Unit: 0,
  AnotherUnit: 1,
  One: 2,
  Two: 3,
  VStruct: 4
};

export const writeMessage = (sink: Sink, val: Message): Sink => {
  const s = write_u32(sink, MessageMap[val.tag]);

  if (val.tag === 'One') {
    return write_f32(s, val.value);
  }
  if (val.tag === 'Two') {
    return writeMessage_Two(s, val.value);
  }
  if (val.tag === 'VStruct') {
    return writeMessage_VStruct(s, val.value);
  }
  return s;
};

const writeMessage_Two = (sink: Sink, val: Message_Two): Sink =>
  write_u32(writeOptBool(sink, val[0]), val[1]);

const writeMessage_VStruct = (
  sink: Sink,
  { id, data }: Message_VStruct
): Sink => write_str(write_str(sink, id), data);

export const writeNType: SerFunc<NType> = write_u32;

export const writeNormalStruct = (
  sink: Sink,
  { a, tuple }: NormalStruct
): Sink => writeTuple(write_u8(sink, a), tuple);

const EnumMap: { [key: string]: number } = { ONE: 0, TWO: 1, THREE: 2 };

export const writeEnum = (sink: Sink, val: Enum): Sink =>
  write_u32(sink, EnumMap[val]);

export const writeTuple = (sink: Sink, val: Tuple): Sink =>
  writeVecStr(writeOptBool(sink, val[0]), val[1]);

export const writeAha: SerFunc<Aha> = writeVecOptVecStr;
