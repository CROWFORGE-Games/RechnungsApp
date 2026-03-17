Add-Type -AssemblyName System.IO.Compression.FileSystem

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$StorePath = Join-Path $Root "data\\store.json"
$KundenPath = "C:\\Users\\mathi\\Downloads\\Kunden.xlsx"
$ArtikelPath = "C:\\Users\\mathi\\Downloads\\Artikel.xlsx"
$ExportDir = Join-Path $Root "google-sheets-sync\\import\\kaindl_daniel"
$Username = "kaindl_daniel"
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Get-XmlFromZipEntry {
  param(
    [Parameter(Mandatory = $true)]$Zip,
    [Parameter(Mandatory = $true)][string]$EntryName
  )

  $entry = $Zip.Entries | Where-Object { $_.FullName -eq $EntryName }
  if (-not $entry) {
    return $null
  }

  $reader = New-Object System.IO.StreamReader($entry.Open())
  try {
    return [xml]$reader.ReadToEnd()
  } finally {
    $reader.Close()
  }
}

function ColumnIndexFromRef {
  param([string]$Ref)

  $letters = ([regex]::Match($Ref, "^[A-Z]+")).Value
  $sum = 0
  foreach ($ch in $letters.ToCharArray()) {
    $sum = ($sum * 26) + ([int][char]$ch - [int][char]'A' + 1)
  }
  return $sum
}

function Read-XlsxTable {
  param([string]$Path)

  $zip = [System.IO.Compression.ZipFile]::OpenRead($Path)
  try {
    $sheetXml = Get-XmlFromZipEntry -Zip $zip -EntryName "xl/worksheets/sheet1.xml"
    if (-not $sheetXml) {
      throw "Arbeitsblatt sheet1.xml in '$Path' nicht gefunden."
    }

    $nsmgr = New-Object System.Xml.XmlNamespaceManager($sheetXml.NameTable)
    $nsmgr.AddNamespace("x", "http://schemas.openxmlformats.org/spreadsheetml/2006/main")

    $rows = $sheetXml.SelectNodes("//x:sheetData/x:row", $nsmgr)
    if (-not $rows -or $rows.Count -lt 1) {
      return @()
    }

    $headers = @{}
    foreach ($cell in $rows[0].SelectNodes("./x:c", $nsmgr)) {
      $idx = ColumnIndexFromRef ([string]$cell.r)
      $valueNode = $cell.SelectSingleNode("./x:v", $nsmgr)
      $headers[$idx] = if ($valueNode) { [string]$valueNode.InnerText } else { "" }
    }

    $items = @()
    for ($rowIndex = 1; $rowIndex -lt $rows.Count; $rowIndex++) {
      $row = $rows[$rowIndex]
      $item = [ordered]@{}
      foreach ($cell in $row.SelectNodes("./x:c", $nsmgr)) {
        $idx = ColumnIndexFromRef ([string]$cell.r)
        $header = [string]$headers[$idx]
        if (-not $header) {
          continue
        }
        $valueNode = $cell.SelectSingleNode("./x:v", $nsmgr)
        $item[$header] = if ($valueNode) { [string]$valueNode.InnerText } else { "" }
      }
      $items += [pscustomobject]$item
    }

    return $items
  } finally {
    $zip.Dispose()
  }
}

function Normalize-Text {
  param([object]$Value)

  if ($null -eq $Value) {
    return ""
  }

  return ([string]$Value).Trim()
}

function Normalize-HeaderName {
  param([string]$Value)

  $text = [string]$Value
  $text = $text.ToLowerInvariant()
  $text = $text.Replace("ä", "ae").Replace("ö", "oe").Replace("ü", "ue").Replace("ß", "ss")
  $text = $text -replace "\s+", ""
  return $text
}

function Get-RowValue {
  param(
    [object]$Row,
    [string[]]$Keys
  )

  $properties = @($Row.PSObject.Properties)
  foreach ($key in $Keys) {
    $normalizedKey = Normalize-HeaderName $key
    $match = $properties | Where-Object { (Normalize-HeaderName $_.Name) -eq $normalizedKey } | Select-Object -First 1
    if ($match) {
      return [string]$match.Value
    }
  }

  return ""
}

function Join-TextParts {
  param([string[]]$Parts)

  return (($Parts | Where-Object { $_ -and $_.Trim() } | ForEach-Object { $_.Trim() }) -join " ").Trim()
}

