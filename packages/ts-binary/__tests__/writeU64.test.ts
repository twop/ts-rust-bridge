import { Sink, write_u64, write_u8, read_u8 } from '../src/index';

test('it writes 8 bytes', () => {
  // Fill with 2s.
  let sink = Sink(new ArrayBuffer(8));
  for (let i = 0; i < 8; i++) {
    sink = write_u8(sink, 2);
  }

  // Should write out a single 1 and 7 0's, no matter the endianness.
  sink.pos = 0;
  sink = write_u64(sink, 1);

  // No byte from the original write should remain.
  sink.pos = 0;
  for (let i = 0; i < 8; i++) {
    expect(read_u8(sink)).toBeLessThan(2);
  }
});
