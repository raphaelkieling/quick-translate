// Draws the app icon and writes every copy of it:
//   build/icon.icns                        the app (macOS icon grid)
//   build/icon.png                         README.md logo
//   docs/icon.png                          website logo and favicon (full-bleed square)
//   src/main/assets/trayTemplate[@2x].png  menu bar (monochrome template image)
// Run from the project root: swift build/make-icon.swift
//
// Same palette as the app (src/renderer/style.css): 文 in an outlined square, behind an accent square with A.

import AppKit

let bg = NSColor(srgbRed: 0x0f / 255, green: 0x0f / 255, blue: 0x11 / 255, alpha: 1)
let fg = NSColor(srgbRed: 0xed / 255, green: 0xed / 255, blue: 0xea / 255, alpha: 1)
let line = NSColor(srgbRed: 0x2a / 255, green: 0x2a / 255, blue: 0x2e / 255, alpha: 1)
let accent = NSColor(srgbRed: 0x0a / 255, green: 0x84 / 255, blue: 0xff / 255, alpha: 1)

// The mark on a 17×17 grid: 文 in an outlined square, behind a solid square with A punched out.
let mark = "M1.54545 0C0.700815 0 0 0.700815 0 1.54545V10.0455C0 10.8901 0.700815 11.5909 1.54545 11.5909H5.40909V15.4545C5.40909 16.3084 6.10068 17 6.95455 17H15.4545C16.3084 17 17 16.3084 17 15.4545V6.95455C17 6.10068 16.3084 5.40909 15.4545 5.40909H11.5909V1.54545C11.5909 0.700815 10.8901 0 10.0455 0H1.54545ZM1.54545 1.54545H10.0455V6.18182L6.18182 10.0455H1.54545V1.54545ZM5.40909 2.70455V3.86364H3.09091V4.63636H6.95455C6.95455 5.83331 6.61732 6.55191 5.99618 7.02397C5.82635 7.15304 5.62398 7.26123 5.40154 7.35449C5.15205 7.2311 4.91771 7.09143 4.72088 6.92587C4.16677 6.45979 3.86364 5.86635 3.86364 5.40909H3.09091C3.09091 6.17969 3.5342 6.93826 4.22283 7.51749C4.26843 7.55584 4.32435 7.58639 4.37225 7.62314C3.98477 7.68505 3.56774 7.72727 3.09091 7.72727V8.5C3.95275 8.5 4.71991 8.41088 5.37589 8.19513C5.85407 8.3841 6.38426 8.5 6.95455 8.5V7.72727C6.76545 7.72727 6.58468 7.70391 6.40669 7.67596C6.42513 7.66256 6.44592 7.65201 6.46404 7.63823C7.29178 7.00915 7.72727 5.98942 7.72727 4.63636H8.5V3.86364H6.18182V2.70455H5.40909ZM10.3564 8.48189H12.0497L13.8804 13.9272H12.3712L12.0316 12.7304H10.2537L9.90359 13.9272H8.53018L10.3564 8.48189ZM11.114 9.7089L10.5178 11.7343H11.7705L11.1864 9.7089H11.114Z"
// Where the A starts in `mark`, to paint it on its own.
let letterA = String(mark[mark.range(of: "M10.3564")!.lowerBound...])

