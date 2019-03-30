import { EntryT, EntryType, T, Variant as V } from '../src/schema';

const { Alias, Enum, Tuple, Struct, Union } = EntryType;

const Bla = Alias('Aha', T.Vec(T.Option(T.Vec(T.Scalar.Str))));

const MyEnum = Enum('Enum', { variants: ['ONE', 'TWO', 'THREE'] });

const MyTuple = Tuple('Tuple', [T.Option(T.Scalar.Bool), T.Vec(T.Scalar.Str)]);

const NormalStruct = Struct('NormalStruct', {
  a: T.Scalar.F32,
  tuple: T.RefTo(MyTuple)
});

const Message = Union('Message', [
  V.Unit('Unit'),
  V.NewType('One', T.Scalar.F32),
  V.Tuple('Two', [T.Option(T.Scalar.Bool), T.Scalar.F32]),
  V.Struct('VStruct', { id: T.Scalar.Str, data: T.Scalar.Str })
]);
export const exampleEntries: EntryT[] = [
  Message,
  // NType,
  // NewtypeAlias,
  NormalStruct,
  MyEnum,
  MyTuple,
  Bla
];

// const NType = Newtype('Newtype', T.Scalar.U32);
// // const NewtypeAlias = Alias('NewtypeAlias', T.Option(T.Scalar.Bool));
// const NewtypeAlias = Alias('NewtypeAlias', T.RefTo(NType));
