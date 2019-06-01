import { Deserializer, Serializer } from '..';
// import { Omit } from 'yargs';

export const bindesc = Symbol('bindesc');

interface BinTypeDesc<TTag extends string, T = any> {
  read: Deserializer<T>;
  write: Serializer<T>;
  tag: TTag;
  _phantomType: T;
}

type Omit<ToExclude, T> = Pick<T, Exclude<keyof T, ToExclude>>;

// type Keys<R> = keyof R;

// type t = Omit<typeof runtype, { [runtype]: 'bla' }>;

// type t = Pick

export interface BinType<TypeTag extends string, T = any, Extra = {}> {
  [bindesc]: BinTypeDesc<TypeTag, T> & Extra;
}

export type Static<
  A extends BinType<any, any>
> = A[typeof bindesc]['_phantomType'];

export const createBinType = <R extends BinType<any, any>>(
  read: Deserializer<Static<R>>,
  write: Serializer<Static<R>>,
  tag: R[typeof bindesc]['tag'],
  extra: Omit<'read' | 'write' | 'tag' | '_phantomType', R[typeof bindesc]>,
  baseObj: Omit<typeof bindesc, R>
): R => {
  (baseObj as any)[bindesc] = Object.assign(extra, { read, write, tag });
  return baseObj as any;
};

// export const createRuntype2 = <R extends Runtype<any, any>>(
//   typeData: R[typeof runtype],
//   baseObj: any = {}
// ): R => {
//   baseObj[runtype] = typeData;
//   return baseObj as any;
// };

// export const Tuple2 = createRuntype<Tuple2>(
//   read_bool,
//   write_bool,
//   'boolean',
//   {},
//   {}
// );

// type All = Option<any> | Bool;

// const f = (rt: All) =>{
//     const data = rt[runtype];

//     if (data.tag === 'option') {
//         data.type
//     }
// }

export enum TypeTag {
  Bool = 'Bool',
  Str = 'Str',
  U32 = 'U32',
  F32 = 'F32',
  U16 = 'U16',
  I32 = 'I32',
  U8 = 'U8',
  Enum = 'Enum',
  Struct = 'Struct',
  Tuple = 'Tuple',
  Union = 'Union',
  Option = 'Option',
  Vec = 'Vec'
}
