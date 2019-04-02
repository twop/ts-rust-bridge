import { EntryT, EntryType, T, Variant as V } from '../src/schema';

const { Alias, Enum, Tuple, Struct, Union, Newtype } = EntryType;

const Bla = Alias('Aha', T.Vec(T.Option(T.Vec(T.Scalar.Str))));

const MyEnum = Enum('Enum', { variants: ['ONE', 'TWO', 'THREE'] });

const MyTuple = Tuple('Tuple', [T.Option(T.Scalar.Bool), T.Vec(T.Scalar.Str)]);

const NormalStruct = Struct('NormalStruct', {
  a: T.Scalar.U8,
  tuple: T.RefTo(MyTuple)
});

const Message = Union('Message', [
  V.Unit('Unit'),
  V.Unit('AnotherUnit'),
  V.NewType('One', T.Scalar.F32),
  V.Tuple('Two', [T.Option(T.Scalar.Bool), T.Scalar.U32]),
  V.Struct('VStruct', { id: T.Scalar.Str, data: T.Scalar.Str })
]);

const NType = Newtype('NType', T.Scalar.U32);

export const exampleEntries: EntryT[] = [
  Message,
  NType,
  // NewtypeAlias,
  NormalStruct,
  MyEnum,
  MyTuple,
  Bla
];

// // const NewtypeAlias = Alias('NewtypeAlias', T.Option(T.Scalar.Bool));
// const NewtypeAlias = Alias('NewtypeAlias', T.RefTo(NType));