function Convert-Customers {
  param([array]$Rows)

  $customers = @()
  foreach ($row in $Rows) {
    $companyName = Get-RowValue $row @("Firma")
    $fullName = Join-TextParts @((Get-RowValue $row @("Vorname")), (Get-RowValue $row @("Nachname")))
    $contactField = Get-RowValue $row @("Kontaktperson")
    $fallbackName = if ($contactField) { $contactField } else { $fullName }
    $name = if ($companyName -and $companyName.Trim()) { $companyName.Trim() } else { $fallbackName.Trim() }
    $contactPerson = if ($contactField) {
      $contactField.Trim()
    } elseif (-not $companyName -and $fullName) {
      $fullName
    } else {
      ""
    }

    $customerNumber = (Get-RowValue $row @("Nummer")).Trim()
    if (-not $customerNumber -or -not $name) {
      continue
    }

    $street = Join-TextParts @((Get-RowValue $row @("Straße", "Strasse")), (Get-RowValue $row @("Hausnummer")))
    $phone = @(
      (Get-RowValue $row @("Telefon Firma")),
      (Get-RowValue $row @("Telefon mobil")),
      (Get-RowValue $row @("Telefon privat")),
      (Get-RowValue $row @("Fax"))
    ) | Where-Object { $_ -and $_.Trim() } | Select-Object -First 1

    $noteParts = @()
    $comment = Get-RowValue $row @("Kommentar")
    if ($comment) { $noteParts += $comment.Trim() }

    $customers += [pscustomobject]@{
      id = [guid]::NewGuid().Guid
      customerNumber = $customerNumber
      name = $name
      contactPerson = $contactPerson
      street = $street
      postalCode = (Get-RowValue $row @("PLZ")).Trim()
      city = (Get-RowValue $row @("Ort")).Trim()
      country = (Get-RowValue $row @("Land")).Trim()
      phone = if ($phone) { [string]$phone } else { "" }
      email = (Get-RowValue $row @("Email")).Trim()
      uid = (Get-RowValue $row @("UID")).Trim()
      notes = ($noteParts -join "`n`n").Trim()
    }
  }

  return $customers
}

function Convert-Articles {
  param([array]$Rows)

  $articles = @()
  foreach ($row in $Rows) {
    $number = (Get-RowValue $row @("Nummer")).Trim()
    $name = (Get-RowValue $row @("Name")).Trim()
    if (-not $number -or -not $name) {
      continue
    }

    $articles += [pscustomobject]@{
      id = [guid]::NewGuid().Guid
      group = (Get-RowValue $row @("Gruppe")).Trim()
      number = $number
      name = $name
      description = (Get-RowValue $row @("Beschreibung")).Trim()
      unit = if (Get-RowValue $row @("Einheit")) { (Get-RowValue $row @("Einheit")).Trim() } else { "Stunden" }
      unitPrice = if (Get-RowValue $row @("Verkaufspreis")) { [double]((Get-RowValue $row @("Verkaufspreis")) -replace ",", ".") } else { 0 }
      taxRate = if (Get-RowValue $row @("MwstProzent")) { [int](Get-RowValue $row @("MwstProzent")) } else { 20 }
    }
  }

  return $articles
}

function Export-GoogleSheetRows {
  param(
    [string]$ExportPath,
    [string]$Username,
    [object]$Settings,
    [array]$Customers,
    [array]$Articles
  )

  if (-not (Test-Path $ExportDir)) {
    New-Item -ItemType Directory -Path $ExportDir -Force | Out-Null
  }

  $timestamp = (Get-Date).ToString("o")

  @(
    [pscustomobject]@{
      username = $Username
      settings_json = ($Settings | ConvertTo-Json -Depth 100 -Compress)
      updated_at = $timestamp
    }
  ) | Export-Csv -Path (Join-Path $ExportDir "User.csv") -NoTypeInformation -Encoding UTF8

  $Customers | ForEach-Object {
    [pscustomobject]@{
      username = $Username
      customer_id = $_.id
      payload_json = ($_ | ConvertTo-Json -Depth 20 -Compress)
      updated_at = $timestamp
    }
  } | Export-Csv -Path (Join-Path $ExportDir "Kunden.csv") -NoTypeInformation -Encoding UTF8

  $Articles | ForEach-Object {
    [pscustomobject]@{
      username = $Username
      article_id = $_.id
      payload_json = ($_ | ConvertTo-Json -Depth 20 -Compress)
      updated_at = $timestamp
    }
  } | Export-Csv -Path (Join-Path $ExportDir "Artikel.csv") -NoTypeInformation -Encoding UTF8

  $summary = [pscustomobject]@{
    username = $Username
    customers = $Customers.Count
    articles = $Articles.Count
    exportedAt = $timestamp
  } | ConvertTo-Json

  [System.IO.File]::WriteAllText((Join-Path $ExportDir "summary.json"), $summary, $Utf8NoBom)
}

$customers = Convert-Customers (Read-XlsxTable -Path $KundenPath)
$articles = Convert-Articles (Read-XlsxTable -Path $ArtikelPath)

$store = Get-Content $StorePath -Raw | ConvertFrom-Json
$user = $store.users | Where-Object { $_.username -eq $Username } | Select-Object -First 1
if (-not $user) {
  throw "Benutzer '$Username' in store.json nicht gefunden."
}

$user.customers = @($customers)
$user.articles = @($articles)
$user.updatedAt = (Get-Date).ToString("o")

$storeJson = $store | ConvertTo-Json -Depth 100
[System.IO.File]::WriteAllText($StorePath, $storeJson, $Utf8NoBom)

Export-GoogleSheetRows -ExportPath $ExportDir -Username $Username -Settings $user.settings -Customers $customers -Articles $articles

Write-Output \"Import abgeschlossen: $($customers.Count) Kunden, $($articles.Count) Artikel für $Username.\"
