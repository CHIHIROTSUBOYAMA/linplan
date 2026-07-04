# -*- coding: utf-8 -*-
"""fonts/ のサブセット woff2 を再生成するスクリプト。

使い方:
    pip install fonttools brotli
    python tools/subset-fonts.py

- Zen Kaku Gothic New … サイト内の全 HTML / CSS / JS から使用文字を自動収集
  （＋かな・約物・記号の安全域）。本文フォントなので全文字をカバーする。
- Klee One … tools/klee-chars.txt の文字だけを収録（見出し・ボタン等の
  手書き風フォント。1 グリフが重いため必要最小限に絞る）。
  **見出しやボタンに新しい漢字を使ったら klee-chars.txt に追記して再実行**
  （漏れると該当文字だけ Zen Kaku Gothic New にフォールバックする）。

元 TTF は google/fonts リポジトリから %TEMP% にダウンロードしてキャッシュする。
"""
import glob
import os
import subprocess
import sys
import tempfile
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOOLS = os.path.join(ROOT, "tools")
OUT = os.path.join(ROOT, "fonts")
CACHE = os.path.join(tempfile.gettempdir(), "linplan-font-src")

GF = "https://github.com/google/fonts/raw/main/ofl"
SOURCES = {
    "KleeOne-Regular.ttf": f"{GF}/kleeone/KleeOne-Regular.ttf",
    "KleeOne-SemiBold.ttf": f"{GF}/kleeone/KleeOne-SemiBold.ttf",
    "ZenKakuGothicNew-Regular.ttf": f"{GF}/zenkakugothicnew/ZenKakuGothicNew-Regular.ttf",
    "ZenKakuGothicNew-Medium.ttf": f"{GF}/zenkakugothicnew/ZenKakuGothicNew-Medium.ttf",
    "ZenKakuGothicNew-Bold.ttf": f"{GF}/zenkakugothicnew/ZenKakuGothicNew-Bold.ttf",
}


def fetch_sources():
    os.makedirs(CACHE, exist_ok=True)
    for name, url in SOURCES.items():
        dst = os.path.join(CACHE, name)
        if not os.path.exists(dst):
            print(f"download {name} ...")
            urllib.request.urlretrieve(url, dst)


def add_safety_ranges(chars: set) -> set:
    """かな・約物・記号など、文言修正で使われやすい文字域を丸ごと足す。"""
    for a, b in [
        (0x0020, 0x007E),  # ASCII
        (0x2000, 0x206F),  # 一般句読点（… ― “” など）
        (0x20A0, 0x20BF),  # 通貨記号
        (0x2100, 0x214F),  # ℃ № ™ など
        (0x2190, 0x21FF),  # 矢印
        (0x2460, 0x24FF),  # 丸数字
        (0x25A0, 0x25FF),  # ■▲●◎ など図形
        (0x2600, 0x2612), (0x2713, 0x2717),  # ☆★✓✕ など
        (0x3000, 0x303F),  # CJK 約物（、。「」など）
        (0x3041, 0x309F),  # ひらがな
        (0x30A0, 0x30FF),  # カタカナ
        (0xFF00, 0xFFEF),  # 全角英数・￥
    ]:
        for cp in range(a, b + 1):
            chars.add(chr(cp))
    for c in "\n\r\t":
        chars.discard(c)
    return chars


def zen_chars() -> set:
    chars = set()
    targets = []
    for pat in ("*.html", "blog/*.html", "*.css", "*.js"):
        targets += glob.glob(os.path.join(ROOT, pat))
    for path in targets:
        with open(path, encoding="utf-8") as f:
            chars.update(f.read())
    return add_safety_ranges(chars)


def klee_chars() -> set:
    with open(os.path.join(TOOLS, "klee-chars.txt"), encoding="utf-8") as f:
        chars = set(f.read())
    # かな・CJK 約物・ASCII は常時カバー（見出しの文言修正に耐える）
    for a, b in [(0x0020, 0x007E), (0x3000, 0x303F), (0x3041, 0x309F), (0x30A0, 0x30FF)]:
        for cp in range(a, b + 1):
            chars.add(chr(cp))
    for c in "\n\r\t":
        chars.discard(c)
    return chars


def subset(src: str, dst: str, chars: set):
    txt = os.path.join(CACHE, "chars-" + dst + ".txt")
    with open(txt, "w", encoding="utf-8") as f:
        f.write("".join(sorted(chars)))
    subprocess.run(
        [
            sys.executable, "-m", "fontTools.subset",
            os.path.join(CACHE, src),
            f"--text-file={txt}",
            "--flavor=woff2",
            f"--output-file={os.path.join(OUT, dst)}",
            "--layout-features=*",
            "--no-hinting",
            "--desubroutinize",
        ],
        check=True,
    )
    size = os.path.getsize(os.path.join(OUT, dst))
    print(f"{dst}: {size:,} bytes ({len(chars)} chars)")


def main():
    fetch_sources()
    zen = zen_chars()
    klee = klee_chars()
    subset("KleeOne-Regular.ttf", "KleeOne-Regular.subset.woff2", klee)
    subset("KleeOne-SemiBold.ttf", "KleeOne-SemiBold.subset.woff2", klee)
    subset("ZenKakuGothicNew-Regular.ttf", "ZenKakuGothicNew-Regular.subset.woff2", zen)
    subset("ZenKakuGothicNew-Medium.ttf", "ZenKakuGothicNew-Medium.subset.woff2", zen)
    subset("ZenKakuGothicNew-Bold.ttf", "ZenKakuGothicNew-Bold.subset.woff2", zen)


if __name__ == "__main__":
    main()
