# Authenticated smoke tests for key endpoints
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
  Write-Output "Logging in as demo tenant admin..."
  $adminLogin = Exec-JsonRequest 'POST' "$base/auth/login" @{ email = 'admin@demo.com'; password = 'Demo@123'; tenantSubdomain = 'demo' } $null
  if (-not $adminLogin) { throw "Admin login failed" }
  $adminToken = $adminLogin.data.token
  Write-Output "Demo admin token obtained (length): $($adminToken.Length)"

  $tenantId = $adminLogin.data.user.tenantId
  Write-Output "Listing users for tenant ($tenantId)..."
  $users = Exec-JsonRequest 'GET' "$base/users/tenants/$tenantId/users" $null $adminToken
  if ($users) { Write-Output "Users count: $($users.data.Count)" }

  Write-Output "Creating a project..."
  $proj = Exec-JsonRequest 'POST' "$base/projects" @{ name = 'smoke-project'; description = 'Created by smoke tests' } $adminToken
  if (-not $proj) { throw 'Project creation failed' }
  $projId = $proj.data.id
  Write-Output "Created project id: $projId"

  Write-Output "Creating a task under project..."
  $task = Exec-JsonRequest 'POST' "$base/projects/$projId/tasks" @{ title = 'smoke task'; description = 'smoke'; status = 'todo' } $adminToken
  if (-not $task) { throw 'Task creation failed' }
  $taskId = $task.data.id
  Write-Output "Created task id: $taskId"

  Write-Output "Updating task status..."
  $upd = Exec-JsonRequest 'PATCH' "$base/projects/$projId/tasks/$taskId/status" @{ status = 'in_progress' } $adminToken
  if ($upd) { Write-Output "Updated task status: $($upd.data.status)" }

  Write-Output "Updating project name..."
  $updproj = Exec-JsonRequest 'PUT' "$base/projects/$projId" @{ name = 'smoke-project-updated' } $adminToken
  if ($updproj) { Write-Output "Updated project name: $($updproj.data.name)" }

  Write-Output "Deleting project (cleanup)..."
  $del = Exec-JsonRequest 'DELETE' "$base/projects/$projId" $null $adminToken
  if ($del) { Write-Output "Deleted project success: $($del.success)" }

  Write-Output "Logging in as super admin..."
  $saLogin = Exec-JsonRequest 'POST' "$base/auth/login" @{ email = 'superadmin@system.com'; password = 'Admin@123' } $null
  if (-not $saLogin) { throw 'Superadmin login failed' }
  $saToken = $saLogin.data.token
  Write-Output "Superadmin token obtained (length): $($saToken.Length)"

  Write-Output "Listing tenants as superadmin..."
  $tenants = Exec-JsonRequest 'GET' "$base/tenants" $null $saToken
  if ($tenants) { Write-Output "Tenants count: $($tenants.data.Count)" }

  Write-Output "Smoke tests completed successfully."
} catch {
  Write-Error "Smoke tests failed: $($_.Exception.Message)"
  exit 2
}
