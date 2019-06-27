// https://developer.mozilla.org/en-US/docs/Web/API/TextEncoder#Polyfill
export function encode(str: string, resArr: Uint8Array, pos: number): number {
  const Len = str.length;
  let resPos = pos - 1;
  // The Uint8Array's length must be at least 3x the length of the string because an invalid UTF-16
  //  takes up the equivelent space of 3 UTF-8 characters to encode it properly. However, Array's
  //  have an auto expanding length and 1.5x should be just the right balance for most uses.
  for (let point = 0, nextcode = 0, i = 0; i !== Len; ) {
    (point = str.charCodeAt(i)), (i += 1);
    if (point >= 0xd800 && point <= 0xdbff) {
      if (i === Len) {
        resArr[(resPos += 1)] = 0xef /*0b11101111*/;
        resArr[(resPos += 1)] = 0xbf /*0b10111111*/;
        resArr[(resPos += 1)] = 0xbd /*0b10111101*/;
        break;
      }
      // https://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
      nextcode = str.charCodeAt(i);
      if (nextcode >= 0xdc00 && nextcode <= 0xdfff) {
        point = (point - 0xd800) * 0x400 + nextcode - 0xdc00 + 0x10000;
        i += 1;
        if (point > 0xffff) {
          resArr[(resPos += 1)] = (0x1e /*0b11110*/ << 3) | (point >>> 18);
          resArr[(resPos += 1)] =
            (0x2 /*0b10*/ << 6) | ((point >>> 12) & 0x3f) /*0b00111111*/;
          resArr[(resPos += 1)] =
            (0x2 /*0b10*/ << 6) | ((point >>> 6) & 0x3f) /*0b00111111*/;
          resArr[(resPos += 1)] =
            (0x2 /*0b10*/ << 6) | (point & 0x3f) /*0b00111111*/;
          continue;
        }
      } else {
        resArr[(resPos += 1)] = 0xef /*0b11101111*/;
        resArr[(resPos += 1)] = 0xbf /*0b10111111*/;
        resArr[(resPos += 1)] = 0xbd /*0b10111101*/;
        continue;
      }
    }
    if (point <= 0x007f) {
      resArr[(resPos += 1)] = (0x0 /*0b0*/ << 7) | point;
    } else if (point <= 0x07ff) {
      resArr[(resPos += 1)] = (0x6 /*0b110*/ << 5) | (point >>> 6);
      resArr[(resPos += 1)] =
        (0x2 /*0b10*/ << 6) | (point & 0x3f) /*0b00111111*/;
    } else {
      resArr[(resPos += 1)] = (0xe /*0b1110*/ << 4) | (point >>> 12);
      resArr[(resPos += 1)] =
        (0x2 /*0b10*/ << 6) | ((point >>> 6) & 0x3f) /*0b00111111*/;
      resArr[(resPos += 1)] =
        (0x2 /*0b10*/ << 6) | (point & 0x3f) /*0b00111111*/;
    }
  }

  return resPos + 1 - pos;
}
