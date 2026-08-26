#!/usr/bin/env bash
# 一键将透明 WebM 视频转为 Apple 原生 HEVC with Alpha (.mov)
# 适用于 Keynote / QuickTime / Final Cut Pro / Premiere

INPUT_FILE="$1"
if [ -z "$INPUT_FILE" ]; then
  echo "使用方法: ./scripts/convert_to_alpha_mov.sh <input.webm> [output.mov]"
  exit 1
fi

OUTPUT_FILE="$2"
if [ -z "$OUTPUT_FILE" ]; then
  OUTPUT_FILE="${INPUT_FILE%.*}-apple-alpha.mov"
fi

echo "正在将 $INPUT_FILE 转换为 Apple HEVC with Alpha 格式 ($OUTPUT_FILE)..."

# 优先使用 macOS 原生 VideoToolbox 硬件加速编码 HEVC with Alpha
if ffmpeg -h encoder=hevc_videotoolbox 2>&1 | grep -q "alpha_quality"; then
  ffmpeg -y -i "$INPUT_FILE" \
    -c:v hevc_videotoolbox \
    -allow_sw 1 \
    -alpha_quality 0.75 \
    -vtag hvc1 \
    -pix_fmt yuva420p \
    "$OUTPUT_FILE"
else
  # 回退使用 ProRes 4444（100% 支持所有 Mac 软件）
  ffmpeg -y -i "$INPUT_FILE" \
    -c:v prores_ks \
    -profile:v 4444 \
    -pix_fmt yuva444p10le \
    "$OUTPUT_FILE"
fi

echo "✅ 转换完成！输出文件: $OUTPUT_FILE"
