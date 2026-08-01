# KnowledgeMgr PowerShell 5.1 ナレッジ定義

## 配置

- FormatID: `PS51-WS2022`
- FormatName: `Windows PowerShell 5.1 / Windows Server 2022 公式資料`
- フォーマット定義: `formats\PS51-WS2022.txt`
- ナレッジ配置: `data\PS51-WS2022\<KnowledgeNo>.txt`
- 件数: 4030
- 文字コード: Shift_JIS（CP932）
- 改行: CRLF

## フィールド定義

| FieldName | FieldType | Required | searchTarget | 定義 |
|---|---|---:|---:|---|
| タイトル | 単一行 | 必須 | 対象 | 資料の表題 |
| モジュール | 単一行 | 必須 | 対象 | PowerShellモジュール名 |
| 製品 | 単一行 | 必須 | 対象 | Windows PowerShell 5.1 |
| 対応OS | 単一行 | 必須 | 対象 | Windows Server 2022 |
| 日本語訳 | 複数行 | 必須 | 対象 | 英語公式資料から作成した日本語訳 |
| 英語原文 | 複数行 | 必須 | 対象 | Microsoft Learnの英語原文 |
| Microsoft Learn URL | 単一行 | 必須 | 対象外 | 一次資料へのリンク |

`KnowledgeNo`、`FormatID`、`CreatedAt`、`UpdatedAt` はKnowledgeMgrのシステムキーです。フォーマットの利用者定義フィールドには含めません。

ユーザー向けフィールドには、根拠レコードID、適用ADR、row_id、管理番号を含めません。日本語訳と英語原文は別フィールドに格納します。

## 文字コード境界

KnowledgeMgrの実装はShift_JIS固定で読み書きし、CP932往復不能な値を保存時に拒否します。そのため、CP932版では 1693 件・6247 文字を明示的に搬送表記へ変換しています。表示上同等な記号は `(R)`、`(TM)`、通常空白などへ変換し、多言語文字などは `[U+XXXX]` 形式へ退避します。完全なUnicode本文は `powershell51_knowledge_bundle_utf8.txt` に保持します。
