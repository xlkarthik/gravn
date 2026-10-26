'use client';

import type { Exercise } from '@gravn/shared';
import { useState } from 'react';

export type MovementPattern =
  | 'squat'
  | 'hinge'
  | 'bench'
  | 'pushup'
  | 'fly'
  | 'vertical_pull'
  | 'horizontal_row'
  | 'overhead_press'
  | 'lateral_raise'
  | 'curl'
  | 'tricep_ext'
  | 'leg_ext_curl'
  | 'calf'
  | 'core';

export function classifyExercisePattern(name: string, primaryMuscle?: string): MovementPattern {
  const n = name.toLowerCase();
  if (n.includes('squat') || n.includes('lunge') || n.includes('leg press')) return 'squat';
  if (
    n.includes('deadlift') ||
    n.includes('hip thrust') ||
    n.includes('glute bridge') ||
    n.includes('pull-through') ||
    n.includes('swing')
  ) {
    return 'hinge';
  }
  if (n.includes('bench press') || n.includes('dumbbell press') || n.includes('chest press')) {
    return 'bench';
  }
  if (n.includes('push-up') || n.includes('dip')) return 'pushup';
  if (n.includes('fly') || n.includes('pec deck')) return 'fly';
  if (n.includes('pull-up') || n.includes('chin-up') || n.includes('pulldown')) {
    return 'vertical_pull';
  }
  if (n.includes('row') || n.includes('face pull')) return 'horizontal_row';
  if (n.includes('overhead') || n.includes('shoulder press')) return 'overhead_press';
  if (n.includes('lateral raise')) return 'lateral_raise';
  if (n.includes('bicep') || n.includes('hammer curl') || n.includes('dumbbell curl')) {
    return 'curl';
  }
  if (n.includes('tricep') || n.includes('skullcrusher')) return 'tricep_ext';
  if (n.includes('leg extension') || n.includes('leg curl')) return 'leg_ext_curl';
  if (n.includes('calf')) return 'calf';
  if (
    n.includes('plank') ||
    n.includes('knee raise') ||
    n.includes('crunch') ||
    n.includes('dead bug') ||
    n.includes('farmer')
  ) {
    return 'core';
  }

  switch (primaryMuscle) {
    case 'quads':
      return 'squat';
    case 'hamstrings':
    case 'glutes':
      return 'hinge';
    case 'chest':
      return 'bench';
    case 'back':
      return 'vertical_pull';
    case 'shoulders':
      return 'overhead_press';
    case 'biceps':
      return 'curl';
    case 'triceps':
      return 'tricep_ext';
    case 'calves':
      return 'calf';
    default:
      return 'core';
  }
}

interface ThumbProps {
  name: string;
  primaryMuscle?: string;
  equipmentId?: string;
  instructions?: string;
  demoUrl?: string | null;
  size?: number;
  interactive?: boolean;
}

export function resolveHumanGifUrl(name: string, demoUrl?: string | null): string | null {
  if (
    demoUrl &&
    (demoUrl.startsWith('http://') || demoUrl.startsWith('https://') || demoUrl.startsWith('/'))
  ) {
    return demoUrl;
  }
  const n = name.toLowerCase();
  if (
    n.includes('incline') &&
    (n.includes('bench') || n.includes('press'))
  ) {
    return '/exercises/incline-bench-press.gif';
  }
  if (
    n.includes('bench press') ||
    n.includes('dumbbell press') ||
    n.includes('chest press')
  ) {
    return '/exercises/flat-bench-press.gif';
  }
  return null;
}

