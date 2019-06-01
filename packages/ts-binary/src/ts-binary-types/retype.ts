import { Tuple2, Tuple3, RTuple2, RTuple3 } from './types/tuple';
import { Static } from './core';
import { RStruct, Struct } from './types/struct';

export const retype = <
  TBin extends Tuple2<any, any> | Tuple3<any, any, any> | Struct<any>
>(
  bintype: TBin
) => ({
  as: <T extends Static<TBin>>(): Static<TBin> extends T
    ? TBin extends Tuple2<infer A, infer B>
      ? RTuple2<A, B, T>
      : TBin extends Tuple3<infer A, infer B, infer C>
      ? RTuple3<A, B, C, T>
      : TBin extends Struct<infer Fields>
      ? RStruct<Fields, T>
      : never
    : never => bintype as any
});
