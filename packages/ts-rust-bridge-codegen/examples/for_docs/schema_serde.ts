import { Size, Shirt } from './schema';

import {
  write_u32,
  write_str,
  write_f32,
  Sink,
  read_u32,
  read_str,
  read_f32
} from '../../../ts-binary/src/index';

// Serializers

const SizeMap: { [key: string]: number } = { S: 0, M: 1, L: 2 };

export const writeSize = (sink: Sink, val: Size): Sink =>
  write_u32(sink, SizeMap[val]);

export const writeShirt = (sink: Sink, { size, color, price }: Shirt): Sink =>
  write_f32(write_str(writeSize(sink, size), color), price);

// Deserializers

const SizeReverseMap: Size[] = [Size.S, Size.M, Size.L];

export const readSize = (sink: Sink): Size => SizeReverseMap[read_u32(sink)];

export const readShirt = (sink: Sink): Shirt => {
  const size = readSize(sink);
  const color = read_str(sink);
  const price = read_f32(sink);
  return { size, color, price };
};
