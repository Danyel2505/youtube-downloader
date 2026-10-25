import type { Prettify } from "@/types";

const IVF_SIGNATURE = "DKIF";
const IVF_SIGNATURE_BYTES = 4;
const IVF_MIN_HEADER_BYTES = 32;
const IVF_FRAME_HEADER_BYTES = 12;
const IVF_FOURCC_OFFSET = 8;
const IVF_WIDTH_OFFSET = 12;
const IVF_HEIGHT_OFFSET = 14;
const IVF_TIMEBASE_DENOMINATOR_OFFSET = 16;
const IVF_TIMEBASE_NUMERATOR_OFFSET = 20;
const IVF_DURATION_OFFSET = 24;
const IVF_UNKNOWN_DURATION = 0xFFFFFFFF;
const IVF_HEADER_LENGTH_OFFSET = 6;
const FRAME_PTS_OFFSET = 4;
const READ_BLOCK_BYTES = 4 * 1024 * 1024;
const MICROSECONDS_PER_SECOND = 1_000_000;

export type IvfHeader = Prettify<{
  fourcc: string;
  width: number;
  height: number;
  durationMicroseconds: number;
}>;

export type IvfFrame = Prettify<{
  timestampMicroseconds: number;
  data: Uint8Array;
}>;

function readFourcc(bytes: Uint8Array, offset: number) {
  return String.fromCharCode(...bytes.subarray(offset, offset + IVF_SIGNATURE_BYTES));
}

class BlockReader {
  private readonly file: File;
  private fileOffset = 0;
  private buffer: Uint8Array<ArrayBufferLike> = new Uint8Array(0);
  private position = 0;

  constructor(file: File) {
    this.file = file;
  }

  private getBufferedLength() {
    return this.buffer.length - this.position;
  }

  async read(length: number) {
    while (this.getBufferedLength() < length && this.fileOffset < this.file.size) {
      const block = new Uint8Array(
        await this.file.slice(this.fileOffset, this.fileOffset + READ_BLOCK_BYTES).arrayBuffer()
      );
      this.fileOffset += block.length;
      const remaining = this.buffer.subarray(this.position);
      const merged = new Uint8Array(remaining.length + block.length);
      merged.set(remaining);
      merged.set(block, remaining.length);
      this.buffer = merged;
      this.position = 0;
    }

    if (this.getBufferedLength() < length) {
      return null;
    }

    const bytes = this.buffer.slice(this.position, this.position + length);
    this.position += length;
    return bytes;
  }
}

export async function openIvf(file: File) {
  const reader = new BlockReader(file);
  const headerBytes = await reader.read(IVF_MIN_HEADER_BYTES);
  const isIvf = !!headerBytes && readFourcc(headerBytes, 0) === IVF_SIGNATURE;
  if (!headerBytes || !isIvf) {
    throw new Error("The extracted video is not a valid IVF stream");
  }

  const view = new DataView(headerBytes.buffer);
  const headerLength = view.getUint16(IVF_HEADER_LENGTH_OFFSET, true);
  const extraHeaderBytes = Math.max(0, headerLength - IVF_MIN_HEADER_BYTES);
  if (extraHeaderBytes > 0) {
    await reader.read(extraHeaderBytes);
  }

  const timebaseDenominator = view.getUint32(IVF_TIMEBASE_DENOMINATOR_OFFSET, true);
  const timebaseNumerator = view.getUint32(IVF_TIMEBASE_NUMERATOR_OFFSET, true);
  const secondsPerTick = timebaseDenominator > 0 ? timebaseNumerator / timebaseDenominator : 0;
  // The field after the timebase holds the stream's length in timebase ticks, not a frame count
  const durationTicks = view.getUint32(IVF_DURATION_OFFSET, true);
  const header: IvfHeader = {
    fourcc: readFourcc(headerBytes, IVF_FOURCC_OFFSET),
    width: view.getUint16(IVF_WIDTH_OFFSET, true),
    height: view.getUint16(IVF_HEIGHT_OFFSET, true),
    durationMicroseconds: durationTicks === IVF_UNKNOWN_DURATION
      ? 0
      : Math.round(durationTicks * secondsPerTick * MICROSECONDS_PER_SECOND)
  };

  async function* readFrames() {
    while (true) {
      const frameHeader = await reader.read(IVF_FRAME_HEADER_BYTES);
      if (!frameHeader) {
        return;
      }

      const frameView = new DataView(frameHeader.buffer);
      const data = await reader.read(frameView.getUint32(0, true));
      if (!data) {
        return;
      }

      const ticks = Number(frameView.getBigUint64(FRAME_PTS_OFFSET, true));
      yield {
        timestampMicroseconds: Math.round(ticks * secondsPerTick * MICROSECONDS_PER_SECOND),
        data
      } satisfies IvfFrame;
    }
  }

  return {
    header,
    frames: readFrames()
  };
}

