// Draws the app icon and writes every copy of it:
//   build/icon.icns            the app (macOS icon grid)
//   build/icon.png             README.md logo
//   docs/icon.png              website logo and favicon (full-bleed square)
//   src/main/assets/trayTemplate[@2x].png   menu bar (monochrome template image)
// Run from the project root: swift build/make-icon.swift
//
// Same design as the app (src/renderer/style.css): flat, square corners, thin lines.
// Two overlapping squares, 文 (outlined) behind A (accent), on the dark background.

import AppKit

let bg = NSColor(srgbRed: 0x0f / 255, green: 0x0f / 255, blue: 0x11 / 255, alpha: 1)
let fg = NSColor(srgbRed: 0xed / 255, green: 0xed / 255, blue: 0xea / 255, alpha: 1)
let line = NSColor(srgbRed: 0x2a / 255, green: 0x2a / 255, blue: 0x2e / 255, alpha: 1)
let accent = NSColor(srgbRed: 0x0a / 255, green: 0x84 / 255, blue: 0xff / 255, alpha: 1)

enum Style { case app, web, tray }

func bitmap(_ size: Int, _ draw: () -> Void) -> Data {
  let rep = NSBitmapImageRep(
    bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8,
    samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
    bytesPerRow: 0, bitsPerPixel: 0)!
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
  draw()
  NSGraphicsContext.restoreGraphicsState()
  return rep.representation(using: .png, properties: [:])!
}

// Draws `string` centered on `center`, optionally punching it out of what is already drawn.
func glyph(_ string: String, _ font: NSFont, _ color: NSColor, _ center: NSPoint, knockout: Bool = false) {
  let text = NSAttributedString(string: string, attributes: [.font: font, .foregroundColor: color])
  let bounds = text.boundingRect(with: .zero, options: [.usesLineFragmentOrigin, .usesDeviceMetrics])
  let ctx = NSGraphicsContext.current!
  ctx.saveGraphicsState()
  if knockout { ctx.cgContext.setBlendMode(.destinationOut) }
  text.draw(at: NSPoint(x: center.x - bounds.midX, y: center.y - bounds.midY))
  ctx.restoreGraphicsState()
}

func render(_ size: Int, _ style: Style) -> Data {
  bitmap(size) {
    let px = CGFloat(size)
    let tray = style == .tray

    // The mark is laid out on a 600-unit grid: back square 0…400, front square 200…600.
    let markSide: CGFloat
    switch style {
    case .app:
      // macOS icon grid: an 824pt rounded square centered on a 1024pt canvas.
      let s = px / 1024
      let body = NSRect(x: 100 * s, y: 100 * s, width: 824 * s, height: 824 * s)
      let shape = NSBezierPath(roundedRect: body, xRadius: 185 * s, yRadius: 185 * s)
      bg.setFill()
      shape.fill()
      line.setStroke()
      let border = NSBezierPath(
        roundedRect: body.insetBy(dx: 3 * s, dy: 3 * s), xRadius: 182 * s, yRadius: 182 * s)
      border.lineWidth = max(6 * s, 1)
      border.stroke()
      markSide = 560 * s
    case .web:
      bg.setFill()
      NSRect(x: 0, y: 0, width: px, height: px).fill()
      line.setStroke()
      let border = NSBezierPath(rect: NSRect(x: 0, y: 0, width: px, height: px).insetBy(dx: px / 128, dy: px / 128))
      border.lineWidth = max(px / 64, 1)
      border.stroke()
      markSide = px * 0.7
    case .tray:
      markSide = px * 0.9
    }

    let u = markSide / 600
    let origin = NSPoint(x: (px - markSide) / 2, y: (px - markSide) / 2)
    // Grid coordinates go top-down, AppKit's bottom-up.
    func rect(_ x: CGFloat, _ y: CGFloat, _ w: CGFloat, _ h: CGFloat) -> NSRect {
      NSRect(x: origin.x + x * u, y: origin.y + (600 - y - h) * u, width: w * u, height: h * u)
    }
    func point(_ x: CGFloat, _ y: CGFloat) -> NSPoint {
      NSPoint(x: origin.x + x * u, y: origin.y + (600 - y) * u)
    }

    // Back square: a thin outline with 文 in its visible corner.
    let stroke = max((tray ? 44 : 26) * u, 1)
    let back = NSBezierPath(rect: rect(0, 0, 400, 400).insetBy(dx: stroke / 2, dy: stroke / 2))
    back.lineWidth = stroke
    (tray ? NSColor.black : fg).setStroke()
    back.stroke()
    if !tray {
      glyph("文", .systemFont(ofSize: 155 * u, weight: .medium), fg, point(112, 112))
    }

    // Front square: solid accent with A, separated from the outline by a gap.
    let gap = (tray ? 40 : 30) * u
    let ctx = NSGraphicsContext.current!
    ctx.saveGraphicsState()
    if tray {
      ctx.compositingOperation = .clear
    } else {
      bg.setFill()
    }
    rect(200 - gap, 200 - gap, 400 + gap, 400 + gap).fill()
    ctx.restoreGraphicsState()
    (tray ? NSColor.black : accent).setFill()
    rect(200, 200, 400, 400).fill()
    glyph(
      "A", .monospacedSystemFont(ofSize: 300 * u, weight: .semibold), tray ? .black : .white,
      point(400, 400), knockout: tray)
  }
}

func write(_ data: Data, _ path: String) {
  try! data.write(to: URL(fileURLWithPath: path))
}

let iconset = URL(fileURLWithPath: NSTemporaryDirectory()).appendingPathComponent("icon.iconset")
try? FileManager.default.removeItem(at: iconset)
try! FileManager.default.createDirectory(at: iconset, withIntermediateDirectories: true)

for base in [16, 32, 128, 256, 512] {
  write(render(base, .app), iconset.appendingPathComponent("icon_\(base)x\(base).png").path)
  write(render(base * 2, .app), iconset.appendingPathComponent("icon_\(base)x\(base)@2x.png").path)
}

write(render(256, .app), "build/icon.png")
write(render(256, .web), "docs/icon.png")

try! FileManager.default.createDirectory(atPath: "src/main/assets", withIntermediateDirectories: true)
write(render(18, .tray), "src/main/assets/trayTemplate.png")
write(render(36, .tray), "src/main/assets/trayTemplate@2x.png")

let iconutil = Process()
iconutil.executableURL = URL(fileURLWithPath: "/usr/bin/iconutil")
iconutil.arguments = ["-c", "icns", iconset.path, "-o", "build/icon.icns"]
try! iconutil.run()
iconutil.waitUntilExit()
