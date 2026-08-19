$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Drawing

$assetDirectory = Join-Path $PSScriptRoot "..\public-site\assets"
New-Item -ItemType Directory -Force -Path $assetDirectory | Out-Null

$themes = @(
  @{ File = "template-01-default.png"; Base = "#102a43"; Accent = "#f59e0b"; Label = "INDUSTRY" },
  @{ File = "template-02-default.png"; Base = "#263238"; Accent = "#d6b36a"; Label = "PROJECT" },
  @{ File = "template-03-default.png"; Base = "#073b4c"; Accent = "#33d6b2"; Label = "SYSTEM" },
  @{ File = "template-04-default.png"; Base = "#082f49"; Accent = "#38bdf8"; Label = "NETWORK" },
  @{ File = "template-05-default.png"; Base = "#2e1065"; Accent = "#c4b5fd"; Label = "METHOD" },
  @{ File = "template-06-default.png"; Base = "#052e16"; Accent = "#86efac"; Label = "TRUST" },
  @{ File = "template-07-default.png"; Base = "#134e4a"; Accent = "#99f6e4"; Label = "CARE" },
  @{ File = "template-08-default.png"; Base = "#431407"; Accent = "#fdba74"; Label = "LEARN" },
  @{ File = "template-09-default.png"; Base = "#4c0519"; Accent = "#fda4af"; Label = "DESTINATION" },
  @{ File = "template-10-default.png"; Base = "#431407"; Accent = "#fcd34d"; Label = "STORY" }
)

function Convert-HexColor([string]$value) {
  return [System.Drawing.ColorTranslator]::FromHtml($value)
}

foreach ($theme in $themes) {
  $bitmap = [System.Drawing.Bitmap]::new(1600, 960)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $baseColor = Convert-HexColor $theme.Base
  $accentColor = Convert-HexColor $theme.Accent
  $darkColor = [System.Drawing.Color]::FromArgb(
    255,
    [Math]::Max(0, $baseColor.R - 18),
    [Math]::Max(0, $baseColor.G - 18),
    [Math]::Max(0, $baseColor.B - 18)
  )
  $gradient = [System.Drawing.Drawing2D.LinearGradientBrush]::new(
    [System.Drawing.Rectangle]::new(0, 0, 1600, 960),
    $baseColor,
    $darkColor,
    28
  )
  $graphics.FillRectangle($gradient, 0, 0, 1600, 960)

  $linePen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(32, $accentColor.R, $accentColor.G, $accentColor.B), 2)
  for ($x = -300; $x -lt 1900; $x += 96) {
    $graphics.DrawLine($linePen, $x, 0, $x + 720, 960)
  }
  for ($y = 80; $y -lt 960; $y += 120) {
    $graphics.DrawLine($linePen, 0, $y, 1600, $y - 240)
  }

  $accentBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(62, $accentColor.R, $accentColor.G, $accentColor.B))
  $mutedBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(28, 255, 255, 255))
  $graphics.FillPolygon($accentBrush, @(
    [System.Drawing.Point]::new(1020, -40),
    [System.Drawing.Point]::new(1600, 180),
    [System.Drawing.Point]::new(1600, 590),
    [System.Drawing.Point]::new(1240, 360)
  ))
  $graphics.FillPolygon($mutedBrush, @(
    [System.Drawing.Point]::new(0, 690),
    [System.Drawing.Point]::new(480, 520),
    [System.Drawing.Point]::new(920, 960),
    [System.Drawing.Point]::new(0, 960)
  ))

  $numberFont = [System.Drawing.Font]::new("Segoe UI", 128, [System.Drawing.FontStyle]::Bold)
  $labelFont = [System.Drawing.Font]::new("Segoe UI", 26, [System.Drawing.FontStyle]::Regular)
  $numberBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(210, 255, 255, 255))
  $labelBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(220, $accentColor.R, $accentColor.G, $accentColor.B))
  $templateNumber = [Array]::IndexOf($themes, $theme) + 1
  $graphics.DrawString($templateNumber.ToString("00"), $numberFont, $numberBrush, 110, 110)
  $graphics.DrawString("TEMPLATE / $($theme.Label)", $labelFont, $labelBrush, 128, 286)

  $outputPath = Join-Path $assetDirectory $theme.File
  $bitmap.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)

  $labelBrush.Dispose()
  $numberBrush.Dispose()
  $labelFont.Dispose()
  $numberFont.Dispose()
  $mutedBrush.Dispose()
  $accentBrush.Dispose()
  $linePen.Dispose()
  $gradient.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

Write-Output "Generated $($themes.Count) template default images in $assetDirectory"
