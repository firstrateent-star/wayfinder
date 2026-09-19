export interface TrainingExerciseReference {
  key: string;
  label: string;
  aliases: readonly string[];
}

function normalize(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const TRAINING_EXERCISES_V0: readonly TrainingExerciseReference[] = [
  { key: "barbell_bench_press", label: "Barbell Bench Press", aliases: ["bench", "bench press", "barbell bench press", "benched"] },
  { key: "dumbbell_bench_press", label: "Dumbbell Bench Press", aliases: ["dumbbell bench", "db bench", "dumbbell bench press"] },
  { key: "incline_bench_press", label: "Incline Bench Press", aliases: ["incline bench", "incline bench press"] },
  { key: "back_squat", label: "Back Squat", aliases: ["squat", "squats", "back squat", "barbell squat"] },
  { key: "front_squat", label: "Front Squat", aliases: ["front squat", "front squats"] },
  { key: "leg_press", label: "Leg Press", aliases: ["leg press"] },
  { key: "leg_extension", label: "Leg Extension", aliases: ["leg extension", "leg extensions", "quad extension", "quad extensions"] },
  { key: "hamstring_curl", label: "Hamstring Curl", aliases: ["hamstring curl", "hamstring curls", "leg curl", "leg curls"] },
  { key: "calf_raise", label: "Calf Raise", aliases: ["calf raise", "calf raises", "calves", "calf"] },
  { key: "deadlift", label: "Deadlift", aliases: ["deadlift", "deadlifts", "conventional deadlift"] },
  { key: "romanian_deadlift", label: "Romanian Deadlift", aliases: ["romanian deadlift", "romanian deadlifts", "rdl", "rdls"] },
  { key: "lunge", label: "Lunge", aliases: ["lunge", "lunges", "walking lunge", "walking lunges"] },
  { key: "bulgarian_split_squat", label: "Bulgarian Split Squat", aliases: ["bulgarian split squat", "bulgarian split squats", "bulgarians"] },
  { key: "hip_thrust", label: "Hip Thrust", aliases: ["hip thrust", "hip thrusts", "barbell hip thrust"] },
  { key: "overhead_press", label: "Overhead Press", aliases: ["overhead press", "ohp", "military press", "shoulder press", "barbell shoulder press"] },
  { key: "dumbbell_shoulder_press", label: "Dumbbell Shoulder Press", aliases: ["dumbbell shoulder press", "db shoulder press"] },
  { key: "lateral_raise", label: "Lateral Raise", aliases: ["lateral raise", "lateral raises", "side raise", "side raises"] },
  { key: "barbell_row", label: "Barbell Row", aliases: ["barbell row", "barbell rows", "bent over row", "bent over rows"] },
  { key: "dumbbell_row", label: "Dumbbell Row", aliases: ["dumbbell row", "dumbbell rows", "db row", "one arm row"] },
  { key: "seated_cable_row", label: "Seated Cable Row", aliases: ["seated cable row", "cable row", "cable rows"] },
  { key: "lat_pulldown", label: "Lat Pulldown", aliases: ["lat pulldown", "lat pulldowns", "pulldown", "pulldowns"] },
  { key: "pull_up", label: "Pull-Up", aliases: ["pull up", "pull ups", "pullup", "pullups"] },
  { key: "chin_up", label: "Chin-Up", aliases: ["chin up", "chin ups", "chinup", "chinups"] },
  { key: "biceps_curl", label: "Biceps Curl", aliases: ["biceps curl", "bicep curl", "biceps curls", "bicep curls", "curl", "curls"] },
  { key: "hammer_curl", label: "Hammer Curl", aliases: ["hammer curl", "hammer curls"] },
  { key: "triceps_pushdown", label: "Triceps Pushdown", aliases: ["triceps pushdown", "tricep pushdown", "pushdown", "pushdowns"] },
  { key: "triceps_extension", label: "Triceps Extension", aliases: ["triceps extension", "tricep extension", "overhead triceps extension"] },
  { key: "chest_fly", label: "Chest Fly", aliases: ["chest fly", "chest flies", "pec fly", "pec deck"] },
  { key: "push_up", label: "Push-Up", aliases: ["push up", "push ups", "pushup", "pushups"] },
  { key: "dip", label: "Dip", aliases: ["dip", "dips", "chest dip", "triceps dip"] },
  { key: "good_morning", label: "Good Morning", aliases: ["good morning", "good mornings"] },
  { key: "glute_bridge", label: "Glute Bridge", aliases: ["glute bridge", "glute bridges"] }
];

const aliasIndex = new Map<string, TrainingExerciseReference>();
for (const item of TRAINING_EXERCISES_V0) {
  aliasIndex.set(normalize(item.label), item);
  aliasIndex.set(normalize(item.key), item);
  for (const alias of item.aliases) aliasIndex.set(normalize(alias), item);
}

export function resolveTrainingExercise(value: string) {
  return aliasIndex.get(normalize(value)) ?? null;
}

export function canonicalExercisePhrase(value: string) {
  return normalize(value);
}
