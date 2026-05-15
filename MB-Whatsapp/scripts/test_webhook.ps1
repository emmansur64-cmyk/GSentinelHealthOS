param(
    [string]$BaseUrl = "http://localhost:8080",
    [string]$Text = "Paciente con fiebre persistente y tos seca",
    [int]$PollRetries = 20,
    [int]$PollDelaySeconds = 2
)

$ErrorActionPreference = "Stop"

if (-not (Test-Path ".env")) {
    Write-Host "Missing .env" -ForegroundColor Red
    exit 1
}

$envMap = @{}
Get-Content .env | ForEach-Object {
    if ($_ -match "^\s*#" -or $_ -notmatch "=") { return }
    $k, $v = $_.Split("=", 2)
    $envMap[$k.Trim()] = $v.Trim()
}

$appSecret = $envMap["WHATSAPP_APP_SECRET"]
$verifyToken = $envMap["WHATSAPP_VERIFY_TOKEN"]

if ([string]::IsNullOrWhiteSpace($appSecret) -or [string]::IsNullOrWhiteSpace($verifyToken)) {
    Write-Host "WHATSAPP_APP_SECRET and WHATSAPP_VERIFY_TOKEN are required" -ForegroundColor Red
    exit 1
}

$messageId = "wamid.test.$([guid]::NewGuid().ToString('N'))"
$payloadObj = @{
    entry = @(
        @{
            changes = @(
                @{
                    value = @{
                        messages = @(
                            @{
                                id = $messageId
                                text = @{ body = $Text }
                            }
                        )
                    }
                }
            )
        }
    )
}
$payload = $payloadObj | ConvertTo-Json -Depth 10 -Compress

$bytes = [System.Text.Encoding]::UTF8.GetBytes($payload)
$hmac = New-Object System.Security.Cryptography.HMACSHA256
$hmac.Key = [System.Text.Encoding]::UTF8.GetBytes($appSecret)
$hash = ($hmac.ComputeHash($bytes) | ForEach-Object { $_.ToString("x2") }) -join ""
$signature = "sha256=$hash"

Write-Host "[1/3] Verifying webhook token..."
$verifyUrl = "$BaseUrl/webhook/whatsapp?hub.mode=subscribe&hub.verify_token=$verifyToken&hub.challenge=12345"
$verifyResp = Invoke-WebRequest -Uri $verifyUrl -Method Get -TimeoutSec 10
if ($verifyResp.Content.Trim() -ne "12345") {
    Write-Host "Webhook verification failed" -ForegroundColor Red
    exit 1
}

Write-Host "[2/3] Sending simulated WhatsApp webhook..."
$enqueueResp = Invoke-RestMethod -Uri "$BaseUrl/webhook/whatsapp" -Method Post -Headers @{"X-Hub-Signature-256"=$signature} -ContentType "application/json" -Body $payload -TimeoutSec 10
if ($enqueueResp.status -ne "accepted") {
    Write-Host "Webhook enqueue failed" -ForegroundColor Red
    exit 1
}

Write-Host "[3/3] Polling pipeline result..."
$done = $false
for ($i = 1; $i -le $PollRetries; $i++) {
    $result = Invoke-RestMethod -Uri "$BaseUrl/result/$messageId" -Method Get -TimeoutSec 10
    if ($result.status -eq "completed") {
        $done = $true
        Write-Host ""
        Write-Host "Pipeline completed" -ForegroundColor Green
        Write-Host ("message_id: {0}" -f $result.message_id)
        Write-Host ("quality: {0}" -f $result.pipeline.quality_level)
        Write-Host ("fallback: {0}" -f $result.pipeline.fallback_applied)
        Write-Host ("response: {0}" -f $result.response_text)
        break
    }
    Start-Sleep -Seconds $PollDelaySeconds
}

if (-not $done) {
    Write-Host "Pipeline did not complete within timeout" -ForegroundColor Red
    exit 1
}
