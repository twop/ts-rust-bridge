# ts-binary

A collection of helper functions to serialize/deserialize primitive types in typescript. It is designed to be a building block rather than a standalone library.

## Install

`npm install ts-binary --save`

## Example

```ts
import { Sink, write_str, read_str, write_f32, read_f32 } from 'ts-binary';

let sink: Sink = {
  arr: new Uint8Array(100), // resized automatically if needed
  pos: 0
};

sink = write_str(sink, 'abc');
sink = write_f32(sink, 3.14);

sink.pos = 0; // reset position to read from the beginning
const str = read_str(sink); // 'abc'
const num = read_f32(sink); // 3.14, actually 3.140000104904175 :)
```

## Why

The project was created as a way to communicate between rust and typescript (checkout https://github.com/cztomsik/stain). For a while we used json, but it wasn't efficient enough (plus there were some pain points to maintain type compatibility between rust and typescript). Rust already had a standard way to serialize stuff: https://serde.rs/ + https://github.com/TyOverby/bincode. So the solution was to adopt serde type system + binary layout from bincode.

The idea:

1. Codegen contract types based on the schema + codegen serializers/deserializers for them.
2. Write a small library to serialize/deserialize primitive types (string, boolean, optional, sequence, f32, u32, ...)

This library is an implementation of 2)

## Design goals

1. Be compatible with bincode and serde (https://github.com/TyOverby/bincode)
2. Fast -> try to be JIT friendly if possible
3. Small -> optimized for js minification (it is just a collection of functions)
4. Designed as a building block -> it doesn't do much outside of serializing/deserializing primitive types.
5. Should work across all modern runtimes (browsers + node)

## Api

the api is based on three concepts:

```ts
type Sink = {
  pos: number;
  arr: Uint8Array;
};

type Serializer<T> = (sink: Sink, val: T) => Sink;
type Deserializer<T> = (sink: Sink) => T;
```

`Sink` is used for both serialization and deserialization. It is just a buffer with a current position to read/write from. Sink instance is designed to be reused (normally you will have a single buffer/sink to read and write from).

`Serializer<T>` is a function that writes a value of type T to the `sink` starting from `sink.pos` (moves `pos` in the process). It is assumed that it will resize the buffer if it needs more space (important if you want to implement custom serializers). Note that it always returns a `Sink` which can be a brand new instance. You **cannot** rely on that the initial sink will be mutated, always use the returned value instead.

`Deserializer<T>` is a function that reads a value of type T from the `sink` starting from `sink.pos` (moves `pos` in the process). Deserializers in this library **don't** check for out of boundary cases. It is assumed that the correct data is just there.

And because these are just types/conventions it is easy to support custom types. Which is exactly how more complex data structures are handled in [ts-rust-bridge-codegen](https://github.com/twop/ts-rust-bridge/tree/master/packages/ts-rust-bridge-codegen)

### Supported primitives

At the moment only the list of supported types:

`u8, u16, u32, u64, i32, f32, f64, string, boolean, Option<T>, Sequence<T>`.

Caveat: u64 is serialized as 8 bytes but only 4 bytes are actually being used. Which means that technically only u32 values are supported (but nothing stops you from implementing that yourself :) ).

### Numbers:

```ts
const write_u8: Serializer<number>;
const write_u16: Serializer<number>;
const write_u32: Serializer<number>;
const write_u64: Serializer<number>;
const write_f32: Serializer<number>;
const write_f64: Serializer<number>;
const write_i32: Serializer<number>;

const read_u8: Deserializer<number>;
const read_u16: Deserializer<number>;
const read_u32: Deserializer<number>;
const read_u64: Deserializer<number>;
const read_f32: Deserializer<number>;
const read_f64: Deserializer<number>;
const read_i32: Deserializer<number>;
```

### Strings

Note that strings are stored as UTF8 via `TextEncoder` class (and `TextDecoder` on the way back). It is serialized as u64 (number of bytes encoded) + UTF8 encoded string.

```ts
const write_str: Serializer<string>;
const read_str: Deserializer<string>;
```

### Bool

Encoded as 1 or 0 in a single byte.

```ts
const write_bool: Serializer<boolean>;
const read_bool: Deserializer<boolean>;
```

### Sequence

You can make new serializer and deserializer for `T[]` out of serializer/deserializer of type `T`. It encodes a sequence as u64 + serialized elements.

```ts
const seq_writer: <T>(serEl: Serializer<T>) => Serializer<T[]>;
const seq_reader: <T>(readEl: Deserializer<T>) => Deserializer<T[]>;
```

### Optional

Optionals are described as `T | undefined` (but not `null`). Encoded as 1 (one byte) followed up by a serialized value T if !== undefined or just 0 (one byte).

```ts
// similar to sequence they produce new serializer/deserializer
const opt_writer: <T>(serEl: Serializer<T>) => Serializer<T | undefined>;
const opt_reader: <T>(readEl: Deserializer<T>) => Deserializer<T | undefined>;
```

Caveat: `Option<Option<T>>` equals to just `Option<T>` in typescript, but in rust this is technically not true.

## Simple benchmarks

I just copypasted generated code from examples and tried to construct a simple benchmark.

Code
https://stackblitz.com/edit/ts-binaray-benchmark?file=index.ts

Version to try
https://ts-binaray-benchmark.stackblitz.io

On complex data structure:

| Method    | Serialization | Deserialization |
| --------- | :-----------: | --------------: |
| ts-binary |     74 ms     |           91 ms |
| JSON      |    641 ms     |          405 ms |

Simple data structure:

| Method    | Serialization | Deserialization |
| --------- | :-----------: | --------------: |
| ts-binary |     2 ms      |            1 ms |
| JSON      |     6 ms      |            5 ms |

That was measured on latest Safari version.

Note you can run the benchmark yourself cloning the repo + running npm scripts

## FAQ

### Why `_` in function names?

I wanted something that would signal if it is a library serializer vs custom in my generated code (I use camel casing for custom ones). Plus I didn't really like how `writeF32` looked :)

## License

MIT.
