# WIP

WARNING: The tool is far from being ready: no tests, no documentation, missing features. That said, you are welcome to take a look and give feedback.

## Goal

The goal of the this project is to provide a toolset to build efficient communication between rust and typescript.

## Example

Define AST(ish) structure in typescript. Note that it is a small subset of `serde` types from rust ecosystem.

```ts
import { EntryType, T, Variant as V } from '../src/schema';

const Message = EntryType.Union('Message', [
  V.Unit('Unit'),
  V.NewType('One', T.Scalar.F32),
  V.Tuple('Two', [T.Option(T.Scalar.Bool), T.Scalar.F32]),
  V.Struct('VStruct', { id: T.Scalar.Str, data: T.Scalar.Str })
]);
```

Then codegen typescript and rust:

```ts
import { schema2rust, schema2ts } from '../src/index';

const tsCode = schema2ts([Message]).join('\n\n');
const rustCode = schema2rust([Message]).join('\n\n');
```

And here is the result:

rust

```rs
#[derive(Deserialize, Debug, Clone)]
#[serde(tag = "tag", content = "value")]
pub enum Message {
    Unit,
    One(f32),
    Two(Option<bool>, f32),
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

Now you can serialize them as JSON.

Note: bincode support is also WIP in the `ts-rust-bridge-bincode` repo.

Look at `examples` dir for more details.
