import { EntryT, EntryType, T, Variant as V } from '../src/schema';

const { Struct, Union, Newtype, Alias, Enum, Tuple } = EntryType;

const Message = Union('Message', [
  V.Unit('Unit'),
  V.NewType('One', T.Scalar.F32),
  V.Tuple('Two', [T.Option(T.Scalar.Bool), T.Scalar.F32]),
  V.Struct('VStruct', { id: T.Scalar.Str, data: T.Scalar.Str })
]);

const NewType = Newtype('Newtype', T.Scalar.U32);
const NewtypeAlias = Alias('NewtypeAlias', T.RefTo(NewType));

const NormalStruct = Struct('NormalStruct', {
  a: T.Scalar.F32,
  msg: T.RefTo(Message)
});

const MyEnum = Enum('Enum', { variants: ['ONE', 'TWO', 'THREE'] });

const MyTuple = Tuple('Tuple', [T.Option(T.Scalar.Bool), T.Vec(T.Scalar.Str)]);

export const exampleEntries: EntryT[] = [
  Message,
  NewType,
  NewtypeAlias,
  NormalStruct,
  MyEnum,
  MyTuple
];