export function ExerciseGif({
  name,
  primaryMuscle,
  equipmentId,
  instructions,
  demoUrl,
  size = 44,
  interactive = true,
}: ThumbProps) {
  const [openModal, setOpenModal] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const resolvedGifUrl = resolveHumanGifUrl(name, demoUrl);
  const hasCustomGif = Boolean(resolvedGifUrl) && !imgFailed;

  const pattern = classifyExercisePattern(name, primaryMuscle);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          if (!interactive) return;
          e.stopPropagation();
          setOpenModal(true);
        }}
        title={interactive ? `View ${name} animated demo` : name}
        className="gravn-gif-thumb"
        style={{
          width: size,
          height: size,
          borderRadius: Math.max(8, Math.round(size * 0.22)),
          cursor: interactive ? 'pointer' : 'default',
        }}
      >
        {hasCustomGif ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={resolvedGifUrl!}
            alt={name}
            onError={() => setImgFailed(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <AnimatedBiomechSvg pattern={pattern} />
        )}
        <span className="gravn-gif-badge">GIF</span>
      </button>

      {openModal && (
        <div
          className="lux-modal-backdrop"
          onClick={(e) => {
            e.stopPropagation();
            setOpenModal(false);
          }}
        >
          <div
            className="lux-modal"
            style={{ maxWidth: 420 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="lux-modal-header">
              <div>
                <span className="eyebrow" style={{ marginBottom: 2 }}>
                  {[primaryMuscle, equipmentId].filter(Boolean).join(' · ') || 'Movement Demo'}
                </span>
                <h3 className="serif-md">{name}</h3>
              </div>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => setOpenModal(false)}
              >
                Close
              </button>
            </div>

            <div className="lux-modal-body" style={{ alignItems: 'center' }}>
              <div
                className="gravn-gif-stage"
                style={{
                  width: '100%',
                  height: hasCustomGif ? 280 : 220,
                  borderRadius: 16,
                  background:
                    'radial-gradient(60% 60% at 50% 50%, rgba(255, 46, 31, 0.16) 0%, rgba(10, 12, 16, 0.98) 75%)',
                  border: '1px solid var(--border-strong)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {hasCustomGif ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={resolvedGifUrl!}
                    alt={name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div style={{ width: 185, height: 185 }}>
                    <AnimatedBiomechSvg pattern={pattern} />
                  </div>
                )}

                <span
                  className="lux-tag"
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    fontSize: 10,
                  }}
                >
                  LIVE FORM LOOP
                </span>
              </div>

              {instructions && (
                <div
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 12,
                    background: '#0c0e13',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div className="lux-label" style={{ marginBottom: 4 }}>
                    Coaching Cues & Execution
                  </div>
                  <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {instructions}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function ExerciseGifFromRecord({
  exercise,
  fallbackName,
  size = 44,
}: {
  exercise?: Partial<Exercise> | null;
  fallbackName?: string;
  size?: number;
}) {
  return (
    <ExerciseGif
      name={exercise?.name ?? fallbackName ?? 'Movement'}
      primaryMuscle={exercise?.primary_muscle}
      equipmentId={exercise?.equipment_id}
      instructions={exercise?.instructions}
      demoUrl={exercise?.placeholder_demo}
      size={size}
    />
  );
}

function AnimatedBiomechSvg({ pattern }: { pattern: MovementPattern }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width="100%"
      height="100%"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`gravn-anim-svg gravn-pat-${pattern}`}
    >
      {/* Subtle Floor Grid & Gravity Ring */}
      <ellipse
        cx="50"
        cy="86"
        rx="30"
        ry="5"
        stroke="rgba(255, 46, 31, 0.35)"
        strokeWidth="1.2"
        className="gravn-gravity-ring"
      />
      <line x1="16" y1="86" x2="84" y2="86" stroke="#252A36" strokeWidth="1.5" strokeLinecap="round" />

      {pattern === 'squat' && (
        <>
          {/* Squat Rack Uprights */}
          <line x1="26" y1="18" x2="26" y2="86" stroke="#262B38" strokeWidth="2" />
          {/* Animated Upper Body + Barbell descending & driving up */}
          <g className="gravn-motion-squat">
            <circle cx="50" cy="24" r="6" fill="#E5E7EB" />
            {/* Torso */}
            <line x1="50" y1="31" x2="46" y2="54" stroke="#D1D5DB" strokeWidth="4.5" strokeLinecap="round" />
            {/* Glowing Quad / Glute Target Muscle */}
            <line x1="46" y1="54" x2="58" y2="68" stroke="#FF2E1F" strokeWidth="5.5" strokeLinecap="round" className="gravn-muscle-glow" />
            {/* Barbell across traps */}
            <line x1="18" y1="31" x2="82" y2="31" stroke="#9CA3B0" strokeWidth="2.8" strokeLinecap="round" />
            <rect x="20" y="24" width="5" height="14" rx="1.5" fill="#FF2E1F" />
            <rect x="75" y="24" width="5" height="14" rx="1.5" fill="#FF2E1F" />
          </g>
          {/* Lower Shin Anchors */}
          <line x1="56" y1="68" x2="52" y2="85" stroke="#9CA3B0" strokeWidth="4" strokeLinecap="round" />
        </>
      )}

      {pattern === 'hinge' && (
        <>
          {/* Lower Legs */}
          <line x1="46" y1="58" x2="46" y2="85" stroke="#9CA3B0" strokeWidth="4.2" strokeLinecap="round" />
          <g className="gravn-motion-hinge">
            <circle cx="56" cy="26" r="6" fill="#E5E7EB" />
            {/* Torso & Glowing Hamstring/Glute Hinge */}
            <line x1="44" y1="56" x2="54" y2="32" stroke="#FF2E1F" strokeWidth="5" strokeLinecap="round" className="gravn-muscle-glow" />
            {/* Arms holding barbell */}
            <line x1="52" y1="36" x2="54" y2="62" stroke="#D1D5DB" strokeWidth="3.2" strokeLinecap="round" />
            {/* Barbell & Crimson Bumper Plates */}
            <circle cx="54" cy="64" r="9" fill="rgba(255,46,31,0.22)" stroke="#FF2E1F" strokeWidth="2.5" />
            <circle cx="54" cy="64" r="3" fill="#F3F5F8" />
          </g>
        </>
      )}

      {pattern === 'bench' && (
        <>
          {/* Flat/Incline Bench */}
          <line x1="22" y1="64" x2="72" y2="64" stroke="#2E3545" strokeWidth="5" strokeLinecap="round" />
          <line x1="30" y1="64" x2="30" y2="85" stroke="#252A36" strokeWidth="3" />
          <line x1="64" y1="64" x2="64" y2="85" stroke="#252A36" strokeWidth="3" />
          {/* Athlete supine on bench */}
          <circle cx="28" cy="56" r="5.5" fill="#E5E7EB" />
          <line x1="35" y1="58" x2="64" y2="58" stroke="#FF2E1F" strokeWidth="5.5" strokeLinecap="round" className="gravn-muscle-glow" />
          <line x1="64" y1="58" x2="76" y2="72" stroke="#9CA3B0" strokeWidth="4" strokeLinecap="round" />
          <line x1="76" y1="72" x2="76" y2="85" stroke="#9CA3B0" strokeWidth="3.5" strokeLinecap="round" />
          {/* Animated Pressing Arms + Barbell */}
          <g className="gravn-motion-press-v">
            <line x1="44" y1="56" x2="44" y2="30" stroke="#F3F5F8" strokeWidth="3.8" strokeLinecap="round" />
            <line x1="24" y1="28" x2="64" y2="28" stroke="#9CA3B0" strokeWidth="2.5" strokeLinecap="round" />
            <rect x="27" y="21" width="5" height="14" rx="1.5" fill="#FF2E1F" />
            <rect x="56" y="21" width="5" height="14" rx="1.5" fill="#FF2E1F" />
          </g>
        </>
      )}

      {pattern === 'pushup' && (
        <>
          <g className="gravn-motion-pushup">
            <circle cx="74" cy="46" r="5.5" fill="#E5E7EB" />
            {/* Rigid Plank Body with Glowing Chest/Core */}
            <line x1="22" y1="78" x2="68" y2="50" stroke="#FF2E1F" strokeWidth="5" strokeLinecap="round" className="gravn-muscle-glow" />
            {/* Pressing Arm */}
            <line x1="64" y1="52" x2="66" y2="84" stroke="#F3F5F8" strokeWidth="3.8" strokeLinecap="round" />
          </g>
        </>
      )}

      {pattern === 'fly' && (
        <>
          {/* Torso & Glowing Pecs/Shoulders */}
          <circle cx="50" cy="24" r="6" fill="#E5E7EB" />
          <line x1="50" y1="32" x2="50" y2="62" stroke="#D1D5DB" strokeWidth="5" strokeLinecap="round" />
          <circle cx="50" cy="42" r="7" fill="rgba(255,46,31,0.28)" className="gravn-muscle-glow" />
          <line x1="50" y1="62" x2="42" y2="85" stroke="#9CA3B0" strokeWidth="3.8" strokeLinecap="round" />
          <line x1="50" y1="62" x2="58" y2="85" stroke="#9CA3B0" strokeWidth="3.8" strokeLinecap="round" />
          {/* Left & Right Sweeping Fly Arms */}
          <g className="gravn-motion-fly-l">
            <line x1="46" y1="40" x2="20" y2="44" stroke="#FF2E1F" strokeWidth="3.8" strokeLinecap="round" />
            <circle cx="19" cy="44" r="3.5" fill="#F3F5F8" />
          </g>
          <g className="gravn-motion-fly-r">
            <line x1="54" y1="40" x2="80" y2="44" stroke="#FF2E1F" strokeWidth="3.8" strokeLinecap="round" />
            <circle cx="81" cy="44" r="3.5" fill="#F3F5F8" />
          </g>
        </>
      )}

      {pattern === 'vertical_pull' && (
        <>
          {/* Overhead Pull Bar & Cable */}
          <line x1="20" y1="16" x2="80" y2="16" stroke="#2E3545" strokeWidth="3" strokeLinecap="round" />
          <line x1="50" y1="16" x2="50" y2="34" stroke="#9CA3B0" strokeWidth="1.8" strokeDasharray="2 2" />
          {/* Torso with Glowing Lats */}
          <circle cx="50" cy="42" r="5.5" fill="#E5E7EB" />
          <path d="M40 50 L50 72 L60 50 Z" fill="rgba(255,46,31,0.32)" stroke="#FF2E1F" strokeWidth="2" className="gravn-muscle-glow" />
          <line x1="50" y1="72" x2="44" y2="85" stroke="#9CA3B0" strokeWidth="3.8" strokeLinecap="round" />
          <line x1="50" y1="72" x2="56" y2="85" stroke="#9CA3B0" strokeWidth="3.8" strokeLinecap="round" />
          {/* Animated Lat Bar + Pulling Arms */}
          <g className="gravn-motion-pull-v">
            <line x1="26" y1="28" x2="74" y2="28" stroke="#FF2E1F" strokeWidth="3" strokeLinecap="round" />
            <line x1="32" y1="28" x2="42" y2="50" stroke="#F3F5F8" strokeWidth="3.5" strokeLinecap="round" />
            <line x1="68" y1="28" x2="58" y2="50" stroke="#F3F5F8" strokeWidth="3.5" strokeLinecap="round" />
          </g>
        </>
      )}

      {pattern === 'horizontal_row' && (
        <>
          {/* Seated/Bent Row Posture */}
          <circle cx="44" cy="28" r="5.5" fill="#E5E7EB" />
          <line x1="44" y1="35" x2="40" y2="62" stroke="#FF2E1F" strokeWidth="5.5" strokeLinecap="round" className="gravn-muscle-glow" />
          <line x1="40" y1="62" x2="68" y2="62" stroke="#9CA3B0" strokeWidth="4" strokeLinecap="round" />
          <line x1="68" y1="62" x2="72" y2="84" stroke="#9CA3B0" strokeWidth="3.5" strokeLinecap="round" />
          {/* Cable Tower */}
          <line x1="82" y1="24" x2="82" y2="86" stroke="#2E3545" strokeWidth="3" />
          {/* Animated Rowing Arm & Cable */}
          <g className="gravn-motion-row-h">
            <line x1="44" y1="48" x2="66" y2="48" stroke="#F3F5F8" strokeWidth="3.8" strokeLinecap="round" />
            <line x1="66" y1="48" x2="82" y2="48" stroke="#FF2E1F" strokeWidth="2" strokeDasharray="3 2" />
            <circle cx="66" cy="48" r="3.5" fill="#FF2E1F" />
          </g>
        </>
      )}

      {pattern === 'overhead_press' && (
        <>
          {/* Standing Torso */}
          <circle cx="50" cy="40" r="5.5" fill="#E5E7EB" />
          <line x1="50" y1="47" x2="50" y2="68" stroke="#D1D5DB" strokeWidth="5" strokeLinecap="round" />
          <line x1="50" y1="68" x2="43" y2="85" stroke="#9CA3B0" strokeWidth="3.8" strokeLinecap="round" />
          <line x1="50" y1="68" x2="57" y2="85" stroke="#9CA3B0" strokeWidth="3.8" strokeLinecap="round" />
          {/* Glowing Shoulder Delts */}
          <circle cx="41" cy="48" r="4" fill="#FF2E1F" className="gravn-muscle-glow" />
          <circle cx="59" cy="48" r="4" fill="#FF2E1F" className="gravn-muscle-glow" />
          {/* Animated Overhead Barbell & Arms */}
          <g className="gravn-motion-ohp">
            <line x1="41" y1="48" x2="36" y2="24" stroke="#F3F5F8" strokeWidth="3.5" strokeLinecap="round" />
            <line x1="59" y1="48" x2="64" y2="24" stroke="#F3F5F8" strokeWidth="3.5" strokeLinecap="round" />
            <line x1="20" y1="24" x2="80" y2="24" stroke="#9CA3B0" strokeWidth="2.8" strokeLinecap="round" />
            <rect x="23" y="18" width="4.5" height="12" rx="1.5" fill="#FF2E1F" />
            <rect x="72.5" y="18" width="4.5" height="12" rx="1.5" fill="#FF2E1F" />
          </g>
        </>
      )}

      {pattern === 'lateral_raise' && (
        <>
          <circle cx="50" cy="26" r="5.5" fill="#E5E7EB" />
          <line x1="50" y1="33" x2="50" y2="62" stroke="#D1D5DB" strokeWidth="5" strokeLinecap="round" />
          <line x1="50" y1="62" x2="43" y2="85" stroke="#9CA3B0" strokeWidth="3.8" strokeLinecap="round" />
          <line x1="50" y1="62" x2="57" y2="85" stroke="#9CA3B0" strokeWidth="3.8" strokeLinecap="round" />
          {/* Glowing Medial Delts */}
          <circle cx="42" cy="36" r="4" fill="#FF2E1F" className="gravn-muscle-glow" />
          <circle cx="58" cy="36" r="4" fill="#FF2E1F" className="gravn-muscle-glow" />
          <g className="gravn-motion-lat-l">
            <line x1="42" y1="36" x2="20" y2="42" stroke="#F3F5F8" strokeWidth="3.5" strokeLinecap="round" />
            <rect x="15" y="39" width="6" height="6" rx="1.5" fill="#FF2E1F" />
          </g>
          <g className="gravn-motion-lat-r">
            <line x1="58" y1="36" x2="80" y2="42" stroke="#F3F5F8" strokeWidth="3.5" strokeLinecap="round" />
            <rect x="79" y="39" width="6" height="6" rx="1.5" fill="#FF2E1F" />
          </g>
        </>
      )}

      {pattern === 'curl' && (
        <>
          {/* Standing Torso & Pinned Upper Arm with Glowing Bicep */}
          <circle cx="44" cy="24" r="5.5" fill="#E5E7EB" />
          <line x1="44" y1="31" x2="44" y2="62" stroke="#D1D5DB" strokeWidth="5" strokeLinecap="round" />
          <line x1="44" y1="62" x2="40" y2="85" stroke="#9CA3B0" strokeWidth="4" strokeLinecap="round" />
          <line x1="44" y1="62" x2="50" y2="85" stroke="#9CA3B0" strokeWidth="4" strokeLinecap="round" />
          {/* Glowing Bicep Upper Arm */}
          <line x1="46" y1="34" x2="48" y2="52" stroke="#FF2E1F" strokeWidth="5.5" strokeLinecap="round" className="gravn-muscle-glow" />
          {/* Animated Forearm + Dumbbell Curling Up */}
          <g className="gravn-motion-curl">
            <line x1="48" y1="52" x2="68" y2="42" stroke="#F3F5F8" strokeWidth="3.8" strokeLinecap="round" />
            <circle cx="70" cy="41" r="5" fill="#FF2E1F" />
            <circle cx="70" cy="41" r="2" fill="#FFFFFF" />
          </g>
        </>
      )}

      {pattern === 'tricep_ext' && (
        <>
          {/* Cable Pulley Line */}
          <line x1="72" y1="16" x2="72" y2="86" stroke="#2E3545" strokeWidth="2.5" />
          <circle cx="42" cy="24" r="5.5" fill="#E5E7EB" />
          <line x1="42" y1="31" x2="42" y2="62" stroke="#D1D5DB" strokeWidth="5" strokeLinecap="round" />
          <line x1="42" y1="62" x2="38" y2="85" stroke="#9CA3B0" strokeWidth="4" strokeLinecap="round" />
          <line x1="42" y1="62" x2="48" y2="85" stroke="#9CA3B0" strokeWidth="4" strokeLinecap="round" />
          {/* Glowing Tricep Upper Arm */}
          <line x1="44" y1="34" x2="48" y2="50" stroke="#FF2E1F" strokeWidth="5.5" strokeLinecap="round" className="gravn-muscle-glow" />
          {/* Animated Forearm Extending Down */}
          <g className="gravn-motion-tricep">
            <line x1="48" y1="50" x2="62" y2="66" stroke="#F3F5F8" strokeWidth="3.8" strokeLinecap="round" />
            <line x1="72" y1="18" x2="62" y2="66" stroke="#9CA3B0" strokeWidth="1.5" strokeDasharray="2 2" />
            <circle cx="62" cy="66" r="4" fill="#FF2E1F" />
          </g>
        </>
      )}

      {pattern === 'leg_ext_curl' && (
        <>
          {/* Seated Machine Frame */}
          <line x1="30" y1="58" x2="56" y2="58" stroke="#2E3545" strokeWidth="4.5" strokeLinecap="round" />
          <line x1="34" y1="58" x2="34" y2="85" stroke="#252A36" strokeWidth="3.5" />
          <circle cx="36" cy="28" r="5.5" fill="#E5E7EB" />
          <line x1="36" y1="35" x2="36" y2="56" stroke="#D1D5DB" strokeWidth="5" strokeLinecap="round" />
          {/* Glowing Quad/Hamstring Thigh */}
          <line x1="36" y1="56" x2="58" y2="56" stroke="#FF2E1F" strokeWidth="6" strokeLinecap="round" className="gravn-muscle-glow" />
          {/* Animated Lower Leg Extending */}
          <g className="gravn-motion-leg-ext">
            <line x1="58" y1="56" x2="78" y2="48" stroke="#F3F5F8" strokeWidth="4.2" strokeLinecap="round" />
            <circle cx="78" cy="48" r="4.5" fill="#FF2E1F" />
          </g>
        </>
      )}

      {pattern === 'calf' && (
        <>
          {/* Step Block */}
          <rect x="34" y="80" width="32" height="6" rx="2" fill="#2E3545" />
          <g className="gravn-motion-calf">
            <circle cx="50" cy="22" r="5.5" fill="#E5E7EB" />
            <line x1="50" y1="29" x2="50" y2="56" stroke="#D1D5DB" strokeWidth="5" strokeLinecap="round" />
            <line x1="50" y1="56" x2="50" y2="68" stroke="#9CA3B0" strokeWidth="4.5" strokeLinecap="round" />
            {/* Glowing Calves */}
            <line x1="50" y1="68" x2="50" y2="80" stroke="#FF2E1F" strokeWidth="6" strokeLinecap="round" className="gravn-muscle-glow" />
          </g>
        </>
      )}

      {pattern === 'core' && (
        <>
          <g className="gravn-motion-core">
            <circle cx="72" cy="54" r="5.5" fill="#E5E7EB" />
            {/* Glowing Core / Abs */}
            <line x1="24" y1="74" x2="66" y2="58" stroke="#FF2E1F" strokeWidth="5.5" strokeLinecap="round" className="gravn-muscle-glow" />
            {/* Forearm brace */}
            <line x1="64" y1="58" x2="64" y2="78" stroke="#F3F5F8" strokeWidth="3.8" strokeLinecap="round" />
            <line x1="64" y1="78" x2="76" y2="78" stroke="#F3F5F8" strokeWidth="3.5" strokeLinecap="round" />
          </g>
        </>
      )}
    </svg>
  );
}
