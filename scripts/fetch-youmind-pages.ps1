$ErrorActionPreference = 'Stop'
$outputDirectory = Join-Path $PSScriptRoot 'youmind-api'
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
$headers = @{
  Origin = 'https://youmind.com'
  'User-Agent' = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36'
  Accept = 'application/json'
}
$sources = @(
  @{ Key='seedream'; Model='seedream-4.5'; Campaign='seedream-4-dot-5-prompts' },
  @{ Key='nano'; Model='nano-banana-pro'; Campaign='nano-banana-pro-prompts' },
  @{ Key='gpt'; Model='gpt-image-2'; Campaign='gpt-image-2-prompts' }
)
foreach ($source in $sources) {
  $headers.Referer = "https://youmind.com/zh-CN/$($source.Campaign)/explore"
  for ($page = 1; $page -le 20; $page++) {
    $body = @{
      model = $source.Model
      page = $page
      limit = 18
      locale = 'zh-CN'
      campaign = $source.Campaign
      filterMode = 'imageCategories'
    } | ConvertTo-Json -Compress
    $target = Join-Path $outputDirectory "$($source.Key)-$page.json"
    for ($attempt = 1; $attempt -le 4; $attempt++) {
      try {
        Invoke-WebRequest -Uri 'https://youmind.com/youmarketing-api/prompts' -Method POST -Headers $headers -ContentType 'application/json' -Body $body -UseBasicParsing -OutFile $target
        break
      } catch {
        if ($attempt -eq 4) { throw }
        Start-Sleep -Milliseconds (500 * $attempt)
      }
    }
  }
}
Get-ChildItem $outputDirectory -Filter '*.json' | Measure-Object Length -Sum | Select-Object Count, Sum
