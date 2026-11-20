import type { ProcessPreset } from "@/lib/types";

export const ALLA_PRIMA_PRESET: ProcessPreset = {
  id: "alla-prima",
  name: "5-Step Oil Guide",
  description:
    "A simple, beginner-friendly path from a warm toned canvas to finished highlights.",
  stages: [
    {
      id: "toned-ground",
      name: "Tone Canvas",
      sliderRange: [0, 20],
      render: "toned-ground",
      params: {},
      guidance: {
        goal: "Cover the stark white canvas with a thin, warm wash of brown paint. Painting on a mid-tone surface makes it much easier to judge how bright your lights and how dark your shadows really are.",
        paints:
          "Burnt Sienna, Raw Umber, or Burnt Umber — one warm earth color is all you need.",
        medium:
          "Thin heavily with odorless mineral spirits (paint thinner) until it flows like tea.",
        brushes: "Large flat brush plus a paper towel or cotton rag.",
        lookFor: [
          "Aim for a soft, even middle tone where you can still see the weave of the canvas.",
          "Gently wipe away extra thinner with a rag so the surface looks matte, not shiny or wet.",
        ],
        commonMistakes: [
          "Leaving the wash too thick or oily — keep this first layer very thin so later paint sticks cleanly.",
          "Making the wash too dark to see your sketch, or so pale it still looks white.",
        ],
        fatOverLean: "Very thin & dry (paint + thinner only — dries to the touch in minutes).",
      },
    },
    {
      id: "monochrome-block-in",
      name: "Sketch & Shadows",
      sliderRange: [20, 40],
      render: "monochrome-block-in",
      params: {},
      guidance: {
        goal: "Lightly sketch the biggest shapes and map out your darks and lights using just one brown paint. Think of this as your roadmap before bringing out any colors.",
        paints: "Burnt Umber or Burnt Sienna only (skip white paint for now).",
        medium:
          "A little odorless mineral spirits (paint thinner) for sketching and lifting out bright spots.",
        brushes:
          "Small round brush for loose outlines, medium bristle brush for dark shapes, and a clean rag to wipe away light areas.",
        lookFor: [
          "Try the Squint Blur tool below — your painting should already be recognizable using just light, medium, and dark tones.",
          "Keep shadow areas grouped together as simple, bold shapes rather than tiny details.",
        ],
        commonMistakes: [
          "Reaching for white paint too early — instead, dip a corner of your rag in a touch of thinner and wipe back to the bright canvas.",
          "Drawing tiny details (like leaves or eyelashes) before the big shapes are in the right place.",
        ],
        fatOverLean: "Thin & lean (paint + a splash of paint thinner, no extra oil yet).",
      },
    },
    {
      id: "color-block-in",
      name: "Big Color Shapes",
      sliderRange: [40, 60],
      render: "color-block-in",
      params: {},
      guidance: {
        goal: "Fill the whole canvas with big, simple patches of color. Paint your darkest shadows first (thin), then midtones, then lights (thicker). Getting the lightness right matters more than the exact color.",
        paints:
          "Mix your main shadow and light piles first — check the Main Colors tab or click anywhere on the image for a recipe.",
        medium:
          "Paint straight from the tube, or add just a drop of odorless mineral spirits (paint thinner) to keep shadows thin.",
        brushes:
          "Large flat or filbert brushes — bigger brushes keep your strokes bold and confident.",
        lookFor: [
          "Compare how light or dark each patch is using the Black & White toggle below.",
          "Notice the contrast between warm sunlit areas and cooler shadows.",
        ],
        commonMistakes: [
          "Adding too much Titanium White into dark shadows — it makes shadows look chalky.",
          "Switching to a tiny brush too soon and getting stuck on one small corner.",
        ],
        fatOverLean: "Medium thickness (thin shadows, fuller paint straight from the tube in lights).",
      },
    },
    {
      id: "develop-forms",
      name: "Build Form",
      sliderRange: [60, 80],
      render: "develop-forms",
      params: {},
      guidance: {
        goal: "Turn your flat color patches into solid, three-dimensional objects by adding the in-between tones where light rolls gently into shadow, and softening edges away from your main subject.",
        paints:
          "Mixes between your light and shadow piles — click any area on the painting to check its exact recipe.",
        medium:
          "Straight tube paint, or a tiny drop of linseed oil if you want smoother strokes.",
        brushes:
          "Medium filbert or flat brushes, plus a clean dry soft brush to gently soften edges.",
        lookFor: [
          "Soft transition tones where sunlit planes turn away from the light.",
          "Keep the sharpest edges on your main subject and let background edges stay soft.",
        ],
        commonMistakes: [
          "Over-blending everything until the colors turn muddy — place each brushstroke and leave it fresh.",
          "Making bounce light inside shadows too bright so it competes with the sunlit side.",
        ],
        fatOverLean: "Richer paint (straight from the tube or with a single drop of oil).",
      },
    },
    {
      id: "accents-highlights",
      name: "Final Highlights",
      sliderRange: [80, 100],
      render: "accents-highlights",
      params: {},
      guidance: {
        goal: "Add the brightest light catchers and the deepest dark accents with confident, thicker strokes — then step back and stop while the painting still feels alive.",
        paints:
          "Bright Titanium White mixes (tinted slightly warm or cool) and your richest dark accents.",
        medium:
          "Thick paint straight from the tube (no thinner needed) so highlights sit right on top.",
        brushes:
          "Small flat brush, fine round, or a palette knife for crisp bright touches.",
        lookFor: [
          "Save your absolute brightest highlights for just the top 2–5% of the painting.",
          "Drop dark accents lightly on top without scrubbing into the wet light paint underneath.",
        ],
        commonMistakes: [
          "Putting bright white dots everywhere — too many highlights distract from your focal point.",
          "Overworking the painting after the main subject already looks great.",
        ],
        fatOverLean: "Thickest paint (pure tube paint layered gently over wet paint).",
      },
    },
  ],
};
