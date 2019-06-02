import { Tuple, RTuple } from './types/tuple';
import { Static } from './core';
import { RStruct, Struct } from './types/struct';

export const retype = <TBin extends Tuple<any> | Struct<any>>(
  bintype: TBin
) => ({
  as: <T extends Static<TBin>>(): Static<TBin> extends T
    ? TBin extends Tuple<infer C>
      ? RTuple<C, T>
      : TBin extends Struct<infer Fields>
      ? RStruct<Fields, T>
      : never
    : never => bintype as any
});
