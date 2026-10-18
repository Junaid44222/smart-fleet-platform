Param(
    [string]$ConfigPath = "scripts/e2e/config.json",
    [int]$TimeoutSec = 10
)

# Environment variable E2E_BASE_URL can override the host used in endpoints
if (Test-Path $ConfigPath -PathType Leaf) {
    $config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
} else {
    Write-Error "Config file not found: $ConfigPath"
    exit 2
}

$baseOverride = $Env:E2E_BASE_URL

# Acquire JWT token if auth config provided
$token = $null
if ($null -ne $config.auth) {
    $tokenUrl = $config.auth.tokenUrl
    $email = $config.auth.email
    $password = $config.auth.password
    if (-not $email -and $Env:E2E_AUTH_EMAIL) { $email = $Env:E2E_AUTH_EMAIL }
    if (-not $password -and $Env:E2E_AUTH_PASSWORD) { $password = $Env:E2E_AUTH_PASSWORD }
    $headerName = if ($config.auth.headerName) { $config.auth.headerName } else { 'Authorization' }
    $headerPrefix = if ($config.auth.headerPrefix) { $config.auth.headerPrefix } else { 'Bearer ' }

    if ($email -and $password) {
        try {
            $body = @{ Email = $email; Password = $password } | ConvertTo-Json
            $resp = Invoke-RestMethod -Uri $tokenUrl -Method Post -Body $body -ContentType 'application/json' -ErrorAction Stop
            if ($resp -and $resp.Token) {
                $token = $resp.Token
                Write-Output "Acquired JWT token from $tokenUrl"
            } else {
                Write-Output "Auth response received but token not found."
            }
        } catch {
            Write-Output "Failed to acquire token: $($_.Exception.Message)"
        }
    } else {
        Write-Output "Auth config present but email/password empty; attempting auto-register + login"

        # Try auto-registering a temporary user then login
        try {
            $ts = Get-Date -Format yyyyMMddHHmmss
            $email = "e2e_user_$ts@example.local"
            $password = ([guid]::NewGuid().ToString()).Substring(0,12)
            $registerUrl = $tokenUrl -replace '/login$','/register'
            if ($registerUrl -eq $tokenUrl) { $registerUrl = $tokenUrl.TrimEnd('/') + '/register' }

            $regBody = @{ FullName = 'E2E User'; Email = $email; Password = $password; Role = 'Dispatcher' } | ConvertTo-Json
            $regResp = Invoke-RestMethod -Uri $registerUrl -Method Post -Body $regBody -ContentType 'application/json' -ErrorAction Stop
            Write-Output "Auto-registered E2E user: $email"

            # attempt login
            $body = @{ Email = $email; Password = $password } | ConvertTo-Json
            $resp = Invoke-RestMethod -Uri $tokenUrl -Method Post -Body $body -ContentType 'application/json' -ErrorAction Stop
            if ($resp -and $resp.Token) {
                $token = $resp.Token
                Write-Output "Acquired JWT token after auto-register"
            } else {
                Write-Output "Auth response received but token not found after register."
            }
        } catch {
            Write-Output "Auto-register/login failed: $($_.Exception.Message)"
        }
    }
}

$results = @()
$allPassed = $true

foreach ($ep in $config.endpoints) {
    $url = $ep.url
    if ($baseOverride) {
        try {
            $uri = [System.Uri]$url
            $newBase = [System.Uri]$baseOverride
            $url = ($newBase.Scheme + '://' + $newBase.Host + (if ($newBase.Port -ne 80 -and $newBase.Port -ne 443) { ':' + $newBase.Port } else { '' }) + $uri.AbsolutePath + $uri.Query)
        } catch {
            # ignore malformed override
        }
    }

    $start = Get-Date
    try {
        $headers = @{}
        if ($ep.PSObject.Properties.Match('auth').Count -gt 0 -and $ep.auth) {
            if ($token) {
                $headers[$headerName] = $headerPrefix + $token
            } else {
                Write-Output "[SKIP] $($ep.name) requires auth but no token available"
                $results += [pscustomobject]@{
                    name = $ep.name
                    url = $url
                    status = 0
                    success = $false
                    timeMs = 0
                    error = 'Auth required but token not available'
                }
                if ($ep.required) { $allPassed = $false }
                continue
            }
        }

        $method = if ($ep.method) { [string]$ep.method } else { 'GET' }
        $endpointTimeout = if ($ep.timeoutSec) { [int]$ep.timeoutSec } else { $TimeoutSec }
        $request = @{
            Uri = $url
            Method = $method
            UseBasicParsing = $true
            TimeoutSec = $endpointTimeout
            Headers = $headers
            ErrorAction = 'Stop'
        }
        if ($ep.PSObject.Properties.Match('body').Count -gt 0) {
            $request.Body = $ep.body | ConvertTo-Json -Depth 10 -Compress
            $request.ContentType = 'application/json'
        }

        $resp = Invoke-WebRequest @request
        $status = $resp.StatusCode
        $success = ($status -ge 200 -and $status -lt 300)
        $validationError = $null
        if ($success -and $ep.expectContains) {
            foreach ($expectedText in @($ep.expectContains)) {
                if ($resp.Content -notmatch [regex]::Escape([string]$expectedText)) {
                    $success = $false
                    $validationError = "Response did not contain expected text: $expectedText"
                    break
                }
            }
        }
        $elapsed = (Get-Date) - $start
        $results += [pscustomobject]@{
            name = $ep.name
            url = $url
            status = $status
            success = $success
            timeMs = [int]$elapsed.TotalMilliseconds
            error = $validationError
        }
        if (-not $success -and $ep.required) { $allPassed = $false }
        if ($success) {
            Write-Output "[OK] $($ep.name) -> $status ($($elapsed.TotalMilliseconds)ms)"
        } else {
            Write-Output "[FAIL] $($ep.name) -> $validationError"
        }
    } catch {
        $elapsed = (Get-Date) - $start
        $errorMsg = $_.Exception.Message
        $results += [pscustomobject]@{
            name = $ep.name
            url = $url
            status = 0
            success = $false
            timeMs = [int]$elapsed.TotalMilliseconds
            error = $errorMsg
        }
        Write-Output "[FAIL] $($ep.name) -> $errorMsg"
        if ($ep.required) { $allPassed = $false }
    }
}

# Summary
Write-Output "\nE2E Summary:"
$results | Format-Table -AutoSize

if ($allPassed) {
    Write-Output "All required checks passed."
    exit 0
} else {
    Write-Output "One or more required checks failed."
    exit 1
}
