import type { CSSProperties, ReactNode } from "react";

/* ------------------------------------------------------------------ */
/* Palette                                                             */
/* ------------------------------------------------------------------ */

const C = {
  gold: "#C99532",
  goldLight: "#D8A94E",
  goldDeep: "#AE8545",
  brown: "#5E4231",
  brownDark: "#4A3021",
  brownMid: "#6E5140",
  cream: "#F1E9DB",
  paper: "#F3EFE7",
  floor: "#EFE8DC",
  shadow: "rgba(74, 48, 33, 0.1)",
};

const delay = (s: number): CSSProperties => ({ animationDelay: `${s}s` });

/* ------------------------------------------------------------------ */
/* Dashboard ring geometry                                             */
/* ------------------------------------------------------------------ */

const RING = { cx: 320, cy: 300, rx: 230, ry: 80 };
const BACK_H = 150;
const FRONT_H = 105;

const rad = (deg: number) => (deg * Math.PI) / 180;
const ringPoint = (deg: number) => ({
  x: RING.cx + RING.rx * Math.cos(rad(deg)),
  y: RING.cy + RING.ry * Math.sin(rad(deg)),
});

type PanelKind = "bars" | "line" | "donut" | "rows" | "kpi";

type Panel = {
  key: string;
  x: number;
  y: number;
  w: number;
  k: number;
  h: number;
  kind: PanelKind;
  index: number;
};

function buildPanels(
  prefix: string,
  from: number,
  to: number,
  count: number,
  h: number,
  kinds: PanelKind[]
): Panel[] {
  const gap = 1.4;
  const step = (to - from) / count;
  return Array.from({ length: count }, (_, i) => {
    const a = ringPoint(from + i * step + gap / 2);
    const b = ringPoint(from + (i + 1) * step - gap / 2);
    const [l, r] = a.x < b.x ? [a, b] : [b, a];
    const w = r.x - l.x;
    return {
      key: `${prefix}${i}`,
      x: l.x,
      y: l.y - h,
      w,
      k: (r.y - l.y) / w,
      h,
      kind: kinds[i % kinds.length],
      index: i,
    };
  });
}

function rimPath(from: number, to: number, lift: number) {
  const pts: string[] = [];
  for (let d = from; d <= to + 0.001; d += 3) {
    const p = ringPoint(d);
    pts.push(`${p.x.toFixed(1)},${(p.y - lift).toFixed(1)}`);
  }
  return `M${pts.join(" L")}`;
}

const BACK_PANELS = buildPanels("b", 195, 345, 8, BACK_H, [
  "rows",
  "line",
  "bars",
  "kpi",
  "donut",
  "bars",
  "line",
  "rows",
]);
const FRONT_RIGHT = buildPanels("fr", 22, 68, 3, FRONT_H, ["bars", "donut", "line"]);
const FRONT_LEFT = buildPanels("fl", 112, 158, 3, FRONT_H, ["kpi", "bars", "rows"]);

