"""Draws the scoring curves and formulas for docs/technical-spec.md into docs/img.

Run with matplotlib, numpy and scipy installed: python3 scripts/plot-scoring.py
The anchors below mirror src/scoring/activities/activities.ts.
"""

from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
from scipy.stats import genextreme

OUT = Path(__file__).resolve().parent.parent / "docs" / "img"
OUT.mkdir(parents=True, exist_ok=True)

BLUE, ORANGE, GREY = "#1f6feb", "#d9480f", "#8b949e"
plt.rcParams.update(
    {
        "figure.dpi": 150,
        "axes.spines.top": False,
        "axes.spines.right": False,
        "axes.grid": True,
        "grid.alpha": 0.25,
        "font.size": 9,
        "axes.titlesize": 10,
        "axes.titleweight": "bold",
    }
)

SNOW_HOURS = [(0, 0.98), (1, 0.96), (2, 0.81), (3, 0.58), (4, 0.31), (5, 0.06), (6, 0)]
WIND_MS = [(0, 1), (5, 0.64), (10, 0.26), (14, 0)]
TEMP_C = [(-12, 0), (-8, 0.06), (-5, 0.23), (-2, 0.56), (0, 0.8), (1.5, 0.94), (3, 1), (5, 0.94), (7, 0.74), (10, 0.35), (13, 0.06), (15, 0)]
CLOUD = [(25, 1), (100, 0)]
RAIN = [(0, 1), (3, 0)]
SNOW_DEPTH = [(0, 0), (0.3, 1)]
WAVE_HEIGHT = [(0.3, 0), (0.8, 0.6), (1, 1), (2, 1), (3, 0.5), (4, 0)]
WAVE_PERIOD = [(5, 0), (8, 0.4), (10, 0.7), (13, 1)]
SURF_WIND = [(15, 1), (25, 0.7), (40, 0.3), (55, 0)]

THERMAL = (1, [(-6, 2), (0, 3), (7, 4), (11, 5), (15, 6), (18, 7), (20, 9), (23, 10), (26, 9), (27, 8), (29, 7), (31, 6), (33, 5), (35, 4), (37, 2), (39, 0)])
CLOUD_RATING = (8, [(1, 9), (11, 10), (21, 9), (31, 8), (41, 7), (51, 6), (61, 5), (71, 4), (81, 3), (91, 2), (100, 1)])
PRECIP_RATING = (10, [(0.02, 9), (3, 8), (6, 5), (9, 2), (12, 0), (25, -1)])
WIND_RATING = (8, [(0.02, 10), (10, 9), (20, 8), (30, 6), (40, 3), (50, 0), (70, -10)])


def curve(points, x):
    xs, ys = zip(*points)
    return np.interp(x, xs, ys)


def step(table, x):
    below, steps = table
    result = np.full_like(x, below, dtype=float)
    for start, value in steps:
        result = np.where(x >= start, value, result)
    return result


def add_note(ax, text, corner="upper right"):
    horizontal, vertical = ("right", "top") if corner == "upper right" else ("left", "top")
    ax.text(
        0.97 if horizontal == "right" else 0.03, 0.96, text, transform=ax.transAxes, ha=horizontal, va=vertical,
        fontsize=7.3, linespacing=1.35, bbox={"fc": "white", "ec": GREY, "alpha": 0.92, "pad": 3},
    )


def draw_piecewise(ax, points, xmax, xlabel, title, reference=None, reference_label=None, xmin=None, note=None, corner="upper right"):
    xs, ys = zip(*points)
    lo = xs[0] if xmin is None else xmin
    x = np.linspace(lo, xmax, 400)
    if reference is not None:
        ax.plot(x, reference(x), "--", color=GREY, lw=1.6, label=reference_label)
    ax.plot(x, curve(points, x), color=BLUE, lw=2, label="piecewise linear in code")
    ax.scatter(xs, ys, color=ORANGE, zorder=3, s=22, label="anchor")
    ax.set_xlabel(xlabel)
    ax.set_ylabel("utility")
    ax.set_title(title)
    ax.set_ylim(-0.05, 1.6 if note else 1.08)
    ax.set_yticks([0, 0.2, 0.4, 0.6, 0.8, 1.0])
    ax.set_xlim(lo, xmax)
    if note:
        add_note(ax, note, corner)


