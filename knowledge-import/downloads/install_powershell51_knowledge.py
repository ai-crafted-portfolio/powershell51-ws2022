#!/usr/bin/env python3
"""Validate and install all PowerShell 5.1 records into KnowledgeMgr."""

from __future__ import annotations

import argparse
import hashlib
import re
import shutil
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
FORMAT_ID = "PS51-WS2022"
EXPECTED_RECORDS = 4030
EXPECTED_BUNDLE_SHA256 = "4b5cf06c143e3dfefc90dbd7c543aa4396b99d52bc532334916b9a3445fbab21"
EXPECTED_FORMAT_SHA256 = "2519158d0f402ab2a28bfe22584e12cde543b62c2edba6ae34e9f8c209ce93b6"
BUNDLE = HERE / "powershell51_knowledge_bundle_cp932.txt"
FORMAT = HERE / "PS51-WS2022.txt"
SYSTEM_KEYS = ("KnowledgeNo", "FormatID", "CreatedAt", "UpdatedAt")
FIELDS = ('タイトル', 'モジュール', '製品', '対応OS', '日本語訳', '英語原文', 'Microsoft Learn URL')
HEADER = re.compile(r"^###([^#\r\n]+)###$")


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def lines(text: str) -> list[str]:
    return text.replace("\r\n", "\n").replace("\r", "\n").split("\n")


def records(text: str) -> list[str]:
    source = lines(text)
    starts = [index for index, line in enumerate(source) if line == "###KnowledgeNo###"]
    if len(starts) != EXPECTED_RECORDS:
        raise ValueError(f"レコード数が不正です: {len(starts)}")
    return ["\n".join(source[start : starts[index + 1] if index + 1 < len(starts) else len(source)]).rstrip("\n") for index, start in enumerate(starts)]


def parse_record(text: str, ordinal: int) -> tuple[str, bytes]:
    values, key, body = {}, "", []
    def finish() -> None:
        nonlocal key, body
        if key:
            if key in values:
                raise ValueError(f"{ordinal}件目に重複キーがあります: {key}")
            values[key] = "\n".join(body).rstrip("\n")
        key, body = "", []
    for line in lines(text):
        match = HEADER.fullmatch(line)
        if match:
            finish()
            key = match.group(1)
        elif key:
            body.append(line)
        elif line.strip():
            raise ValueError(f"{ordinal}件目のスタンザが不正です")
    finish()
    allowed = set(SYSTEM_KEYS) | set(FIELDS)
    if set(values) != allowed:
        raise ValueError(f"{ordinal}件目のフィールドが不正です")
    for required in (*SYSTEM_KEYS, *FIELDS):
        if not values[required].strip():
            raise ValueError(f"{ordinal}件目の必須値が空です: {required}")
    expected_no = f"{FORMAT_ID}-2026-{ordinal:04d}"
    if values["KnowledgeNo"].strip() != expected_no or values["FormatID"].strip() != FORMAT_ID:
        raise ValueError(f"{ordinal}件目の識別子が不正です")
    payload = (text.replace("\r\n", "\n").replace("\r", "\n").rstrip("\n").replace("\n", "\r\n") + "\r\n").encode("cp932")
    return expected_no, payload


def main() -> int:
    parser = argparse.ArgumentParser(description="PowerShell 5.1ナレッジ4,030件をKnowledgeMgrへ一括投入します。")
    parser.add_argument("--knowledge-root", type=Path, default=Path(r"C:\KnowledgeMgr"))
    parser.add_argument("--check", action="store_true", help="検査だけを行い、投入しません。")
    parser.add_argument("--overwrite", action="store_true", help="既存の同名資材をバックアップして上書きします。")
    args = parser.parse_args()
    if not args.knowledge_root.is_dir():
        raise FileNotFoundError(f"KnowledgeMgrルートがありません: {args.knowledge_root}")
    if sha256(BUNDLE) != EXPECTED_BUNDLE_SHA256 or sha256(FORMAT) != EXPECTED_FORMAT_SHA256:
        raise ValueError("投入資材のSHA-256が不一致です")
    bundle_text = BUNDLE.read_bytes().decode("cp932")
    parsed = [parse_record(record, i) for i, record in enumerate(records(bundle_text), 1)]
    print(f"PRECHECK PASS format={FORMAT_ID} records={len(parsed)} encoding=CP932 line_endings=CRLF")
    if args.check:
        print("CHECK ONLY: KnowledgeMgrは変更していません。")
        return 0

    formats = args.knowledge_root / "formats"
    data = args.knowledge_root / "data" / FORMAT_ID
    format_target = formats / f"{FORMAT_ID}.txt"
    collisions = [format_target] if format_target.exists() else []
    collisions.extend(data / f"{number}.txt" for number, _ in parsed if (data / f"{number}.txt").exists())
    if collisions and not args.overwrite:
        raise FileExistsError(f"既存資材が{len(collisions)}件あります。上書きする場合は --overwrite を指定してください。")

    backup = None
    if collisions:
        from datetime import datetime
        backup = args.knowledge_root / "backup" / ("powershell51_import_" + datetime.now().strftime("%Y%m%d_%H%M%S"))
        backup.mkdir(parents=True)
        for path in collisions:
            relative = path.relative_to(args.knowledge_root)
            target = backup / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path, target)

    with tempfile.TemporaryDirectory(prefix="ps51_km_") as temporary:
        stage = Path(temporary)
        staged_format = stage / "formats" / f"{FORMAT_ID}.txt"
        staged_format.parent.mkdir(parents=True)
        shutil.copy2(FORMAT, staged_format)
        staged_data = stage / "data" / FORMAT_ID
        staged_data.mkdir(parents=True)
        for number, payload in parsed:
            (staged_data / f"{number}.txt").write_bytes(payload)
        if len(list(staged_data.glob("*.txt"))) != EXPECTED_RECORDS:
            raise ValueError("ステージング件数が不正です")
        formats.mkdir(parents=True, exist_ok=True)
        data.mkdir(parents=True, exist_ok=True)
        shutil.copy2(staged_format, format_target)
        for index, source in enumerate(sorted(staged_data.glob("*.txt")), 1):
            shutil.copy2(source, data / source.name)
            if index % 500 == 0:
                print(f"INSTALLING {index}/{EXPECTED_RECORDS}")
    print(f"INSTALL PASS format={format_target} records={EXPECTED_RECORDS} data={data}")
    if backup:
        print(f"BACKUP {backup}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"FAIL {exc}", file=sys.stderr)
        raise SystemExit(1)
