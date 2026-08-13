$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot 'industry-source'
$html = Get-Content -Raw (Join-Path $source 'moomoo-au-welcome.html')
$urls = [regex]::Matches($html, 'https:[^" ]+\.(png|jpg|jpeg|webp)') |
  ForEach-Object { $_.Value } |
  Where-Object { $_ -match 'fego-images-v2|blogimg' } |
  Sort-Object -Unique

$index = 1
foreach ($url in $urls) {
  $name = 'moomoo-au-{0:D2}.source' -f $index
  try { Invoke-WebRequest -Uri $url -UseBasicParsing -OutFile (Join-Path $source $name) } catch {}
  $index += 1
}

$campaigns = Get-Content -Raw (Join-Path $source 'tiger-campaigns.json') | ConvertFrom-Json
foreach ($campaign in $campaigns) {
  $name = 'tiger-{0}-{1}.source' -f $campaign.market, $campaign.id
  try { Invoke-WebRequest -Uri $campaign.image -UseBasicParsing -OutFile (Join-Path $source $name) } catch {}
}

Get-ChildItem $source -Filter 'moomoo-au-*.source' | Select-Object Name, Length
Get-ChildItem $source -Filter 'tiger-*-*.source' | Select-Object Name, Length
