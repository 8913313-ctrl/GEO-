$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

Add-Type -ReferencedAssemblies 'System.Drawing.dll' -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;

public static class PublicBrandVariantBuilder
{
    private static byte[] ReadPixels(Bitmap bitmap, out int stride)
    {
        Rectangle bounds = new Rectangle(0, 0, bitmap.Width, bitmap.Height);
        BitmapData data = bitmap.LockBits(bounds, ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
        try
        {
            stride = data.Stride;
            byte[] pixels = new byte[stride * bitmap.Height];
            Marshal.Copy(data.Scan0, pixels, 0, pixels.Length);
            return pixels;
        }
        finally
        {
            bitmap.UnlockBits(data);
        }
    }

    private static double JpegCoverage(byte green, byte blue)
    {
        double coverage = 1.0 - ((green + blue) / 510.0);
        if (coverage <= 0.018) return 0.0;
        double normalized = Math.Min(1.0, (coverage - 0.018) / 0.982);
        return Math.Pow(normalized, 0.92);
    }

    public static void FromRedOnWhite(string sourcePath, string destinationPath, Color fill, int padding)
    {
        using (Bitmap source = new Bitmap(sourcePath))
        {
            int sourceStride;
            byte[] sourcePixels = ReadPixels(source, out sourceStride);
            int minX = source.Width, minY = source.Height, maxX = -1, maxY = -1;

            for (int y = 0; y < source.Height; y++)
            {
                for (int x = 0; x < source.Width; x++)
                {
                    int index = y * sourceStride + x * 4;
                    if (JpegCoverage(sourcePixels[index + 1], sourcePixels[index]) <= 0.025) continue;
                    minX = Math.Min(minX, x);
                    minY = Math.Min(minY, y);
                    maxX = Math.Max(maxX, x);
                    maxY = Math.Max(maxY, y);
                }
            }

            if (maxX < minX || maxY < minY) throw new InvalidOperationException("No logo pixels found.");
            WriteVariant(sourcePixels, sourceStride, minX, minY, maxX, maxY, destinationPath, fill, padding, true);
        }
    }

    public static void FromAlpha(string sourcePath, string destinationPath, Color fill, int padding)
    {
        using (Bitmap source = new Bitmap(sourcePath))
        {
            int sourceStride;
            byte[] sourcePixels = ReadPixels(source, out sourceStride);
            int minX = source.Width, minY = source.Height, maxX = -1, maxY = -1;

            for (int y = 0; y < source.Height; y++)
            {
                for (int x = 0; x < source.Width; x++)
                {
                    int index = y * sourceStride + x * 4;
                    if (sourcePixels[index + 3] <= 7) continue;
                    minX = Math.Min(minX, x);
                    minY = Math.Min(minY, y);
                    maxX = Math.Max(maxX, x);
                    maxY = Math.Max(maxY, y);
                }
            }

            if (maxX < minX || maxY < minY) throw new InvalidOperationException("No logo pixels found.");
            WriteVariant(sourcePixels, sourceStride, minX, minY, maxX, maxY, destinationPath, fill, padding, false);
        }
    }

    private static void WriteVariant(
        byte[] sourcePixels,
        int sourceStride,
        int minX,
        int minY,
        int maxX,
        int maxY,
        string destinationPath,
        Color fill,
        int padding,
        bool redOnWhite)
    {
        int width = maxX - minX + 1 + padding * 2;
        int height = maxY - minY + 1 + padding * 2;
        using (Bitmap output = new Bitmap(width, height, PixelFormat.Format32bppArgb))
        {
            Rectangle bounds = new Rectangle(0, 0, width, height);
            BitmapData outputData = output.LockBits(bounds, ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
            try
            {
                byte[] outputPixels = new byte[outputData.Stride * height];
                for (int y = minY; y <= maxY; y++)
                {
                    for (int x = minX; x <= maxX; x++)
                    {
                        int sourceIndex = y * sourceStride + x * 4;
                        byte alpha = redOnWhite
                            ? (byte)Math.Min(255, Math.Round(255 * JpegCoverage(sourcePixels[sourceIndex + 1], sourcePixels[sourceIndex])))
                            : sourcePixels[sourceIndex + 3];
                        if (alpha <= 7) continue;

                        int outputX = x - minX + padding;
                        int outputY = y - minY + padding;
                        int outputIndex = outputY * outputData.Stride + outputX * 4;
                        outputPixels[outputIndex] = fill.B;
                        outputPixels[outputIndex + 1] = fill.G;
                        outputPixels[outputIndex + 2] = fill.R;
                        outputPixels[outputIndex + 3] = alpha;
                    }
                }
                Marshal.Copy(outputPixels, 0, outputData.Scan0, outputPixels.Length);
            }
            finally
            {
                output.UnlockBits(outputData);
            }
            output.Save(destinationPath, ImageFormat.Png);
        }
    }
}
'@

$projectRoot = Split-Path -Parent $PSScriptRoot
$assetRoot = Join-Path $projectRoot 'public-site\assets'
$gold = [System.Drawing.ColorTranslator]::FromHtml('#D8C08B')
$wine = [System.Drawing.ColorTranslator]::FromHtml('#70263B')

[PublicBrandVariantBuilder]::FromRedOnWhite(
  (Join-Path $projectRoot 'public\assets\zhuojian-ai-logo.jpg'),
  (Join-Path $assetRoot 'zhuojian-ai-lockup-gold.png'),
  $gold,
  12
)

[PublicBrandVariantBuilder]::FromAlpha(
  (Join-Path $assetRoot 'tongzhuo-official-mark.png'),
  (Join-Path $assetRoot 'tongzhuo-mark-gold.png'),
  $gold,
  10
)

[PublicBrandVariantBuilder]::FromAlpha(
  (Join-Path $assetRoot 'tongzhuo-official-mark.png'),
  (Join-Path $assetRoot 'tongzhuo-mark-wine.png'),
  $wine,
  10
)

Write-Output 'Public brand variants generated.'
