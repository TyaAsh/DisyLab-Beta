$ErrorActionPreference = 'Stop'

$projectPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$localUrl = 'http://127.0.0.1:1420/'
$port = 1420

function Test-DisyLabPort {
  $client = [System.Net.Sockets.TcpClient]::new()
  try {
    $task = $client.ConnectAsync('127.0.0.1', $port)
    return $task.Wait(350) -and $client.Connected
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

if (-not (Test-DisyLabPort)) {
  $logPath = Join-Path $projectPath '.disylab-dev.log'
  $command = "npm run dev -- --host 127.0.0.1 *> `"$logPath`""
  Start-Process `
    -FilePath 'powershell.exe' `
    -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $command) `
    -WorkingDirectory $projectPath `
    -WindowStyle Hidden

  $ready = $false
  for ($attempt = 0; $attempt -lt 40; $attempt += 1) {
    Start-Sleep -Milliseconds 250
    if (Test-DisyLabPort) {
      $ready = $true
      break
    }
  }

  if (-not $ready) {
    Add-Type -AssemblyName PresentationFramework
    [System.Windows.MessageBox]::Show(
      "DisyLab 本地服务启动失败。`n请查看日志：$logPath",
      'DisyLab',
      'OK',
      'Error'
    ) | Out-Null
    exit 1
  }
}

Start-Process $localUrl
