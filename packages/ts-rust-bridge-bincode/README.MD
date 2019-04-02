# WIP

WARNING: The tool is far from being ready: no tests, no documentation, missing features. That said, you are welcome to take a look and give feedback.

## Goal

A collection of helper functions to serialize data structures in typescript to rust bincode format

## Example

Define AST(ish) structure in typescript. Note that it is a small subset of `serde` types from rust ecosystem.

```ts
import { EntryType, T, Variant as V } from '../src/schema';

const Message = EntryType.Union('Message', [
  V.Unit('Unit'),
  V.NewType('One', T.Scalar.F32),
  V.Tuple('Two', [T.Option(T.Scalar.Bool), T.Scalar.U32]),
  V.Struct('VStruct', { id: T.Scalar.Str, data: T.Scalar.Str })
]);
```

rust

```rusts
#[derive(Deserialize, Debug, Clone)]
#[serde(tag = "tag", content = "value")]
pub enum Message {
    Unit,
    One(f32),
    Two(Option<bool>, u32),
    VStruct { id: String, data: String },
}
```

typescript

```ts
export type Message =
  | { tag: 'Unit' }
  | { tag: 'One'; value: number }
  | { tag: 'Two'; value: [(boolean) | undefined, number] }
  | { tag: 'VStruct'; value: MessageVStruct };

export interface MessageVStruct {
  id: string;
  data: string;
}

export module Message {
  export const Unit: Message = { tag: 'Unit' };

  export const One = (value: number): Message => ({ tag: 'One', value });

  export const Two = (p0: (boolean) | undefined, p1: number): Message => ({
    tag: 'Two',
    value: [p0, p1]
  });

  export const VStruct = (value: MessageVStruct): Message => ({
    tag: 'VStruct',
    value
  });
}
```

Now let's try to serialize it to bincode format

```ts
import { Sink, SerFunc } from 'ts-rust-bridge-bincode';

// generated serialization file
import { writeMessage} from './generated/basic.ser.generated';

// generated types file
import { Message } from './basic.generated';

let sink: Sink = {
  arr: new Uint8Array(1), // it automatically grows, so let's start with 1
  pos: 0
};

// serialize a data structure to the sink and make a new slice of it
const writeAThing = <T>(thing: T, ser: SerFunc<T>): Uint8Array => {
  sink.pos = 0;
  sink = ser(sink, thing);
  return sink.arr.slice(0, sink.pos);
};

writeAThing(Message.Two(true, 7), writeMessage);
// [ 3, 0, 0, 0, 0, 0, 0, 0, 84, 119, 111, 1, 1, 7, 0, 0, 0 ] 

// [ 3, 0, 0, 0, 0, 0, 0, 0 ] -> u64 === 3 (len of "Two")
// [ 84, 119, 111 ] -> "Two"
// 1 -> Some. Yes we have a value
// 1 -> true. And the value is "true"
// [ 7, 0, 0, 0 ] -> u32 === 7 
```

Note that we serialize variant tag as a string "Two" because of `#[serde(tag = "tag", content = "value")]` in rust defenition. Without it "Two" can be serialized as u32 instead.


Look at `examples` under `ts-rust-bridge-codegen` dir for more details.
