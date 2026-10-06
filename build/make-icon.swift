// Draws the app icon (文A) and writes build/icon.icns and build/icon.png.
// Run from the project root: swift build/make-icon.swift

import AppKit

func render(_ size: Int) -> Data {
  let rep = NSBitmapImageRep(
    bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8,
    samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
    bytesPerRow: 0, bitsPerPixel: 0)!
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)

  // macOS icon grid: an 824pt rounded square centered on a 1024pt canvas.
  let s = CGFloat(size) / 1024
  let body = NSRect(x: 100 * s, y: 100 * s, width: 824 * s, height: 824 * s)
  let shape = NSBezierPath(roundedRect: body, xRadius: 185 * s, yRadius: 185 * s)
  NSGradient(
    starting: NSColor(srgbRed: 0.36, green: 0.55, blue: 1.0, alpha: 1),
    ending: NSColor(srgbRed: 0.20, green: 0.30, blue: 0.85, alpha: 1)
  )!.draw(in: shape, angle: -90)

  let text = NSAttributedString(
    string: "文A",
    attributes: [
      .font: NSFont.systemFont(ofSize: 380 * s, weight: .semibold),
      .foregroundColor: NSColor.white,
    ])
  let t = text.size()
  text.draw(at: NSPoint(x: body.midX - t.width / 2, y: body.midY - t.height / 2))

  NSGraphicsContext.restoreGraphicsState()
  return rep.representation(using: .png, properties: [:])!
}

let iconset = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("icon.iconset")
try? FileManager.default.removeItem(at: iconset)
try! FileManager.default.createDirectory(at: iconset, withIntermediateDirectories: true)

for base in [16, 32, 128, 256, 512] {
  try! render(base).write(to: iconset.appendingPathComponent("icon_\(base)x\(base).png"))
  try! render(base * 2).write(to: iconset.appendingPathComponent("icon_\(base)x\(base)@2x.png"))
}

// Also used as the logo in README.md.
try! render(256).write(to: URL(fileURLWithPath: "build/icon.png"))

let iconutil = Process()
iconutil.executableURL = URL(fileURLWithPath: "/usr/bin/iconutil")
iconutil.arguments = ["-c", "icns", iconset.path, "-o", "build/icon.icns"]
try! iconutil.run()
iconutil.waitUntilExit()