// Parses the absolute M/L/H/V/C/Z commands used above into a path, flipped to AppKit's bottom-up y.
func path(_ d: String, in box: NSRect) -> NSBezierPath {
  let s = box.width / 17
  func p(_ x: Double, _ y: Double) -> NSPoint { NSPoint(x: box.minX + x * s, y: box.maxY - y * s) }
  var tokens: [String] = []
  var number = ""
  for c in d {
    if c.isLetter {
      if !number.isEmpty { tokens.append(number); number = "" }
      tokens.append(String(c))
    } else if c == " " || c == "," {
      if !number.isEmpty { tokens.append(number); number = "" }
    } else {
      number.append(c)
    }
  }
  if !number.isEmpty { tokens.append(number) }

  let bezier = NSBezierPath()
  var i = 0
  var command = ""
  var current = (x: 0.0, y: 0.0)
  func next() -> Double { defer { i += 1 }; return Double(tokens[i])! }
  while i < tokens.count {
    if Double(tokens[i]) == nil { command = tokens[i]; i += 1 }
    switch command {
    case "M": current = (next(), next()); bezier.move(to: p(current.x, current.y)); command = "L"
    case "L": current = (next(), next()); bezier.line(to: p(current.x, current.y))
    case "H": current.x = next(); bezier.line(to: p(current.x, current.y))
    case "V": current.y = next(); bezier.line(to: p(current.x, current.y))
    case "C":
      let c1 = p(next(), next()), c2 = p(next(), next())
      current = (next(), next())
      bezier.curve(to: p(current.x, current.y), controlPoint1: c1, controlPoint2: c2)
    case "Z": bezier.close()
    default: fatalError("Unsupported path command \(command)")
    }
  }
  return bezier
}

enum Style { case app, web, tray }

func render(_ size: Int, _ style: Style) -> Data {
  let rep = NSBitmapImageRep(
    bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size, bitsPerSample: 8,
    samplesPerPixel: 4, hasAlpha: true, isPlanar: false, colorSpaceName: .deviceRGB,
    bytesPerRow: 0, bitsPerPixel: 0)!
  NSGraphicsContext.saveGraphicsState()
  NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)

  let px = CGFloat(size)
  let markSide: CGFloat
  switch style {
  case .app:
    // macOS icon grid: an 824pt rounded square centered on a 1024pt canvas.
    let s = px / 1024
    let body = NSRect(x: 100 * s, y: 100 * s, width: 824 * s, height: 824 * s)
    bg.setFill()
    NSBezierPath(roundedRect: body, xRadius: 185 * s, yRadius: 185 * s).fill()
    line.setStroke()
    let border = NSBezierPath(roundedRect: body.insetBy(dx: 3 * s, dy: 3 * s), xRadius: 182 * s, yRadius: 182 * s)
    border.lineWidth = max(6 * s, 1)
    border.stroke()
    markSide = 540 * s
  case .web:
    bg.setFill()
    NSRect(x: 0, y: 0, width: px, height: px).fill()
    line.setStroke()
    let border = NSBezierPath(rect: NSRect(x: 0, y: 0, width: px, height: px).insetBy(dx: px / 128, dy: px / 128))
    border.lineWidth = max(px / 64, 1)
    border.stroke()
    markSide = px * 0.68
  case .tray:
    markSide = px * 17 / 18
  }
  let box = NSRect(x: (px - markSide) / 2, y: (px - markSide) / 2, width: markSide, height: markSide)
  let shape = path(mark, in: box)

  if style == .tray {
    NSColor.black.setFill()
    shape.fill()
  } else {
    fg.setFill()
    shape.fill()
    // Front square in the accent: inside its bounds, past the diagonal (x + y = 16.227) where the outline meets it.
    let s = markSide / 17
    func grid(_ x: CGFloat, _ y: CGFloat) -> NSPoint { NSPoint(x: box.minX + x * s, y: box.maxY - y * s) }
    let diagonal = NSBezierPath()
    diagonal.move(to: grid(16.227, 0))
    diagonal.line(to: grid(17, 0))
    diagonal.line(to: grid(17, 17))
    diagonal.line(to: grid(0, 17))
    diagonal.line(to: grid(0, 16.227))
    diagonal.close()
    NSGraphicsContext.saveGraphicsState()
    NSBezierPath(rect: NSRect(x: box.minX + 5.40909 * s, y: box.minY, width: 11.6 * s, height: 11.6 * s)).addClip()
    diagonal.addClip()
    accent.setFill()
    shape.fill()
    NSGraphicsContext.restoreGraphicsState()
    NSColor.white.setFill()
    path(letterA, in: box).fill()
  }

  NSGraphicsContext.restoreGraphicsState()
  return rep.representation(using: .png, properties: [:])!
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
