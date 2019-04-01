import {
  writeMessage,
  writeEnum,
  writeNormalStruct
} from './generated/basic.ser.generated';
import { Sink, SerFunc } from '../src/ser/ser';
import {
  NormalStruct,
  Message,
  Enum,
  Tuple
} from './generated/basic.generated';

let sink: Sink = {
  arr: new Uint8Array(1), // for testing purposes,
  pos: 0
};

const writeAThing = <T>(thing: T, ser: SerFunc<T>): Uint8Array => {
  sink.pos = 0;
  sink = ser(sink, thing);
  return sink.arr.slice(0, sink.pos);
};

// const msg = Message.One(7);
const msg = Message.Two(true, 7);
console.log('message', JSON.stringify(msg), writeAThing(msg, writeMessage));

const en = Enum.ONE;
console.log('enum', JSON.stringify(en), writeAThing(en, writeEnum));

const struct: NormalStruct = { a: 13, tuple: Tuple.mk(true, ['a', 'b']) };
console.log(
  'struct',
  JSON.stringify(struct),
  writeAThing(struct, writeNormalStruct)
);
