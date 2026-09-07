#!/bin/bash
# saveDefaultsPlugin 加固验证脚本
# 注意：成功用例会真实改写 src/stores/controlStore.js，故测试前后做快照/还原。
set -u
cd /Users/jingzhan.chen/WorkBuddy/2026-08-02-23-04-06 || exit 1

TARGET=src/stores/controlStore.js
SNAP=/tmp/controlStore.snapshot.js
URL=http://127.0.0.1:5173/__api/save-defaults

cp "$TARGET" "$SNAP"
trap 'cp "$SNAP" "$TARGET"; rm -f "$TARGET".tmp-* "$TARGET".bak; echo ""; echo "=== 已还原 $TARGET ==="' EXIT

post() {
  curl -s --noproxy '*' -X POST "$URL" \
    -H 'Content-Type: application/json' -H 'Origin: http://127.0.0.1:5173' \
    -d "$1"
}

echo "1) 正常单条契约 {id,iconSize,bgSize} —— 期望 count=2"
post '{"id":"wifi","iconSize":27,"bgSize":39}'; echo
grep -nE '^  wifi:' "$TARGET" | head -2

echo ""
echo "2) 数组契约 {items:[...]} —— 期望 count=2"
post '{"items":[{"id":"data","iconSize":26},{"id":"bluetooth","bgSize":38}]}'; echo

echo ""
echo "3) 正则元字符注入 —— 期望 count=0，failed=invalid id format"
post '{"items":[{"id":"wifi.*+?(","iconSize":9}]}'; echo

echo ""
echo "4) 原型污染键 __proto__ / constructor —— 期望 count=0"
post '{"items":[{"id":"__proto__","iconSize":9},{"id":"constructor","iconSize":9}]}'; echo

echo ""
echo "5) 数值越界 / 非整数 / 字符串注入 —— 期望 count=0"
post '{"items":[{"id":"wifi","iconSize":9999}]}'; echo
post '{"items":[{"id":"wifi","iconSize":12.5}]}'; echo
post '{"items":[{"id":"wifi","iconSize":"8; process.exit(1)"}]}'; echo

echo ""
echo "6) 跨对象污染：只给 iconSize，验证 DEFAULT_BG_SIZES 内同名键未被改动"
post '{"id":"mediaCast","iconSize":20}' > /dev/null
echo "--- DEFAULT_ICON_SIZES 内 ---"; sed -n '/DEFAULT_ICON_SIZES/,/^}/p' "$TARGET" | grep -E '^  mediaCast:'
echo "--- DEFAULT_BG_SIZES 内（应保持 28）---"; sed -n '/DEFAULT_BG_SIZES/,/^}/p' "$TARGET" | grep -E '^  mediaCast:'

echo ""
echo "7) 新 id 仍可追加（白名单方案会误伤，格式校验方案应放行）"
post '{"id":"joyHeart","iconSize":30}'; echo
sed -n '/DEFAULT_ICON_SIZES/,/^}/p' "$TARGET" | grep -E '^  joyHeart:'

echo ""
echo "8) origin 校验 —— 期望 403"
curl -s --noproxy '*' -o /dev/stdout -w " [HTTP %{http_code}]" -X POST "$URL" \
  -H 'Content-Type: application/json' -H 'Origin: http://evil.example.com' \
  -d '{"id":"wifi","iconSize":27}'; echo

echo ""
echo "9) body 体积上限 —— 期望 413 payload too large"
node -e "process.stdout.write(JSON.stringify({items:Array.from({length:200000},()=>({id:'wifi',iconSize:8}))}))" \
  | curl -s --noproxy '*' -o /dev/stdout -w " [HTTP %{http_code}]" -X POST "$URL" \
      -H 'Content-Type: application/json' -H 'Origin: http://127.0.0.1:5173' --data-binary @-; echo

echo ""
echo "10) 备份文件与临时文件残留检查"
ls -la "$TARGET".bak 2>/dev/null && echo "  ↑ .bak 已生成（正常）" || echo "  .bak 未生成"
ls "$TARGET".tmp-* 2>/dev/null && echo "  ⚠️ 有 tmp 残留" || echo "  OK: 无 tmp 残留"
