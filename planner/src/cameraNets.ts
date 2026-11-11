// Hand-marked net polygon for each synthetic camera, in pixel coordinates of the 960x720 sample photos.
// Copied from `CAMERAS` in `ml/synth_images.py` (cameraNets.test.ts fails if the two drift).
// Coordinates only: no image data here. SAMPLE DATA, not council asset geometry.
import type { Point } from "./readImage";

export const CAMERA_NETS: Record<string, Point[]> = {
  "cam-01": [
    [458, 478],
    [520, 472],
    [545, 510],
    [520, 548],
    [470, 548],
  ],
  "cam-02": [
    [462, 425],
    [525, 415],
    [535, 455],
    [510, 500],
    [462, 490],
  ],
  "cam-03": [
    [472, 380],
    [588, 400],
    [622, 495],
    [590, 540],
    [487, 530],
    [478, 440],
  ],
  "cam-04": [
    [415, 385],
    [520, 383],
    [548, 490],
    [735, 470],
    [750, 430],
    [700, 380],
    [530, 395],
  ],
  "cam-05": [
    [388, 225],
    [430, 200],
    [475, 205],
    [478, 245],
    [430, 278],
    [395, 262],
  ],
  "cam-06": [
    [320, 600],
    [385, 585],
    [425, 620],
    [420, 690],
    [305, 690],
  ],
  "cam-07": [
    [385, 395],
    [700, 445],
    [700, 570],
    [400, 500],
  ],
};
