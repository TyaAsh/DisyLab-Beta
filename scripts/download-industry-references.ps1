$ErrorActionPreference = 'Stop'
$output = Join-Path $PSScriptRoot 'industry-source'
New-Item -ItemType Directory -Force -Path $output | Out-Null

$assets = @(
  @{ Name = 'shiqi-51'; Url = 'https://shiqitop.oss-cn-shanghai.aliyuncs.com/2023/10/06/0a07f1a5b60045d9910e8951f6c69c67SQDX%E7%BC%A9%E7%95%A5.jpg' },
  @{ Name = 'shiqi-60'; Url = 'https://shiqitop.oss-cn-shanghai.aliyuncs.com/2023/10/06/37c8eee9a29c452da571b637c492b269%E9%A3%9E%E8%A1%8C%E5%99%A8%E7%BC%A9%E7%95%A5.jpg' },
  @{ Name = 'shiqi-61'; Url = 'https://shiqitop.oss-cn-shanghai.aliyuncs.com/2023/10/06/4ca5a3aea2c246e0879180284c546c4d%E6%A2%85%E8%8A%B1%E9%B9%BF%E7%BC%A9%E7%95%A5.jpg' },
  @{ Name = 'shiqi-49'; Url = 'https://shiqitop.oss-cn-shanghai.aliyuncs.com/2023/09/27/210fa0ffc69549c0aaddf7487d938e29%E4%B9%92%E4%B9%93.jpg' },
  @{ Name = 'shiqi-54'; Url = 'https://shiqitop.oss-cn-shanghai.aliyuncs.com/2023/10/06/f2afe91380da4b45bff4b4ef8de1e992%E5%A3%AB%E6%B0%94%E5%A4%A7%E5%AD%A6-%E7%BC%A9%E7%95%A5.jpg' },
  @{ Name = 'shiqi-40'; Url = 'https://shiqitop.oss-cn-shanghai.aliyuncs.com/2023/09/21/1e18fe85af464e3a85243ac0f4aa395a%E5%B0%8F%E8%9C%97%E6%9C%BA%E8%BD%A6-%E7%BC%A9%E7%95%A5.jpg' },
  @{ Name = 'shiqi-63'; Url = 'https://shiqitop.oss-cn-shanghai.aliyuncs.com/2023/10/06/23666fb9c6f842979223ea2c2837620d04%E7%BC%A9%E7%95%A5.jpg' },
  @{ Name = 'shiqi-69'; Url = 'https://shiqitop.oss-cn-shanghai.aliyuncs.com/2023/10/07/de95325bc3dd474aaca67a49b54eca231%E7%BC%A9%E7%95%A5.jpg' },
  @{ Name = 'shiqi-35'; Url = 'https://shiqitop.oss-cn-shanghai.aliyuncs.com/2023/09/19/de69c143006747b7948aa582f7f423a7%E7%BC%A9%E7%95%A5.jpg' },
  @{ Name = 'shiqi-78'; Url = 'https://shiqitop.oss-cn-shanghai.aliyuncs.com/2023/10/07/cf96059c886e48faa1b0227d3ca98011%E7%BC%A9%E7%95%A51.jpg' },
  @{ Name = 'tiger-welcome'; Url = 'https://static.tigerbbs.com/17e7c6eae938535d9c445220ff80fb5d.png' },
  @{ Name = 'tiger-transfer'; Url = 'https://static.tigerbbs.com/6e4a704e120ca05b4cb5410b840b9ea0.png' },
  @{ Name = 'tiger-referral'; Url = 'https://static.tigerbbs.com/79e4e29590382eb2d95b78c85599e5d4.jpg' }
)

foreach ($asset in $assets) {
  $target = Join-Path $output ($asset.Name + '.source')
  Invoke-WebRequest -Uri $asset.Url -UseBasicParsing -OutFile $target
}

Get-ChildItem -LiteralPath $output | Select-Object Name, Length
