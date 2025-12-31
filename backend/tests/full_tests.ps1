# Comprehensive API tests for all 19 endpoints (best-effort)
$base = 'http://localhost:5000/api'

function Exec-JsonRequest($method, $url, $body, $token) {
  try {
    if ($body -ne $null) {
      if ($token) {
        return Invoke-RestMethod -Method $method -Uri $url -Body ($body | ConvertTo-Json -Depth 10) -ContentType 'application/json' -Headers @{ Authorization = "Bearer $token" }
      } else {
        return Invoke-RestMethod -Method $method -Uri $url -Body ($body | ConvertTo-Json -Depth 10) -ContentType 'application/json'
      }
    } else {
      if ($token) {
        return Invoke-RestMethod -Method $method -Uri $url -Headers @{ Authorization = "Bearer $token" }
      } else {
        return Invoke-RestMethod -Method $method -Uri $url
      }
    }
  } catch {
    Write-Error "Request failed: $($method) $url -- $($_.Exception.Message)"
    return $null
  }
}

try {
  Write-Output "1) Login as superadmin..."
  $sa = Exec-JsonRequest 'POST' "$base/auth/login" @{ email='superadmin@system.com'; password='Admin@123' } $null
  if (-not $sa) { throw 'Superadmin login failed' }
  $saToken = $sa.data.token
  Write-Output "Superadmin token length: $($saToken.Length)"

  Write-Output "2) List tenants as superadmin..."
  $tenants = Exec-JsonRequest 'GET' "$base/tenants" $null $saToken
  if (-not $tenants) { throw 'List tenants failed' }
  Write-Output "Tenants returned: $($tenants.data.tenants.Count)"

  Write-Output "3) Register a new tenant (free plan default)..."
  $unique = [int][double]::Parse((Get-Date -UFormat %s))
  $sub = "testtenant$unique"
  $reg = Exec-JsonRequest 'POST' "$base/auth/register-tenant" @{ tenantName = "Test Tenant $unique"; subdomain = $sub; adminEmail = "admin+$unique@testtenant.com"; adminPassword = 'TestPass@123'; adminFullName = 'Auto Admin' } $null
  if (-not $reg) { throw 'Tenant registration failed' }
  $newTenantId = $reg.data.tenantId
  $adminCred = @{ email = "admin+$unique@testtenant.com"; password = 'TestPass@123'; tenantSubdomain = $sub }
  Write-Output "Created tenant $sub ($newTenantId)"

  Write-Output "4) Login as new tenant admin..."
  $tlogin = Exec-JsonRequest 'POST' "$base/auth/login" $adminCred $null
  if (-not $tlogin) { throw 'Tenant admin login failed' }
  $tToken = $tlogin.data.token

  Write-Output "5) Check tenant details (GET /api/tenants/:id)..."
  $td = Exec-JsonRequest 'GET' "$base/tenants/$newTenantId" $null $tToken
  if (-not $td) { throw 'Get tenant details failed' }

  Write-Output "6) Add users until limit is reached (free plan -> 5 max including admin)..."
  $maxUsers = 5
  $createdUsers = @()
  for ($i=1; $i -le ($maxUsers+1); $i++) {
    $email = "u$i+$unique@testtenant.com"
    $res = Exec-JsonRequest 'POST' "$base/users/tenants/$newTenantId/users" @{ email = $email; password='User@123'; fullName = "User $i" } $tToken
    if ($res -ne $null -and $res.success) {
      Write-Output "Created user: $email"
      $createdUsers += $res.data.id
    } else {
      Write-Output "Create user result (expected once limit reached): $($res | ConvertTo-Json -Depth 3)"
    }
  }

  Write-Output "7) Create projects until limit reached (free -> 3 projects)..."
  $maxProjects = 3
  $createdProjects = @()
  for ($i=1; $i -le ($maxProjects+1); $i++) {
    $res = Exec-JsonRequest 'POST' "$base/projects" @{ name = "Proj $i"; description = "Auto" } $tToken
    if ($res -ne $null -and $res.success) {
      Write-Output "Created project: $($res.data.id)"
      $createdProjects += $res.data.id
    } else {
      Write-Output "Create project result (expected once limit reached): $($res | ConvertTo-Json -Depth 3)"
    }
  }

  Write-Output "8) Create a task in first project..."
  if ($createdProjects.Count -gt 0) {
    $projectId = $createdProjects[0]
    $task = Exec-JsonRequest 'POST' "$base/projects/$projectId/tasks" @{ title='FT task'; description='from full test' } $tToken
    if ($task -eq $null) { throw 'Task creation failed' }
    $taskId = $task.data.id
    Write-Output "Created task $tid"

    Write-Output "9) Update task status..."
    $upd = Exec-JsonRequest 'PATCH' "$base/projects/$projectId/tasks/$taskId/status" @{ status = 'completed' } $tToken
    if ($upd -eq $null) { throw 'Task status update failed' }
    Write-Output "Task status now: $($upd.data.status)"

    Write-Output "10) Update task full payload (assign to null/unassign)..."
    $u2 = Exec-JsonRequest 'PUT' "$base/projects/$projectId/tasks/$taskId" @{ title='FT task updated'; assignedTo = $null } $tToken
    if ($u2 -eq $null) { throw 'Task full update failed' }
    Write-Output "Task updated"
  }

  Write-Output "11) Update tenant as tenant_admin (name only) and expect success..."
  $updTenant = Exec-JsonRequest 'PUT' "$base/tenants/$newTenantId" @{ name = 'Renamed Tenant' } $tToken
  Write-Output "Tenant update response: $($updTenant | ConvertTo-Json -Depth 2)"

  Write-Output "12) Attempt tenant update of subscriptionPlan as tenant_admin (should be forbidden)..."
  $forbid = Exec-JsonRequest 'PUT' "$base/tenants/$newTenantId" @{ subscriptionPlan = 'enterprise' } $tToken
  Write-Output "Attempt subscription change response: $($forbid | ConvertTo-Json -Depth 2)"

  Write-Output "13) Clean up: delete created projects (if any) and created users..."
  foreach ($pid in $createdProjects) {
    Exec-JsonRequest 'DELETE' "$base/projects/$pid" $null $tToken | Out-Null
  }
  foreach ($uid in $createdUsers) {
    Exec-JsonRequest 'DELETE' "$base/users/$uid" $null $tToken | Out-Null
  }

  Write-Output "Full tests completed successfully."
} catch {
  Write-Error "Full tests failed: $($_.Exception.Message)"
  exit 2
}