def skiing():
    fig, axes = plt.subplots(2, 3, figsize=(12, 6.6))
    ax = axes.flat

    def snow_paper(s):
        return np.where(s > 5, 0, (98.05 + 6.39 * s - 9.03 * s**2 + 0.81 * s**3) / 100)

    def wind_paper(w):
        return np.clip((104.37 - 6.78 * w - 0.19 * w**2 + 0.01 * w**3) / 104.37, 0, 1)

    def temp_paper(t):
        density = genextreme(c=-0.34, loc=1.45, scale=4.6)
        peak = density.pdf(np.linspace(-10, 20, 5000)).max()
        return density.pdf(t) / peak

    draw_piecewise(ax[0], SNOW_HOURS, 7, "hours with snowfall per day", "Snowfall, weight 0.303", snow_paper, "paper's curve",
        note="More snowy hours → LOWER score.\nStrength: up to 30 % of the score;\n6 h or more adds nothing.")
    draw_piecewise(ax[1], WIND_MS, 16, "mean wind speed (m/s)", "Wind, weight 0.279", wind_paper, "paper's curve",
        note="Stronger wind → LOWER score.\nStrength: up to 28 % of the score;\n14 m/s (50 km/h) adds nothing.")
    draw_piecewise(ax[2], TEMP_C, 20, "max temperature (°C)", "Temperature, weight 0.222", temp_paper, "paper's curve", xmin=-15,
        note="Best near 3 °C; colder or warmer\n→ LOWER score.\nStrength: up to 22 % of the score.", corner="upper left")
    draw_piecewise(ax[3], CLOUD, 100, "mean cloud cover (%)", "Cloud, weight 0.194", lambda c: np.clip((100 - c) / 75, 0, 1), "(100 − cloud) / 75", xmin=0,
        note="More cloud (above 25 %) → LOWER score.\nStrength: up to 19 % of the score\n(weakest factor).")
    draw_piecewise(ax[4], RAIN, 5, "total rain (mm)", "Rain multiplier (our addition)", xmin=0,
        note="More rain → LOWER score.\nMultiplies the WHOLE score:\n1.5 mm halves it, 3 mm makes it 0.\nThe strongest single factor.")
    draw_piecewise(ax[5], SNOW_DEPTH, 0.5, "max snow depth (m)", "Snow depth multiplier (our addition)", xmin=0,
        note="Deeper snow → HIGHER score, up to 0.3 m.\nMultiplies the WHOLE score:\n0.15 m halves it.", corner="upper left")
    ax[0].legend(loc="lower left", fontsize=7.5)
    fig.suptitle("Skiing: utility curves  ·  score = (0.303·snow + 0.279·wind + 0.222·temp + 0.194·cloud) × rain × depth", fontsize=11, fontweight="bold")
    fig.tight_layout()
    fig.savefig(OUT / "skiing-curves.png")
    plt.close(fig)


def surfing():
    fig, axes = plt.subplots(1, 3, figsize=(12, 3.6))
    draw_piecewise(axes[0], WAVE_HEIGHT, 5, "max wave height (m)", "Wave height, exponent 0.35", xmin=0,
        note="Best at 1–2 m; smaller or bigger\n→ LOWER score. Utility 0 → score 0.\nHalving the utility cuts the score\nby 21 %.", corner="upper left")
    draw_piecewise(axes[1], WAVE_PERIOD, 16, "max wave period (s)", "Wave period, exponent 0.35", xmin=0,
        note="Longer period → HIGHER score,\nbest from 13 s. Under 5 s → score 0.\nHalving the utility cuts the score\nby 21 %.", corner="upper left")
    draw_piecewise(axes[2], SURF_WIND, 70, "max wind speed (km/h)", "Wind, exponent 0.30", xmin=0,
        note="Stronger wind → LOWER score.\n55 km/h or more → score 0.\nHalving the utility cuts the score\nby 19 % (weakest exponent).")
    fig.suptitle("Surfing: utility curves  ·  score = uHeight^0.35 · uPeriod^0.35 · uWind^0.30", fontsize=11, fontweight="bold")
    fig.tight_layout()
    fig.savefig(OUT / "surfing-curves.png")
    plt.close(fig)