function PanelContent({ kind, w, h, index }: { kind: PanelKind; w: number; h: number; index: number }) {
  const p = Math.max(5, w * 0.13);
  const d = index * 0.35;

  if (w < 26) {
    return (
      <g opacity={0.5}>
        {[0.25, 0.45, 0.65].map((t) => (
          <rect key={t} x={w * 0.3} y={h * t} width={w * 0.4} height={3} rx={1.5} fill={C.goldLight} />
        ))}
      </g>
    );
  }

  const header = <rect x={p} y={p} width={w * 0.42} height={4} rx={2} fill={C.gold} opacity={0.9} />;

  switch (kind) {
    case "bars": {
      const slot = (w - 2 * p) / 4;
      const bw = slot * 0.58;
      const heights = [0.28, 0.44, 0.34, 0.54];
      return (
        <g>
          {header}
          <rect x={p} y={p + 9} width={w * 0.25} height={2.5} rx={1.2} fill={C.cream} opacity={0.4} />
          {heights.map((bh, j) => (
            <rect
              key={j}
              className="nib-self-bottom a-bar"
              style={delay(d + j * 0.4)}
              x={p + j * slot + (slot - bw) / 2}
              y={h - p - h * bh}
              width={bw}
              height={h * bh}
              rx={1.5}
              fill={j % 2 ? C.goldLight : C.gold}
            />
          ))}
          <line x1={p} x2={w - p} y1={h - p} y2={h - p} stroke={C.cream} strokeOpacity={0.35} />
        </g>
      );
    }
    case "line": {
      const ys = [0, 0.12, 0.06, 0.2, 0.14, 0.3];
      const pts = ys
        .map((v, j) => `${(p + (j * (w - 2 * p)) / (ys.length - 1)).toFixed(1)},${(h * 0.72 - v * h).toFixed(1)}`)
        .join(" ");
      return (
        <g>
          {header}
          {[0.35, 0.5, 0.65].map((t) => (
            <line key={t} x1={p} x2={w - p} y1={h * t} y2={h * t} stroke={C.cream} strokeOpacity={0.12} />
          ))}
          <polyline
            className="a-draw"
            style={delay(d)}
            points={pts}
            pathLength={100}
            strokeDasharray="100 100"
            fill="none"
            stroke={C.goldLight}
            strokeWidth={2.2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect x={p} y={h - p - 10} width={w * 0.3} height={3} rx={1.5} fill={C.cream} opacity={0.35} />
          <rect x={p} y={h - p - 4} width={w * 0.5} height={3} rx={1.5} fill={C.cream} opacity={0.2} />
        </g>
      );
    }
    case "donut": {
      const r = Math.min(w, h) * 0.26;
      const cx = w / 2;
      const cy = h * 0.42;
      return (
        <g>
          {header}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={C.cream} strokeOpacity={0.18} strokeWidth={r * 0.45} />
          <g className="nib-self a-spin" style={delay(-d * 3)}>
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={C.gold}
              strokeWidth={r * 0.45}
              pathLength={100}
              strokeDasharray="64 100"
            />
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={C.goldLight}
              strokeWidth={r * 0.45}
              pathLength={100}
              strokeDasharray="0 66 18 100"
            />
          </g>
          <rect x={p} y={h * 0.74} width={w * 0.55} height={3} rx={1.5} fill={C.cream} opacity={0.35} />
          <rect x={p} y={h * 0.74 + 7} width={w * 0.35} height={3} rx={1.5} fill={C.cream} opacity={0.22} />
        </g>
      );
    }
    case "rows":
      return (
        <g>
          {header}
          {[0.78, 0.55, 0.68, 0.45, 0.62].map((len, j) => (
            <g key={j} className={j === 2 ? "a-blink" : undefined} style={delay(d)}>
              <circle cx={p + 2} cy={p + 18 + j * 11} r={2} fill={C.gold} />
              <rect
                x={p + 7}
                y={p + 16.5 + j * 11}
                width={(w - 2 * p - 7) * len}
                height={3}
                rx={1.5}
                fill={C.cream}
                opacity={0.45}
              />
            </g>
          ))}
        </g>
      );
    case "kpi": {
      const base = h - p;
      const area = `M${p},${base} L${p},${base - 12} L${w * 0.35},${base - 20} L${w * 0.55},${base - 15} L${w - p},${base - 30} L${w - p},${base} Z`;
      return (
        <g>
          {header}
          <rect className="a-blink" style={delay(d)} x={p} y={p + 12} width={w * 0.5} height={h * 0.1} rx={2} fill={C.goldLight} />
          <rect x={p} y={p + 16 + h * 0.1} width={w * 0.3} height={3} rx={1.5} fill={C.cream} opacity={0.35} />
          <path d={area} fill={C.gold} opacity={0.35} />
          <path
            d={`M${p},${base - 12} L${w * 0.35},${base - 20} L${w * 0.55},${base - 15} L${w - p},${base - 30}`}
            fill="none"
            stroke={C.goldLight}
            strokeWidth={2}
            strokeLinejoin="round"
          />
        </g>
      );
    }
  }
}

function RingPanels({ panels, glow }: { panels: Panel[]; glow?: boolean }) {
  return (
    <>
      {panels.map((pn) => (
        <g key={pn.key} transform={`matrix(1 ${pn.k.toFixed(4)} 0 1 ${pn.x.toFixed(2)} ${pn.y.toFixed(2)})`}>
          <rect width={pn.w} height={pn.h} rx={3} fill="url(#nibil-panel)" fillOpacity={0.92} stroke={C.goldLight} strokeOpacity={0.55} strokeWidth={1.2} />
          <rect width={pn.w} height={pn.h} rx={3} fill="url(#nibil-sheen)" />
          <PanelContent kind={pn.kind} w={pn.w} h={pn.h} index={pn.index} />
          {glow && (
            <rect className="a-glow" style={delay(pn.index * 1.3)} width={pn.w} height={pn.h} rx={3} fill={C.gold} opacity={0} fillOpacity={0.1} />
          )}
        </g>
      ))}
    </>
  );
}

function Rim({ from, to, h }: { from: number; to: number; h: number }) {
  return (
    <g fill="none" strokeLinecap="round">
      <path d={rimPath(from, to, h)} stroke={C.gold} strokeWidth={4} />
      <path d={rimPath(from, to, h - 3)} stroke={C.goldDeep} strokeOpacity={0.6} strokeWidth={1.5} />
      <path d={rimPath(from, to, 0)} stroke={C.goldDeep} strokeWidth={3} />
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* People                                                              */
/* ------------------------------------------------------------------ */

type ArmPose = {
  /** Shoulder angle in degrees; positive swings the hand toward screen-left. */
  s: number;
  /** Elbow angle relative to the upper arm. */
  e: number;
  /** Forearm length (shorter = reaching toward the viewer). */
  fl?: number;
  anim?: string;
  eAnim?: string;
  delay?: number;
};

type HairStyle = "short" | "bun" | "pony" | "curly";

type PersonProps = {
  x: number;
  y: number;
  scale?: number;
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  top: string;
  pants: string;
  shoes?: string;
  jacket?: { shirt: string; tie?: string };
  legs?: "stand" | "walk" | "sit";
  armL: ArmPose;
  armR: ArmPose;
  headAnim?: string;
  headDelay?: number;
  /** Drawn in front of the torso but behind the arms. */
  holding?: ReactNode;
  /** Drawn in front of everything (e.g. a laptop lid). */
  front?: ReactNode;
  shadow?: boolean;
};

function Arm({ side, pose, sleeve, skin }: { side: -1 | 1; pose: ArmPose; sleeve: string; skin: string }) {
  const fl = pose.fl ?? 19;
  const st = pose.delay !== undefined ? delay(pose.delay) : undefined;
  return (
    <g transform={`translate(${side * 11.5} -88) rotate(${pose.s})`}>
      <g className={`nib-anim ${pose.anim ?? ""}`} style={st}>
        <line x2={0} y2={21} stroke={sleeve} strokeWidth={6.5} strokeLinecap="round" />
        <g transform={`translate(0 21) rotate(${pose.e})`}>
          <g className={`nib-anim ${pose.eAnim ?? ""}`} style={st}>
            <line x2={0} y2={fl} stroke={sleeve} strokeWidth={5.8} strokeLinecap="round" />
            <circle cy={fl + 2} r={3.2} fill={skin} />
          </g>
        </g>
      </g>
    </g>
  );
}

function Hair({ style, color, layer }: { style: HairStyle; color: string; layer: "back" | "front" }) {
  if (layer === "back") {
    if (style === "pony") return <ellipse cx={8} cy={-10} rx={4} ry={9} fill={color} transform="rotate(-12 8 -10)" />;
    return null;
  }
  const cap = <path d="M-9 -14 C-9 -27 9 -27 9 -14 C5 -19 -3 -20 -9 -14 Z" fill={color} />;
  switch (style) {
    case "bun":
      return (
        <>
          {cap}
          <circle cx={0} cy={-26} r={4.6} fill={color} />
        </>
      );
    case "curly":
      return (
        <g fill={color}>
          {cap}
          {[
            [-8, -18, 4],
            [-4, -23, 4.5],
            [2, -24, 4.5],
            [7, -20, 4],
            [9.5, -14, 3.4],
            [-9.5, -12, 3.4],
          ].map(([cx, cy, r]) => (
            <circle key={`${cx}${cy}`} cx={cx} cy={cy} r={r} />
          ))}
        </g>
      );
    default:
      return cap;
  }
}

function Person({
  x,
  y,
  scale = 1,
  skin,
  hair,
  hairStyle,
  top,
  pants,
  shoes = C.brownDark,
  jacket,
  legs = "stand",
  armL,
  armR,
  headAnim,
  headDelay,
  holding,
  front,
  shadow = true,
}: PersonProps) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {shadow && <ellipse cx={0} cy={0} rx={18} ry={4.5} fill={C.shadow} />}
      <g className="nib-anim a-breathe">
        {/* legs */}
        {legs === "stand" && (
          <g>
            <rect x={-9} y={-52} width={8} height={48} rx={3} fill={pants} />
            <rect x={1} y={-52} width={8} height={48} rx={3} fill={pants} />
            <rect x={-11} y={-5} width={10} height={5} rx={2.5} fill={shoes} />
            <rect x={1} y={-5} width={10} height={5} rx={2.5} fill={shoes} />
          </g>
        )}
        {legs === "walk" &&
          [-5, 5].map((lx, i) => (
            <g key={lx} transform={`translate(${lx} -52)`}>
              <g className="nib-anim a-leg" style={delay(i ? -0.5 : 0)}>
                <rect x={-4} y={0} width={8} height={48} rx={3} fill={pants} />
                <rect x={-5} y={45} width={10} height={5} rx={2.5} fill={shoes} />
              </g>
            </g>
          ))}
        {legs === "sit" && (
          <g>
            <rect x={-9} y={-47} width={7} height={40} rx={3} fill={pants} />
            <rect x={2} y={-47} width={7} height={40} rx={3} fill={pants} />
            <rect x={-11} y={-7} width={10} height={5} rx={2.5} fill={shoes} />
            <rect x={1} y={-7} width={10} height={5} rx={2.5} fill={shoes} />
          </g>
        )}

        {/* torso */}
        <path d="M-12 -88 Q-12 -93 -7 -93 L7 -93 Q12 -93 12 -88 L11 -50 L-11 -50 Z" fill={top} />
        {jacket && (
          <g>
            <path d="M-4.5 -93 L4.5 -93 L0 -70 Z" fill={jacket.shirt} />
            {jacket.tie && <path d="M-1.4 -91 L1.4 -91 L2 -76 L0 -73 L-2 -76 Z" fill={jacket.tie} />}
          </g>
        )}
        {/* a seated lap sits in front of the torso */}
        {legs === "sit" && <rect x={-11} y={-57} width={22} height={13} rx={5} fill={pants} />}

        {/* head */}
        <g transform="translate(0 -93)">
          <g className={`nib-anim ${headAnim ?? ""}`} style={headDelay !== undefined ? delay(headDelay) : undefined}>
            <Hair style={hairStyle} color={hair} layer="back" />
            <rect x={-2.6} y={-7} width={5.2} height={8} fill={skin} />
            <circle cx={0} cy={-15} r={8.6} fill={skin} />
            <Hair style={hairStyle} color={hair} layer="front" />
          </g>
        </g>

        {holding}
        <Arm side={-1} pose={armL} sleeve={top} skin={skin} />
        <Arm side={1} pose={armR} sleeve={top} skin={skin} />
        {front}
      </g>
    </g>
  );
}

const Tablet = ({ x, y, w = 20, h = 13, rotate = 0 }: { x: number; y: number; w?: number; h?: number; rotate?: number }) => (
  <g transform={`translate(${x} ${y}) rotate(${rotate})`}>
    <rect x={-w / 2} y={-h / 2} width={w} height={h} rx={2} fill={C.brownDark} />
    <rect x={-w / 2 + 1.6} y={-h / 2 + 1.6} width={w - 3.2} height={h - 3.2} rx={1} fill={C.gold} opacity={0.85} />
    <rect className="a-blink" x={-w / 2 + 3.5} y={-1} width={w * 0.45} height={2} rx={1} fill={C.paper} />
  </g>
);

/* ------------------------------------------------------------------ */
/* Scenery                                                             */
/* ------------------------------------------------------------------ */

/** Isometric box with its front-bottom corner at (x, y). */
function IsoBox({
  x,
  y,
  a,
  b,
  h,
  top = "#F6F2EA",
  left = "#EAE2D5",
  right = "#DDD2C1",
}: {
  x: number;
  y: number;
  a: number;
  b: number;
  h: number;
  top?: string;
  left?: string;
  right?: string;
}) {
  const R = { x: 0.866 * a, y: -0.5 * a };
  const L = { x: -0.866 * b, y: -0.5 * b };
  const pt = (px: number, py: number) => `${px.toFixed(1)},${py.toFixed(1)}`;
  return (
    <g>
      <polygon points={[pt(x, y), pt(x + R.x, y + R.y), pt(x + R.x, y + R.y - h), pt(x, y - h)].join(" ")} fill={right} />
      <polygon points={[pt(x, y), pt(x + L.x, y + L.y), pt(x + L.x, y + L.y - h), pt(x, y - h)].join(" ")} fill={left} />
      <polygon
        points={[pt(x, y - h), pt(x + R.x, y + R.y - h), pt(x + R.x + L.x, y + R.y + L.y - h), pt(x + L.x, y + L.y - h)].join(" ")}
        fill={top}
      />
    </g>
  );
}

function Plant({ x, y }: { x: number; y: number }) {
  const leaves = [
    { d: "M0 0 C-4 -14 -14 -22 -20 -24 C-18 -14 -10 -4 0 0 Z", dl: 0 },
    { d: "M0 0 C4 -14 14 -22 20 -26 C18 -14 10 -4 0 0 Z", dl: 0.6 },
    { d: "M0 0 C-2 -18 -2 -30 2 -40 C6 -28 5 -14 0 0 Z", dl: 1.2 },
    { d: "M0 -8 C-8 -20 -18 -26 -24 -38 C-12 -36 -4 -24 0 -8 Z", dl: 1.8 },
    { d: "M0 -10 C8 -22 16 -30 24 -40 C12 -38 4 -26 0 -10 Z", dl: 2.4 },
  ];
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx={0} cy={2} rx={16} ry={4} fill={C.shadow} />
      <path d="M-12 -22 L12 -22 L9 0 L-9 0 Z" fill="#F6F2EA" />
      <ellipse cx={0} cy={-22} rx={12} ry={3.2} fill="#EAE2D5" />
      <g transform="translate(0 -22)">
        {leaves.map((l, i) => (
          <path key={i} d={l.d} className="nib-self-bottom a-sway" style={delay(l.dl)} fill={i % 2 ? C.goldDeep : C.gold} />
        ))}
      </g>
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Scene                                                               */
/* ------------------------------------------------------------------ */

export function LoginIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 40 640 480"
      className={className}
      role="img"
      aria-label="Nib Bank team members collaborating around a ring of live financial dashboards"
    >
      <defs>
        <linearGradient id="nibil-panel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.brownMid} />
          <stop offset="100%" stopColor={C.brownDark} />
        </linearGradient>
        <linearGradient id="nibil-sheen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F8F6F1" stopOpacity={0.08} />
          <stop offset="45%" stopColor="#F8F6F1" stopOpacity={0} />
        </linearGradient>
        <radialGradient id="nibil-floor" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={C.floor} />
          <stop offset="100%" stopColor={C.floor} stopOpacity={0} />
        </radialGradient>
      </defs>

      {/* floor */}
      <ellipse cx={320} cy={340} rx={310} ry={150} fill="url(#nibil-floor)" />
      <ellipse cx={RING.cx} cy={RING.cy} rx={RING.rx + 14} ry={RING.ry + 8} fill="#ECE3D3" opacity={0.55} />

      {/* back scenery */}
      <Plant x={572} y={232} />
      <g className="a-float" style={delay(0.8)}>
        <IsoBox x={58} y={316} a={22} b={22} h={22} />
      </g>
      <g className="a-float" style={delay(2.2)}>
        <IsoBox x={608} y={330} a={18} b={18} h={20} top="#F2EADB" left="#E3CFA6" right="#D6BD8A" />
      </g>

      {/* back half of the dashboard ring */}
      <RingPanels panels={BACK_PANELS} glow />
      <Rim from={195} to={345} h={BACK_H} />

      {/* people inside the ring */}
      <g className="a-walk" style={delay(-3)}>
        <Person
          x={392}
          y={276}
          scale={0.78}
          skin="#6b4428"
          hair="#33241B"
          hairStyle="short"
          top={C.brownMid}
          pants={C.brownDark}
          legs="walk"
          armL={{ s: 0, e: -8, anim: "a-swing", delay: -0.5 }}
          armR={{ s: 0, e: 8, anim: "a-swing" }}
          headAnim="a-look"
        />
      </g>

      <Person
        x={268}
        y={312}
        scale={0.9}
        skin="#8d5a3b"
        hair="#3B2A1F"
        hairStyle="bun"
        top={C.gold}
        pants={C.brown}
        armL={{ s: 140, e: 15, anim: "a-point" }}
        armR={{ s: 8, e: 85, fl: 16 }}
        headAnim="a-look"
        holding={<Tablet x={-2} y={-73} w={12} h={16} rotate={-6} />}
      />

      <Person
        x={352}
        y={338}
        scale={0.92}
        skin="#6b4428"
        hair="#33241B"
        hairStyle="short"
        top={C.paper}
        pants="#57402F"
        armL={{ s: 0, e: -65, fl: 11 }}
        armR={{ s: 0, e: 65, fl: 11, eAnim: "a-tap", delay: 0.4 }}
        headAnim="a-nod"
        front={<Tablet x={0} y={-61} rotate={-4} />}
      />

      {/* front halves of the ring */}
      <RingPanels panels={FRONT_LEFT} />
      <Rim from={112} to={158} h={FRONT_H} />
      <RingPanels panels={FRONT_RIGHT} />
      <Rim from={22} to={68} h={FRONT_H} />

      {/* left: desk with laptop, analyst with tablet */}
      <IsoBox x={88} y={486} a={46} b={40} h={46} />
      <g transform="translate(90 440)">
        <polygon points="-22,-2 20,-2 27,9 -29,9" fill="#E6DDCF" />
        <polygon points="-18,0 16,0 20,6 -22,6" fill="#D3C6B2" />
        <rect x={-22} y={-34} width={42} height={32} rx={2.5} fill={C.brownDark} />
        <rect x={-19} y={-31} width={36} height={26} rx={1.5} fill={C.brownMid} />
        {[0.45, 0.7, 0.55, 0.9, 0.75].map((bh, j) => (
          <rect
            key={j}
            className="nib-self-bottom a-bar"
            style={delay(j * 0.35)}
            x={-16 + j * 6.6}
            y={-7 - 20 * bh}
            width={4.2}
            height={20 * bh}
            rx={1}
            fill={j % 2 ? C.goldLight : C.gold}
          />
        ))}
      </g>

      <Person
        x={176}
        y={470}
        scale={1.1}
        skin="#6b4428"
        hair="#33241B"
        hairStyle="short"
        top={C.gold}
        pants={C.brownDark}
        armL={{ s: 0, e: -65, fl: 11 }}
        armR={{ s: 0, e: 65, fl: 11, eAnim: "a-tap" }}
        headAnim="a-nod"
        headDelay={0.7}
        front={<Tablet x={0} y={-61} rotate={3} />}
      />

      {/* centre: two colleagues discussing */}
      <Person
        x={300}
        y={494}
        scale={1.08}
        skin="#7a4a2c"
        hair="#33241B"
        hairStyle="curly"
        top={C.paper}
        pants={C.brown}
        armL={{ s: -8, e: -80, fl: 14 }}
        armR={{ s: -25, e: -130, eAnim: "a-gesture", delay: 1.2 }}
        headAnim="a-look"
        headDelay={1.5}
        holding={<Tablet x={2} y={-73} w={11} h={15} rotate={-8} />}
      />
      <Person
        x={374}
        y={490}
        scale={1.12}
        skin="#5c3a22"
        hair="#33241B"
        hairStyle="short"
        top={C.brownMid}
        jacket={{ shirt: C.paper, tie: C.gold }}
        pants={C.brownDark}
        armL={{ s: 4, e: 6 }}
        armR={{ s: -28, e: -95, eAnim: "a-gesture" }}
        headAnim="a-look"
        headDelay={3}
      />

      {/* right: seated colleague typing */}
      <IsoBox x={522} y={482} a={34} b={34} h={40} />
      <Person
        x={522}
        y={478}
        scale={1.02}
        skin="#8d5a3b"
        hair="#3B2A1F"
        hairStyle="pony"
        top={C.gold}
        pants={C.brownDark}
        legs="sit"
        armL={{ s: -14, e: -40, fl: 12, anim: "a-type" }}
        armR={{ s: 14, e: 40, fl: 12, anim: "a-type", delay: -0.21 }}
        headAnim="a-nod"
        front={
          <g>
            <rect x={-15} y={-64} width={30} height={4} rx={1.5} fill="#E6DDCF" />
            <rect x={-13} y={-84} width={26} height={20} rx={2} fill={C.brown} />
            <circle cx={0} cy={-74} r={3.2} fill={C.gold} />
          </g>
        }
      />
      {[0, 1.2, 2.4].map((dl, i) => (
        <g key={dl} className="a-rise" style={delay(dl)}>
          <rect x={538 + i * 9} y={356} width={9} height={6} rx={1.5} fill={i === 1 ? C.goldLight : C.gold} />
        </g>
      ))}

      {/* sparkles */}
      {[
        [110, 150, 0],
        [540, 130, 1.4],
        [600, 420, 2.6],
        [40, 420, 3.4],
        [470, 90, 4.2],
      ].map(([cx, cy, dl]) => (
        <circle key={`${cx}`} className="a-float" style={delay(dl)} cx={cx} cy={cy} r={3} fill={C.gold} opacity={0.7} />
      ))}
    </svg>
  );
}
