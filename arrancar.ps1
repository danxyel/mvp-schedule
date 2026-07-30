Get-Content .env | ForEach-Object {
    if ($_ -match "^([^#=][^=]*)=(.+)$") {
        [System.Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim())
    }
}
.\venv\Scripts\Activate.ps1
uvicorn app.main:app --reload