def surfing_combination():
    heights = np.linspace(0, 4.5, 300)
    periods = np.linspace(4, 15, 300)
    h, p = np.meshgrid(heights, periods)
    fig, axes = plt.subplots(1, 3, figsize=(12, 3.8), sharey=True)
    for ax, wind in zip(axes, [10, 30, 45]):
        u_wind = curve(SURF_WIND, np.array([wind]))[0]
        score = curve(WAVE_HEIGHT, h) ** 0.35 * curve(WAVE_PERIOD, p) ** 0.35 * u_wind**0.30
        mesh = ax.contourf(h, p, score, levels=np.linspace(0, 1, 11), cmap="viridis")
        ax.contour(h, p, score, levels=[0.1, 0.4, 0.7], colors="white", linewidths=0.8)
        ax.set_title(f"wind {wind} km/h (uWind = {u_wind:.2f})")
        ax.set_xlabel("max wave height (m)")
    axes[0].set_ylabel("max wave period (s)")
    fig.colorbar(mesh, ax=axes, label="surfing score (brighter = higher)", shrink=0.9)
    fig.suptitle("Surfing: weighted product, one useless factor zeroes the score", fontsize=11, fontweight="bold")
    fig.savefig(OUT / "surfing-combination.png", bbox_inches="tight")
    plt.close(fig)


def outdoor_ratings():
    fig, axes = plt.subplots(2, 2, figsize=(11, 6.4))
    specs = [
        (axes[0, 0], THERMAL, np.linspace(-15, 45, 3000), "humidex (°C)", "Thermal comfort TC, weight 4", (-0.5, 10.8),
         "Best at humidex 23–26 °C; colder or hotter\n→ LOWER score.\nStrength: moves the score by 0 to +0.40.\nThe strongest factor.", "upper left"),
        (axes[0, 1], CLOUD_RATING, np.linspace(0, 100, 3000), "mean cloud cover (%)", "Cloud cover A, weight 2", (-0.5, 10.8),
         "More cloud → LOWER score.\nStrength: +0.02 to +0.20.", "upper right"),
        (axes[1, 0], PRECIP_RATING, np.linspace(0, 30, 3000), "total precipitation (mm)", "Precipitation P, weight 3", (-1.5, 10.8),
         "More rain → LOWER score.\nStrength: from +0.30 (dry) down to\n−0.03 (25 mm or more).", "upper right"),
        (axes[1, 1], WIND_RATING, np.linspace(0, 80, 3000), "mean wind speed (km/h)", "Wind W, weight 1", (-11, 10.8),
         "Stronger wind → LOWER score.\nStrength: only +0.10 to −0.10,\nthe weakest factor (hence the cap).", "upper right"),
    ]
    for ax, table, x, xlabel, title, ylim, note, corner in specs:
        ax.plot(x, step(table, x), color=BLUE, lw=2, drawstyle="steps-post")
        ax.axhline(0, color="black", lw=0.8)
        ax.set_xlabel(xlabel)
        ax.set_ylabel("rating")
        ax.set_title(title)
        ax.set_ylim(*ylim)
        add_note(ax, note, corner)
    fig.suptitle("Outdoor sightseeing: HCI:Urban rating tables  ·  HCI = 4·TC + 2·A + 3·P + W, score = HCI / 100", fontsize=11, fontweight="bold")
    fig.tight_layout()
    fig.savefig(OUT / "outdoor-ratings.png")
    plt.close(fig)


def humidex(t, rh):
    return t + (5 / 9) * (6.112 * 10 ** (7.5 * t / (237.7 + t)) * rh / 100 - 10)


