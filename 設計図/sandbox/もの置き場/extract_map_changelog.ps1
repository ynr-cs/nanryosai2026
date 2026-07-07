$changelogPath = Join-Path $PSScriptRoot "..\..\..\CHANGELOG.md"
$lines = Get-Content $changelogPath -Encoding UTF8

# Find all ## [0.x.y] headers and their line numbers
$sections = @()
for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match '^\#\# \[(\d+\.\d+\.\d+)\]') {
        $sections += [PSCustomObject]@{
            LineNum = $i
            Version = $Matches[1]
            Line = $lines[$i]
        }
    }
}

# Map-related versions
$mapVersions = @(
    # v1 editor: 0.2.0 to 0.2.29
    0..29 | ForEach-Object { "0.2.$_" }
    # Area tool: 0.2.37 to 0.2.42
    37..42 | ForEach-Object { "0.2.$_" }
    # Area tool refactor: 0.2.82 to 0.2.83
    82..83 | ForEach-Object { "0.2.$_" }
    # v2 editor: 0.2.99 to 0.2.102
    99..102 | ForEach-Object { "0.2.$_" }
)

$output = "# CHANGELOG.md から抽出したマップ関連エントリ`n`n"
$output += "抽出日: $(Get-Date -Format 'yyyy-MM-dd')`n`n"
$output += "---`n`n"

foreach ($sec in $sections) {
    if ($sec.Version -in $mapVersions) {
        # Find the end of this section (next ## header or EOF)
        $startLine = $sec.LineNum
        $endLine = $lines.Count - 1
        for ($j = $sec.LineNum + 1; $j -lt $lines.Count; $j++) {
            if ($lines[$j] -match '^\#\# \[') {
                $endLine = $j - 1
                break
            }
        }
        # Extract the section
        $sectionText = ($lines[$startLine..$endLine] -join "`n").TrimEnd()
        $output += "$sectionText`n`n"
    }
}

$outputPath = Join-Path $PSScriptRoot "map_changelog_extract.md"
[System.IO.File]::WriteAllText($outputPath, $output, [System.Text.Encoding]::UTF8)
Write-Host "Done! Extracted map-related changelog entries to map_changelog_extract.md"
