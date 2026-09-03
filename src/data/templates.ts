import type { Plan, PlanDay, Weekday } from '../types';
import { emptyDays, uid } from '../storage/defaults';

export interface TemplateDay {
  weekday: Weekday;
  title: string;
  /** [Uebungs-ID, Saetze, Wdh von, Wdh bis] */
  exercises: Array<[string, number, number, number]>;
}

export interface PlanTemplate {
  id: string;
  name: string;
  description: string;
  days: TemplateDay[];
}

export const PLAN_TEMPLATES: PlanTemplate[] = [
  {
    id: 'ppl',
    name: 'Push / Pull / Legs (3 Tage)',
    description: 'Der Klassiker: Drucken, Ziehen, Beine. Gut für alle, die dreimal pro Woche trainieren.',
    days: [
      {
        weekday: 0, title: 'Push (Brust / Schulter / Trizeps)',
        exercises: [
          ['cat_barbell-bench-press', 4, 6, 10],
          ['cat_incline-dumbbell-press', 3, 8, 12],
          ['cat_overhead-press', 3, 6, 10],
          ['cat_dumbbell-lateral-raise', 3, 12, 15],
          ['cat_rope-pushdown', 3, 10, 15],
        ],
      },
      {
        weekday: 2, title: 'Pull (Rücken / Bizeps)',
        exercises: [
          ['cat_pull-up', 4, 5, 10],
          ['cat_barbell-bent-over-row', 4, 6, 10],
          ['cat_seated-cable-row', 3, 10, 12],
          ['cat_face-pull', 3, 12, 20],
          ['cat_ez-bar-curl', 3, 8, 12],
        ],
      },
      {
        weekday: 4, title: 'Legs (Beine / Rumpf)',
        exercises: [
          ['cat_barbell-back-squat', 4, 5, 8],
          ['cat_romanian-deadlift', 3, 8, 12],
          ['cat_leg-press', 3, 10, 15],
          ['cat_lying-leg-curl', 3, 10, 15],
          ['cat_standing-calf-raise', 4, 12, 20],
          ['cat_plank', 3, 0, 0],
        ],
      },
    ],
  },
  {
    id: 'upper-lower',
    name: 'Oberkörper / Unterkörper (4 Tage)',
    description: 'Zweimal Oberkörper, zweimal Beine. Sehr effizient für Kraft und Aufbau.',
    days: [
      {
        weekday: 0, title: 'Oberkörper (schwer)',
        exercises: [
          ['cat_barbell-bench-press', 4, 5, 8],
          ['cat_barbell-bent-over-row', 4, 5, 8],
          ['cat_overhead-press', 3, 6, 10],
          ['cat_lat-pulldown', 3, 8, 12],
          ['cat_ez-bar-curl', 3, 8, 12],
          ['cat_skull-crusher', 3, 8, 12],
        ],
      },
      {
        weekday: 1, title: 'Unterkörper (schwer)',
        exercises: [
          ['cat_barbell-back-squat', 4, 5, 8],
          ['cat_romanian-deadlift', 3, 6, 10],
          ['cat_bulgarian-split-squat', 3, 8, 12],
          ['cat_seated-calf-raise', 4, 12, 20],
          ['cat_hanging-leg-raise', 3, 10, 15],
        ],
      },
      {
        weekday: 3, title: 'Oberkörper (Volumen)',
        exercises: [
          ['cat_incline-dumbbell-press', 4, 8, 12],
          ['cat_one-arm-dumbbell-row', 4, 8, 12],
          ['cat_dumbbell-shoulder-press', 3, 10, 12],
          ['cat_cable-crossover', 3, 12, 15],
          ['cat_face-pull', 3, 15, 20],
          ['cat_hammer-curl', 3, 10, 15],
        ],
      },
      {
        weekday: 5, title: 'Unterkörper (Volumen)',
        exercises: [
          ['cat_leg-press', 4, 10, 15],
          ['cat_barbell-hip-thrust', 3, 10, 15],
          ['cat_lying-leg-curl', 3, 12, 15],
          ['cat_leg-extension', 3, 12, 15],
          ['cat_standing-calf-raise', 4, 15, 20],
        ],
      },
    ],
  },
  {
    id: 'fullbody',
    name: 'Ganzkörper (3 Tage)',
    description: 'Jede Einheit trainiert den ganzen Körper – ideal für den Einstieg oder wenig Zeit.',
    days: [
      {
        weekday: 0, title: 'Ganzkörper A',
        exercises: [
          ['cat_barbell-back-squat', 3, 6, 10],
          ['cat_barbell-bench-press', 3, 6, 10],
          ['cat_barbell-bent-over-row', 3, 8, 12],
          ['cat_plank', 3, 0, 0],
        ],
      },
      {
        weekday: 2, title: 'Ganzkörper B',
        exercises: [
          ['cat_deadlift', 3, 5, 8],
          ['cat_overhead-press', 3, 6, 10],
          ['cat_lat-pulldown', 3, 8, 12],
          ['cat_hanging-knee-raise', 3, 10, 15],
        ],
      },
      {
        weekday: 4, title: 'Ganzkörper C',
        exercises: [
          ['cat_leg-press', 3, 10, 15],
          ['cat_incline-dumbbell-press', 3, 8, 12],
          ['cat_seated-cable-row', 3, 10, 12],
          ['cat_dumbbell-lateral-raise', 3, 12, 15],
          ['cat_ez-bar-curl', 3, 10, 12],
        ],
      },
    ],
  },
  {
    id: 'split5',
    name: '5er-Split (5 Tage)',
    description: 'Je ein Tag pro Muskelgruppe – viel Volumen, für Fortgeschrittene.',
    days: [
      {
        weekday: 0, title: 'Brust',
        exercises: [
          ['cat_barbell-bench-press', 4, 6, 10],
          ['cat_incline-dumbbell-press', 4, 8, 12],
          ['cat_cable-crossover', 3, 12, 15],
          ['cat_chest-dips', 3, 8, 12],
        ],
      },
      {
        weekday: 1, title: 'Rücken',
        exercises: [
          ['cat_deadlift', 4, 4, 6],
          ['cat_pull-up', 4, 6, 10],
          ['cat_t-bar-row', 3, 8, 12],
          ['cat_straight-arm-pulldown', 3, 12, 15],
        ],
      },
      {
        weekday: 2, title: 'Beine',
        exercises: [
          ['cat_barbell-back-squat', 4, 5, 8],
          ['cat_romanian-deadlift', 3, 8, 12],
          ['cat_leg-extension', 3, 12, 15],
          ['cat_lying-leg-curl', 3, 12, 15],
          ['cat_standing-calf-raise', 4, 15, 20],
        ],
      },
      {
        weekday: 3, title: 'Schultern',
        exercises: [
          ['cat_overhead-press', 4, 6, 10],
          ['cat_dumbbell-lateral-raise', 4, 12, 20],
          ['cat_reverse-pec-deck', 3, 15, 20],
          ['cat_barbell-shrug', 3, 10, 15],
        ],
      },
      {
        weekday: 4, title: 'Arme',
        exercises: [
          ['cat_barbell-curl', 4, 8, 12],
          ['cat_close-grip-bench-press', 4, 8, 12],
          ['cat_incline-dumbbell-curl', 3, 10, 12],
          ['cat_overhead-triceps-extension', 3, 10, 15],
          ['cat_hammer-curl', 3, 12, 15],
        ],
      },
    ],
  },
  {
    id: 'home',
    name: 'Zuhause ohne Geräte (3 Tage)',
    description: 'Nur Körpergewicht – funktioniert im Wohnzimmer, Hotel oder Park.',
    days: [
      {
        weekday: 0, title: 'Oberkörper',
        exercises: [
          ['cat_push-up', 4, 8, 20],
          ['cat_pull-up', 4, 3, 10],
          ['cat_diamond-push-up', 3, 8, 15],
          ['cat_plank', 3, 0, 0],
        ],
      },
      {
        weekday: 2, title: 'Beine & Gesäß',
        exercises: [
          ['cat_jump-squat', 4, 12, 20],
          ['cat_bulgarian-split-squat', 3, 10, 15],
          ['cat_glute-bridge', 3, 15, 20],
          ['cat_wall-sit', 3, 0, 0],
        ],
      },
      {
        weekday: 4, title: 'Ganzkörper & Kondition',
        exercises: [
          ['cat_burpee', 4, 10, 15],
          ['cat_mountain-climber', 3, 20, 30],
          ['cat_push-up', 3, 10, 20],
          ['cat_side-plank', 3, 0, 0],
        ],
      },
    ],
  },
];

export function buildTemplatePlan(template: PlanTemplate): Plan {
  const now = new Date().toISOString();
  const days: PlanDay[] = emptyDays();

  for (const day of template.days) {
    days[day.weekday] = {
      weekday: day.weekday,
      title: day.title,
      isRestDay: false,
      exercises: day.exercises.map(([exerciseId, targetSets, repsMin, repsMax]) => ({
        id: uid('pe'),
        exerciseId,
        targetSets,
        targetRepsMin: repsMin > 0 ? repsMin : null,
        targetRepsMax: repsMax > 0 ? repsMax : null,
        targetWeightKg: null,
        restSec: 120,
      })),
    };
  }

  return {
    id: uid('plan'),
    name: template.name,
    description: template.description,
    days,
    createdAt: now,
    updatedAt: now,
  };
}
