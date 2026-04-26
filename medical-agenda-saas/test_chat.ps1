try {
    $baseUrl = "http://localhost:3000"
    $loginUrl = "$baseUrl/api/auth/login"
    $meUrl = "$baseUrl/api/auth/me"
    $chatUrl = "$baseUrl/chat/doctor"

    $loginBody = @{
        identifier = "doctor@clinic.com" # Changed .local to .com
        password = "ChangeMe123!"
    } | ConvertTo-Json

    $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    $loginRes = Invoke-RestMethod -Uri $loginUrl -Method Post -Body $loginBody -ContentType "application/json" -WebSession $session
    
    $meRes = Invoke-RestMethod -Uri $meUrl -Method Get -WebSession $session
    $doctorId = $meRes.user.id # Updated property path based on common API structures

    $chat1Body = @{
        doctor_id = $doctorId
        message = "hola"
        context = @{}
    } | ConvertTo-Json
    $chat1Res = Invoke-RestMethod -Uri $chatUrl -Method Post -Body $chat1Body -ContentType "application/json" -WebSession $session

    $chat2Body = @{
        doctor_id = $doctorId
        message = "y ahora?"
        context = @{}
    } | ConvertTo-Json
    $chat2Res = Invoke-RestMethod -Uri $chatUrl -Method Post -Body $chat2Body -ContentType "application/json" -WebSession $session

    $result = @{
        login_ok = $true
        doctor_id = $doctorId
        first_response = $chat1Res.response
        first_source = $chat1Res.source
        second_response = $chat2Res.response
        second_source = $chat2Res.source
    }
    $result | ConvertTo-Json
} catch {
    $err = $_
    $res = @{
        login_ok = $false
        error = $err.Exception.Message
    }
    if ($err.Exception -and $err.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($err.Exception.Response.GetResponseStream())
        $res.body = $reader.ReadToEnd()
    }
    $res | ConvertTo-Json
}
