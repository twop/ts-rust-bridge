import {
  writeMessage,
  writeEnum,
  writeNormalStruct
} from './generated/basic.ser.generated';
import {
  Sink,
  SerFunc,
  write_str
} from '../../ts-rust-bridge-bincode/src/index';

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

const str = 'AnotherUnit';
console.log('tag', JSON.stringify(str), writeAThing(str, write_str));

// const msg = Message.One(7);
// [3, 0, 0, 0, 0, 0, 0, 0, 84, 119, 111, 1, 1, 7, 0, 0, 0]
// [ 3, 0, 0, 0, 1, 1, 7, 0, 0, 0 ]
// [ 3, 0, 0, 0, 1, 1, 7, 0, 0, 0 ]
const msg = Message.Two(true, 7);

// with tag [11, 0, 0, 0, 0, 0, 0, 0, 65, 110, 111, 116, 104, 101, 114, 85, 110, 105, 116]
// no tag [ 1, 0, 0, 0 ]
// const msg = Message.AnotherUnit;

// const msg = Message.VStruct({ id: 'в', data: 'п' });
console.log('message', JSON.stringify(msg), writeAThing(msg, writeMessage));

const en = Enum.ONE;
console.log('enum', JSON.stringify(en), writeAThing(en, writeEnum));

const struct: NormalStruct = { a: 13, tuple: Tuple.mk(true, ['ab', 'c']) };
console.log(
  'struct',
  JSON.stringify(struct),
  writeAThing(struct, writeNormalStruct)
);