const VP9_FRAME_MARKER_BITS = 2;
const VP9_PROFILE_BITS = 2;
const VP9_PROFILE_WITH_RESERVED_BIT = 3;
const BITS_PER_BYTE = 8;

function readFirstByteBit(byte: number, bitIndex: number) {
  return (byte >> (BITS_PER_BYTE - 1 - bitIndex)) & 1;
}

// First bits of a VP9 frame: marker(2), profile low/high(1+1), reserved(1, profile 3 only),
// show_existing_frame(1), frame_type(1) where 0 is a key frame
function isVp9KeyFrame(data: Uint8Array) {
  const [firstByte] = data;
  if (firstByte === undefined) {
    return false;
  }

  const profileLow = readFirstByteBit(firstByte, VP9_FRAME_MARKER_BITS);
  const profileHigh = readFirstByteBit(firstByte, VP9_FRAME_MARKER_BITS + 1);
  const profile = (profileHigh << 1) | profileLow;
  const reservedBits = profile === VP9_PROFILE_WITH_RESERVED_BIT ? 1 : 0;
  const showExistingIndex = VP9_FRAME_MARKER_BITS + VP9_PROFILE_BITS + reservedBits;
  const isShowExistingFrame = readFirstByteBit(firstByte, showExistingIndex) === 1;
  if (isShowExistingFrame) {
    return false;
  }

  return readFirstByteBit(firstByte, showExistingIndex + 1) === 0;
}

const AV1_OBU_SEQUENCE_HEADER = 1;
const AV1_OBU_FRAME_HEADER = 3;
const AV1_OBU_FRAME = 6;
const AV1_KEY_FRAME_TYPE = 0;
const LEB128_VALUE_BITS = 7;
const LEB128_MAX_BYTES = 8;
const LEB128_VALUE_MASK = 0x7F;
const LEB128_CONTINUE_FLAG = 0x80;

function readLeb128(data: Uint8Array, offset: number) {
  let value = 0;
  for (let i = 0; i < LEB128_MAX_BYTES; i++) {
    const byte = data[offset + i];
    if (byte === undefined) {
      break;
    }

    value |= (byte & LEB128_VALUE_MASK) << (i * LEB128_VALUE_BITS);

    if (!(byte & LEB128_CONTINUE_FLAG)) {
      return {
        value,
        byteLength: i + 1
      };
    }
  }

  return {
    value: 0,
    byteLength: 1
  };
}

// A temporal unit starts a key frame when it carries a sequence header, or when its first frame
// header says so: show_existing_frame(1) then frame_type(2)
function isAv1KeyFrame(data: Uint8Array) {
  let offset = 0;
  while (offset < data.length) {
    const header = data[offset]!;
    const type = (header >> 3) & 0xF;
    const hasExtension = (header >> 2) & 1;
    const hasSize = (header >> 1) & 1;
    offset += 1 + hasExtension;
    const size = hasSize ? readLeb128(data, offset) : {
      value: data.length - offset,
      byteLength: 0
    };
    offset += size.byteLength;

    if (type === AV1_OBU_SEQUENCE_HEADER) {
      return true;
    }

    const isFrameObu = type === AV1_OBU_FRAME || type === AV1_OBU_FRAME_HEADER;
    if (isFrameObu) {
      const payloadByte = data[offset] ?? 0;
      const isShowExistingFrame = (payloadByte >> 7) & 1;
      const frameType = (payloadByte >> 5) & 0x3;
      return !isShowExistingFrame && frameType === AV1_KEY_FRAME_TYPE;
    }

    offset += size.value;
  }

  return false;
}

const IVF_FOURCC_VP9 = "VP90";
const IVF_FOURCC_AV1 = "AV01";

export function isKeyFrame({ fourcc, data }: {
  fourcc: string;
  data: Uint8Array;
}) {
  if (fourcc === IVF_FOURCC_VP9) {
    return isVp9KeyFrame(data);
  }

  if (fourcc === IVF_FOURCC_AV1) {
    return isAv1KeyFrame(data);
  }

  return false;
}

const FALLBACK_DECODER_CODECS: Record<string, string> = {
  [IVF_FOURCC_VP9]: "vp09.00.61.08",
  [IVF_FOURCC_AV1]: "av01.0.16M.08"
};

export function resolveDecoderCodec({ mimeType, fourcc }: {
  mimeType: string;
  fourcc: string;
}) {
  const declaredCodec = mimeType.match(/codecs="?([^";]+)/i)?.[1];
  // YouTube lists VP9 as a bare "vp9", which WebCodecs rejects: it wants "vp09.PP.LL.DD"
  const isFullCodecString = !!declaredCodec?.includes(".");
  return isFullCodecString ? declaredCodec! : (FALLBACK_DECODER_CODECS[fourcc] ?? declaredCodec ?? "");
}
