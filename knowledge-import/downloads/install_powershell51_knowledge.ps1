param(
  [string]$KnowledgeRoot = 'C:\KnowledgeMgr',
  [switch]$Check,
  [switch]$Overwrite
)
$ErrorActionPreference = 'Stop'
$FormatId = 'PS51-WS2022'
$ExpectedRecords = 4030
$ExpectedBundleHash = '4b5cf06c143e3dfefc90dbd7c543aa4396b99d52bc532334916b9a3445fbab21'
$ExpectedFormatHash = '2519158d0f402ab2a28bfe22584e12cde543b62c2edba6ae34e9f8c209ce93b6'
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$Bundle = Join-Path $Here 'powershell51_knowledge_bundle_cp932.txt'
$Format = Join-Path $Here 'PS51-WS2022.txt'

function Assert-True([bool]$Condition, [string]$Message) {
  if (-not $Condition) { throw $Message }
}

$splitterSource = @'
using System;
using System.Collections.Generic;
using System.IO;
using System.Text;

public static class KnowledgeBundleSplitter
{
    public static int Split(string bundlePath, string outputDirectory, string formatId, bool writeFiles)
    {
        byte[] data = File.ReadAllBytes(bundlePath);
        byte[] marker = Encoding.ASCII.GetBytes("###KnowledgeNo###\r\n");
        var starts = new List<int>();
        for (int i = 0; i <= data.Length - marker.Length; i++)
        {
            if (data[i] != marker[0]) continue;
            bool match = true;
            for (int j = 1; j < marker.Length; j++)
            {
                if (data[i + j] != marker[j]) { match = false; break; }
            }
            if (match) { starts.Add(i); i += marker.Length - 1; }
        }
        if (starts.Count == 0 || starts[0] != 0)
            throw new InvalidDataException("先頭が###KnowledgeNo###ではありません");
        for (int i = 0; i < data.Length; i++)
        {
            if (data[i] == 10 && (i == 0 || data[i - 1] != 13))
                throw new InvalidDataException("LF単独改行があります");
            if (data[i] == 13 && (i + 1 >= data.Length || data[i + 1] != 10))
                throw new InvalidDataException("CR単独改行があります");
        }
        if (!writeFiles) return starts.Count;
        Directory.CreateDirectory(outputDirectory);
        for (int i = 0; i < starts.Count; i++)
        {
            int end = i + 1 < starts.Count ? starts[i + 1] : data.Length;
            string number = String.Format("{0}-2026-{1:D4}.txt", formatId, i + 1);
            string path = Path.Combine(outputDirectory, number);
            using (var output = new FileStream(path, FileMode.Create, FileAccess.Write, FileShare.None))
                output.Write(data, starts[i], end - starts[i]);
        }
        return starts.Count;
    }
}
'@

try {
  Assert-True (Test-Path -LiteralPath $KnowledgeRoot -PathType Container) "KnowledgeMgrルートがありません: $KnowledgeRoot"
  $bundleHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $Bundle).Hash.ToLowerInvariant()
  $formatHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $Format).Hash.ToLowerInvariant()
  Assert-True ($bundleHash -eq $ExpectedBundleHash) '投入バンドルのSHA-256が不一致です'
  Assert-True ($formatHash -eq $ExpectedFormatHash) 'フォーマット定義のSHA-256が不一致です'
  if (-not ('KnowledgeBundleSplitter' -as [type])) { Add-Type -TypeDefinition $splitterSource -Language CSharp }
  $recordCount = [KnowledgeBundleSplitter]::Split($Bundle, $null, $FormatId, $false)
  Assert-True ($recordCount -eq $ExpectedRecords) "レコード数が不正です: $recordCount"
  Write-Host "PRECHECK PASS format=$FormatId records=$recordCount encoding=CP932 line_endings=CRLF"
  if ($Check) {
    Write-Host 'CHECK ONLY: KnowledgeMgrは変更していません。'
    exit 0
  }

  $formatsDir = Join-Path $KnowledgeRoot 'formats'
  $dataDir = Join-Path (Join-Path $KnowledgeRoot 'data') $FormatId
  $formatTarget = Join-Path $formatsDir "$FormatId.txt"
  $collisions = New-Object System.Collections.Generic.List[string]
  if (Test-Path -LiteralPath $formatTarget) { $collisions.Add($formatTarget) }
  for ($index = 1; $index -le $ExpectedRecords; $index++) {
    $number = '{0}-2026-{1:d4}' -f $FormatId, $index
    $target = Join-Path $dataDir "$number.txt"
    if (Test-Path -LiteralPath $target) { $collisions.Add($target) }
  }
  if ($collisions.Count -gt 0 -and -not $Overwrite) {
    throw "既存資材が$($collisions.Count)件あります。上書きする場合は -Overwrite を指定してください。"
  }

  $backup = $null
  if ($collisions.Count -gt 0) {
    $backup = Join-Path (Join-Path $KnowledgeRoot 'backup') ('powershell51_import_' + (Get-Date -Format 'yyyyMMdd_HHmmss'))
    New-Item -ItemType Directory -Path $backup -Force | Out-Null
    foreach ($path in $collisions) {
      $relative = $path.Substring($KnowledgeRoot.TrimEnd('\').Length).TrimStart('\')
      $backupTarget = Join-Path $backup $relative
      New-Item -ItemType Directory -Path (Split-Path -Parent $backupTarget) -Force | Out-Null
      Copy-Item -LiteralPath $path -Destination $backupTarget -Force
    }
  }

  $stage = Join-Path $env:TEMP ('ps51_km_' + [guid]::NewGuid().ToString('N'))
  try {
    $stageFormats = Join-Path $stage 'formats'
    $stageData = Join-Path (Join-Path $stage 'data') $FormatId
    New-Item -ItemType Directory -Path $stageFormats -Force | Out-Null
    New-Item -ItemType Directory -Path $stageData -Force | Out-Null
    Copy-Item -LiteralPath $Format -Destination (Join-Path $stageFormats "$FormatId.txt")
    $stagedCount = [KnowledgeBundleSplitter]::Split($Bundle, $stageData, $FormatId, $true)
    Assert-True ($stagedCount -eq $ExpectedRecords) 'ステージング分割件数が不正です'
    Assert-True (@(Get-ChildItem -LiteralPath $stageData -Filter '*.txt' -File).Count -eq $ExpectedRecords) 'ステージング件数が不正です'
    New-Item -ItemType Directory -Path $formatsDir -Force | Out-Null
    New-Item -ItemType Directory -Path $dataDir -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $stageFormats "$FormatId.txt") -Destination $formatTarget -Force
    Copy-Item -Path (Join-Path $stageData '*.txt') -Destination $dataDir -Force
  } finally {
    if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
  }
  Write-Host "INSTALL PASS format=$formatTarget records=$ExpectedRecords data=$dataDir"
  if ($null -ne $backup) { Write-Host "BACKUP $backup" }
  exit 0
} catch {
  Write-Error "FAIL $($_.Exception.Message)"
  exit 1
}
