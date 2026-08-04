[CmdletBinding()]
param(
    [string]$OutputPath = ''
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
    $OutputPath = Join-Path (Split-Path -Parent $PSScriptRoot) 'assets\tongzhuo-geo-publisher.ico'
}

function Add-RoundedRectanglePath {
    param(
        [System.Drawing.Drawing2D.GraphicsPath]$Path,
        [int]$X,
        [int]$Y,
        [int]$Width,
        [int]$Height,
        [int]$Radius
    )

    $diameter = $Radius * 2
    $Path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
    $Path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
    $Path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
    $Path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
    $Path.CloseFigure()
}

function New-IconImageData {
    param([int]$Size)

    $bitmap = [System.Drawing.Bitmap]::new($Size, $Size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $background = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#2B63D9'))
    $border = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml('#75A0FF'), [single][Math]::Max(1, $Size * .016))
    $foreground = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
    $font = [System.Drawing.Font]::new('Segoe UI', [single][Math]::Max(8, $Size * .36), [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
    $format = [System.Drawing.StringFormat]::new()
    $format.Alignment = [System.Drawing.StringAlignment]::Center
    $format.LineAlignment = [System.Drawing.StringAlignment]::Center
    $memory = [System.IO.MemoryStream]::new()
    $writer = $null

    try {
        $margin = [int][Math]::Max(1, [Math]::Round($Size * .055))
        $radius = [int][Math]::Max(3, [Math]::Round($Size * .203))
        $drawSize = $Size - ($margin * 2)
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
        $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
        $graphics.Clear([System.Drawing.Color]::Transparent)
        Add-RoundedRectanglePath -Path $path -X $margin -Y $margin -Width $drawSize -Height $drawSize -Radius $radius
        $graphics.FillPath($background, $path)
        $graphics.DrawPath($border, $path)
        $graphics.DrawString('TZ', $font, $foreground, [System.Drawing.RectangleF]::new(0, 0, $Size, $Size), $format)

        $pixelData = [byte[]]::new($Size * $Size * 4)
        $offset = 0
        for ($y = $Size - 1; $y -ge 0; $y -= 1) {
            for ($x = 0; $x -lt $Size; $x += 1) {
                $pixel = $bitmap.GetPixel($x, $y)
                $pixelData[$offset] = $pixel.B
                $pixelData[$offset + 1] = $pixel.G
                $pixelData[$offset + 2] = $pixel.R
                $pixelData[$offset + 3] = $pixel.A
                $offset += 4
            }
        }
        $maskRowBytes = [int]([Math]::Ceiling($Size / 32.0) * 4)
        $maskData = [byte[]]::new($maskRowBytes * $Size)

        $writer = [System.IO.BinaryWriter]::new($memory)
        $writer.Write([Int32]40)
        $writer.Write([Int32]$Size)
        $writer.Write([Int32]($Size * 2))
        $writer.Write([Int16]1)
        $writer.Write([Int16]32)
        $writer.Write([Int32]0)
        $writer.Write([Int32]$pixelData.Length)
        $writer.Write([Int32]0)
        $writer.Write([Int32]0)
        $writer.Write([Int32]0)
        $writer.Write([Int32]0)
        $writer.Write($pixelData)
        $writer.Write($maskData)
        $writer.Flush()
        return [pscustomobject]@{ Size = $Size; Data = $memory.ToArray() }
    } finally {
        if ($writer) { $writer.Dispose() }
        $memory.Dispose()
        $format.Dispose()
        $font.Dispose()
        $foreground.Dispose()
        $border.Dispose()
        $background.Dispose()
        $path.Dispose()
        $graphics.Dispose()
        $bitmap.Dispose()
    }
}

$resolvedOutput = [IO.Path]::GetFullPath($OutputPath)
$outputDirectory = Split-Path -Parent $resolvedOutput
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
$images = @(foreach ($iconSize in @(16, 32, 48, 64, 128, 256)) { New-IconImageData -Size $iconSize })
$outputStream = $null
$writer = $null

try {
    $outputStream = [System.IO.FileStream]::new($resolvedOutput, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
    $writer = [System.IO.BinaryWriter]::new($outputStream)
    $writer.Write([UInt16]0)
    $writer.Write([UInt16]1)
    $writer.Write([UInt16]$images.Count)

    $offset = 6 + (16 * $images.Count)
    foreach ($image in $images) {
        $encodedSize = if ($image.Size -ge 256) { [byte]0 } else { [byte]$image.Size }
        $writer.Write($encodedSize)
        $writer.Write($encodedSize)
        $writer.Write([byte]0)
        $writer.Write([byte]0)
        $writer.Write([UInt16]1)
        $writer.Write([UInt16]32)
        $writer.Write([UInt32]$image.Data.Length)
        $writer.Write([UInt32]$offset)
        $offset += $image.Data.Length
    }
    foreach ($image in $images) { $writer.Write($image.Data) }
} finally {
    if ($writer) { $writer.Dispose() }
    if ($outputStream) { $outputStream.Dispose() }
}

Write-Host "Generated application icon: $resolvedOutput"
