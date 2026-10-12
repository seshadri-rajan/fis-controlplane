"""Record an annotated GIF walkthrough of the Calendar Platform UI.

Captures a scripted journey with Playwright, adds a caption band to each frame, and assembles the
result with imageio (PIL's GIF encoder merges visually similar frames and kills the animation).

Requires the app running locally:

    python -m uvicorn calendar_service.main:app --port 8000     # CALENDAR_SESSION_COOKIE_SECURE=false
    npm run dev --prefix apps/web

Then:

    python docs/demo/record_demo.py --password "<admin password>"
"""

from __future__ import annotations

import argparse
import shutil
import sys
from dataclasses import dataclass, field
from pathlib import Path

import imageio.v3 as iio
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import Page, sync_playwright

OUT_DIR = Path(__file__).resolve().parent
FRAME_DIR = OUT_DIR / "frames"
GIF_PATH = OUT_DIR / "calendar-platform-demo.gif"

VIEWPORT = {"width": 1360, "height": 940}
GIF_WIDTH = 1000
CAPTION_HEIGHT = 64

INK = (15, 23, 42)
PAPER = (255, 255, 255)
ACCENT = (16, 185, 129)
WARN = (217, 119, 6)


@dataclass
class Frame:
    path: Path
    caption: str
    duration_ms: int
    accent: tuple[int, int, int] = INK
    repeat: int = 1


@dataclass
class Recorder:
    page: Page
    frames: list[Frame] = field(default_factory=list)

    def capture(
        self,
        name: str,
        caption: str,
        duration_ms: int = 1400,
        accent: tuple[int, int, int] = INK,
        settle_ms: int = 900,
        scroll: int | str = 0,
    ) -> None:
        """`scroll` is a y offset, "bottom", or a selector to centre in the viewport."""
        self.page.wait_for_timeout(settle_ms)
        if scroll == "bottom":
            self.page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        elif isinstance(scroll, str):
            self.page.locator(scroll).first.scroll_into_view_if_needed()
            self.page.evaluate("window.scrollBy(0, -120)")
        else:
            self.page.evaluate("y => window.scrollTo(0, y)", scroll)
        self.page.wait_for_timeout(350)
        path = FRAME_DIR / f"{len(self.frames):02d}-{name}.png"
        self.page.screenshot(path=str(path))
        self.frames.append(Frame(path, caption, duration_ms, accent))


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = ["segoeuib.ttf", "arialbd.ttf"] if bold else ["segoeui.ttf", "arial.ttf"]
    for name in candidates:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def compose(frame: Frame) -> np.ndarray:
    shot = Image.open(frame.path).convert("RGB")
    scale = GIF_WIDTH / shot.width
    shot = shot.resize((GIF_WIDTH, int(shot.height * scale)), Image.LANCZOS)

    canvas = Image.new("RGB", (GIF_WIDTH, shot.height + CAPTION_HEIGHT), PAPER)
    canvas.paste(shot, (0, CAPTION_HEIGHT))

    draw = ImageDraw.Draw(canvas)
    draw.rectangle([0, 0, GIF_WIDTH, CAPTION_HEIGHT], fill=frame.accent)
    draw.text((24, CAPTION_HEIGHT // 2), frame.caption, font=font(20, bold=True), fill=PAPER, anchor="lm")
    return np.array(canvas)


def record(url: str, user: str, password: str, headed: bool) -> list[Frame]:
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=not headed)
        page = browser.new_page(viewport=VIEWPORT, device_scale_factor=1)
        rec = Recorder(page)

        # --- Preview: open to anyone, no sign-in needed ---
        page.goto(f"{url}/preview", wait_until="networkidle")
        page.wait_for_selector("text=Run days", timeout=20000)
        rec.capture(
            "preview",
            "Preview a calendar before saving anything — Monday to Friday, 2027",
            duration_ms=2200,
        )

        rec.page.select_option("#collisionPolicy", "shift_again")
        rec.capture(
            "collision",
            "Flip the unresolved collision rule (O-06) … the calendar is identical: 258 runs",
            duration_ms=2600,
            accent=WARN,
        )

        # Sparse calendar: shifting is only visible when there is somewhere to move to.
        for label in ("Tue", "Wed", "Thu", "Fri"):
            page.get_by_role("button", name=label, exact=True).click()
            page.wait_for_timeout(250)
        page.fill(
            "#holidays",
            "2027-01-04, New Year observed\n2027-01-18, MLK Day\n2027-02-15, Presidents Day\n"
            "2027-05-31, Memorial Day\n2027-09-06, Labor Day",
        )
        rec.capture(
            "sparse",
            "Mondays only: amber = run moved off a holiday, rose = the date it left",
            duration_ms=2800,
            accent=ACCENT,
            scroll=330,
        )

        page.get_by_role("button", name="Extended rule").click()
        rec.capture(
            "rule",
            "Extended rules: last working day of each month, 12 runs",
            duration_ms=2200,
            scroll=330,
        )

        # --- Sign in ---
        page.goto(f"{url}/calendars", wait_until="networkidle")
        page.wait_for_selector("#user", timeout=20000)
        rec.capture("login", "Calendars require sign-in — local account, no SSO this phase", 1600)

        page.fill("#user", user)
        page.fill("#password", password)
        page.get_by_role("button", name="Sign in").click()
        page.wait_for_selector("text=Sign out", timeout=20000)
        rec.capture("list", "Signed in as ADMIN — stored calendars", 2000)

        page.get_by_role("button", name="Monday_Batch").click()
        rec.capture(
            "detail",
            "Materialised 2027 dates — 52 runs, 5 moved off holidays",
            duration_ms=2800,
            accent=ACCENT,
        )

        rec.capture(
            "audit",
            "Every change is audited: what, when and by whom",
            duration_ms=2400,
            scroll="bottom",
        )

        page.locator("main select").select_option("2028")
        rec.capture(
            "cliff",
            "No dates for 2028 — the date cliff is called out instead of failing silently",
            duration_ms=3000,
            accent=WARN,
        )

        browser.close()
        return rec.frames


def build_gif(frames: list[Frame]) -> None:
    images = [compose(f) for f in frames]
    height = max(img.shape[0] for img in images)
    padded = [
        np.pad(img, ((0, height - img.shape[0]), (0, 0), (0, 0)), constant_values=255)
        for img in images
    ]
    iio.imwrite(GIF_PATH, padded, duration=[f.duration_ms for f in frames], loop=0)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://localhost:5173")
    parser.add_argument("--user", default="a.patodi")
    parser.add_argument("--password", required=True)
    parser.add_argument("--headed", action="store_true")
    parser.add_argument("--keep-frames", action="store_true")
    args = parser.parse_args()

    if FRAME_DIR.exists():
        shutil.rmtree(FRAME_DIR)
    FRAME_DIR.mkdir(parents=True)

    frames = record(args.url, args.user, args.password, args.headed)
    build_gif(frames)

    if not args.keep_frames:
        shutil.rmtree(FRAME_DIR)

    size_mb = GIF_PATH.stat().st_size / 1024 / 1024
    print(f"{len(frames)} frames -> {GIF_PATH} ({size_mb:.1f} MB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
