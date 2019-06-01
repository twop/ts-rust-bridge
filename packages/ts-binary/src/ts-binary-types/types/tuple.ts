import { BinType, Static, bindesc, createBinType, TypeTag } from '../core';
import { Serializer, Deserializer } from '../..';

export interface Tuple2<A extends BinType<any>, B extends BinType<any>>
  extends BinType<
    TypeTag.Tuple,
    [Static<A>, Static<B>],
    { components: [A, B] }
  > {
  (a: Static<A>, b: Static<B>): [Static<A>, Static<B>];
}

export interface RTuple2<A extends BinType<any>, B extends BinType<any>, Alias>
  extends BinType<TypeTag.Tuple, Alias, { components: [A, B] }> {
  (a: Static<A>, b: Static<B>): Alias;
}

export interface Tuple3<
  A extends BinType<any>,
  B extends BinType<any>,
  C extends BinType<any>
>
  extends BinType<
    TypeTag.Tuple,
    [Static<A>, Static<B>, Static<C>],
    { components: [A, B, C] }
  > {
  (a: Static<A>, b: Static<B>, c: Static<C>): [Static<A>, Static<B>, Static<C>];
}

export interface RTuple3<
  A extends BinType<any>,
  B extends BinType<any>,
  C extends BinType<any>,
  Alias
> extends BinType<TypeTag.Tuple, Alias, { components: [A, B, C] }> {
  (a: Static<A>, b: Static<B>, c: Static<C>): Alias;
}

export function Tuple<A extends BinType<any>, B extends BinType<any>>(
  A: A,
  B: B
): Tuple2<A, B>;
export function Tuple<
  A extends BinType<any>,
  B extends BinType<any>,
  C extends BinType<any>
>(a: A, b: B, c: C): Tuple3<A, B, C>;
export function Tuple(...components: BinType<any>[]): any {
  let ctor: (...args: any) => any;

  const serializers = components.map(c => c[bindesc].write);
  const deserializers = components.map(c => c[bindesc].read);

  let write: Serializer<any[]> | undefined;
  let read: Deserializer<any[]> | undefined;

  switch (components.length) {
    // case 1: {
    //   ctor = a => [a];
    //   const [s0] = serializers;
    //   write = (sink, tuple) => s0(sink, tuple[0]);
    //   const [d0] = deserializers;
    //   read = sink => ctor(d0(sink));
    //   break;
    // }
    case 2: {
      ctor = (a, b) => [a, b];

      const [s0, s1] = serializers;
      write = (sink, [a, b]) => s1(s0(sink, a), b);

      const [d0, d1] = deserializers;
      read = sink => ctor(d0(sink), d1(sink));
      break;
    }
    case 3: {
      ctor = (a, b, c) => [a, b, c];

      const [s0, s1, s2] = serializers;
      write = (sink, [a, b, c]) => s2(s1(s0(sink, a), b), c);

      const [d0, d1, d2] = deserializers;
      read = sink => ctor(d0(sink), d1(sink), d2(sink));
      break;
    }
    default:
      throw new Error('invalid number of components for tuple');
  }

  return createBinType(read, write, TypeTag.Tuple, { components }, ctor);
}
