import { writeShirt, readShirt } from './schema_serde';
import { Shirt, Size } from './schema';
import { Sink } from '../../../ts-binary/src/index';

const shirt: Shirt = { color: 'red', price: 10, size: Size.L };

let sink = writeShirt(Sink(new ArrayBuffer(100)), shirt);

console.log('bytes:', new Uint8Array(sink.view.buffer, 0, sink.pos));
// bytes: Uint8Array
// [
// 2, 0, 0, 0, <- Size.L
// 3, 0, 0, 0, 0, 0, 0, 0, <- number of bytes for 'red' in utf-8
// 114, 101, 100, <-- 'r', 'e', 'd'
// 0, 0, 32, 65 <-- 10 as float 32 byte representation
// ]

// reset pos to read value back
sink.pos = 0;
const restoredShirt = readShirt(sink);
console.log('restored:', restoredShirt);
// restored: { size: 'L', color: 'red', price: 10 }