def humidex_map():
    t = np.linspace(0, 45, 400)
    rh = np.linspace(10, 100, 400)
    tt, rr = np.meshgrid(t, rh)
    rating = step(THERMAL, humidex(tt, rr))
    fig, ax = plt.subplots(figsize=(8, 5.4))
    mesh = ax.pcolormesh(tt, rr, rating, cmap="RdYlGn", vmin=0, vmax=10, shading="auto")
    points = [
        ("Singapore: 32.8 °C, 86 %\nhumidex 50.9, rating 0", 32.8, 86, 1, 90),
        ("42 °C, 25 %\nhumidex 47.8, rating 0", 42, 25, 12, 14),
    ]
    for label, x, y, tx, ty in points:
        ax.scatter([x], [y], color="white", edgecolor="black", zorder=3)
        ax.annotate(label, (x, y), (tx, ty), fontsize=7.5, arrowprops={"arrowstyle": "-"}, bbox={"fc": "white", "alpha": 0.85, "pad": 1.5})
    ax.set_xlabel("max temperature T (°C)")
    ax.set_ylabel("mean relative humidity RH (%)")
    ax.set_title("Thermal comfort rating from humidex = T + 5/9·(6.112·10^(7.5T/(237.7+T))·RH/100 − 10)", fontsize=9)
    fig.colorbar(mesh, label="thermal comfort rating 0–10 (higher = higher score; best at humidex 23–26)")
    fig.tight_layout()
    fig.savefig(OUT / "humidex-rating.png")
    plt.close(fig)


def categories_and_indoor():
    fig, (left, right) = plt.subplots(1, 2, figsize=(12, 3.8), gridspec_kw={"width_ratios": [1.3, 1]})
    bounds = [0, 0.1, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
    names = ["UNSUITABLE", "POOR", "MARGINAL", "ACCEPTABLE", "GOOD", "VERY_GOOD", "EXCELLENT", "IDEAL"]
    colors = plt.get_cmap("RdYlGn")(np.linspace(0.05, 0.95, 8))
    for i, name in enumerate(names):
        left.barh(0, bounds[i + 1] - bounds[i], left=bounds[i], color=colors[i], edgecolor="white")
        mid = (bounds[i] + bounds[i + 1]) / 2
        left.text(mid, 0, f"{i + 1}\n{name.replace('_', chr(10))}", ha="center", va="center", fontsize=6 if i < 2 else 6.5, rotation=90 if i < 2 else 0)
    left.set_xlim(0, 1)
    left.set_yticks([])
    left.set_xticks(bounds)
    left.set_xlabel("score (rounded to two decimals first)")
    left.set_title("Categories, the same for every activity")
    left.grid(False)
    left.spines["left"].set_visible(False)

    outdoor = np.linspace(0, 1, 100)
    right.plot(outdoor, 0.5 + 0.5 * (1 - outdoor), color=BLUE, lw=2, label="indoor = 0.5 + 0.5·(1 − outdoor)\nbetter outdoor → LOWER indoor, −0.05 per +0.1")
    right.plot(outdoor, outdoor, "--", color=GREY, label="outdoor")
    right.set_xlabel("outdoor score (after caps)")
    right.set_ylabel("indoor score")
    right.set_ylim(0, 1.05)
    right.set_title("Indoor sightseeing mirrors outdoor")
    right.legend(fontsize=8)
    fig.tight_layout()
    fig.savefig(OUT / "categories-and-indoor.png")
    plt.close(fig)


def outdoor_caps():
    precip = np.linspace(0, 30, 600)
    fig, ax = plt.subplots(figsize=(7, 3.8))
    ax.plot(precip, np.where(precip >= 25, 0.2, np.where(precip >= 6, 0.5, 1.0)), color=BLUE, lw=2, drawstyle="steps-post", label="maximum allowed score (caps only LOWER the score, never raise it)")
    ax.axvline(6, color=GREY, ls=":")
    ax.axvline(25, color=GREY, ls=":")
    ax.text(6.3, 0.05, "precip ≥ 6 mm: cap 0.5", fontsize=8)
    ax.text(8, 0.7, "precip ≥ 25 mm or max wind\n≥ 60 km/h: cap 0.2 (wind alone\nlowers the cap at any precip)", fontsize=7.5)
    ax.set_xlabel("total precipitation (mm)")
    ax.set_ylabel("cap on outdoor score")
    ax.set_ylim(0, 1.05)
    ax.set_title("Outdoor sightseeing: caps applied after the index")
    ax.legend(loc="upper right", fontsize=8)
    fig.tight_layout()
    fig.savefig(OUT / "outdoor-caps.png")
    plt.close(fig)


if __name__ == "__main__":
    skiing()
    surfing()
    surfing_combination()
    outdoor_ratings()
    humidex_map()
    outdoor_caps()
    categories_and_indoor()
