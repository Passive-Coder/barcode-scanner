/**
 * The app's colours, type, and spacing: the website's mobile (wine) theme.
 */
export const colors = Object.freeze({
  bg: "#5c0a19",
  surface: "#6d1426",
  surfaceHover: "#7c1f32",
  surfaceSunk: "#4a0714",
  ink: "#f8ebd9",
  inkStrong: "#fff5e8",
  inkMuted: "#e0bfb2",
  accent: "#f8ebd9",
  onAccent: "#5a0d1b",
  line: "#8d4352",
  lineStrong: "#a5606c",
  danger: "#ffb4a8",
  onDanger: "#4a0612",
  success: "#9bd8ae",
  warning: "#f2c46d",
  link: "#f6d3c0",
  field: "#4a0714",
  fieldBorder: "#a5606c",
  placeholder: "#c99a92",
  dialog: "#64101f",
  backdrop: "rgba(29, 2, 10, 0.8)",
  // Rows keep a light paper look for legibility, as on the website.
  paper: "#fffdf9",
  paperInk: "#3b1a20",
  paperMuted: "#7d655e",
  paperLine: "#ece2d8",
  paperLink: "#892331",
  paperDanger: "#a3222c",
  page: "#6e0b1d",
  pageInk: "#fff5e8",
  pageMuted: "#ffd9cf",
});

/** Font families loaded in the root layout (Schibsted Grotesk and IBM Plex Mono). */
export const fonts = Object.freeze({
  regular: "SchibstedGrotesk_400Regular",
  medium: "SchibstedGrotesk_500Medium",
  semibold: "SchibstedGrotesk_600SemiBold",
  bold: "SchibstedGrotesk_700Bold",
  mono: "IBMPlexMono_400Regular",
});

export const radius = Object.freeze({ small: 6, medium: 10, large: 14, pill: 999 });

/** Smallest comfortable tap target. */
export const TOUCH = 44;

/** Screens keep their content (and their top bar) to this width, centred on tablets. */
export const CONTENT_WIDTH = 640;
/** Space between the screen's edges and its content on phones. */
export const GUTTER = 16;

/** How far content sits from each side of a screen this wide. @param {number} width */
export const contentInset = (width) => Math.max(GUTTER, (width - CONTENT_WIDTH) / 2);

/** Fills its parent; for layers and backdrops. */
export const FILL = Object.freeze(/** @type {const} */ ({ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }));
