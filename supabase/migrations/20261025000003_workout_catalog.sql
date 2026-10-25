-- Global exercise catalog: 60 synthetic exercises across all muscle groups and equipment.
-- Every demo is labelled "Placeholder: not licensed for release" (plan/02-workout-loop.md 2.1).

insert into public.exercises (scope, name, instructions, tracking_type, primary_muscle, equipment_id, default_rest_seconds) values
  -- Quads (8)
  ('global', 'Barbell Back Squat', 'Brace core, sit hips back and down until thighs are parallel, drive through mid-foot.', 'weight_reps', 'quads', 'barbell', 120),
  ('global', 'Barbell Front Squat', 'Rest bar on front delts with high elbows, squat upright and drive up.', 'weight_reps', 'quads', 'barbell', 120),
  ('global', 'Leg Press', 'Place feet shoulder-width on sled, lower under control without rounding lower back, press up.', 'weight_reps', 'quads', 'machine', 90),
  ('global', 'Leg Extension', 'Adjust pad above ankles, extend knees fully and pause at the top.', 'weight_reps', 'quads', 'machine', 60),
  ('global', 'Goblet Squat', 'Hold dumbbell or kettlebell at chest height, squat deep keeping torso upright.', 'weight_reps', 'quads', 'dumbbell', 75),
  ('global', 'Dumbbell Bulgarian Split Squat', 'Rear foot elevated on bench, lower back knee toward floor, drive through front heel.', 'weight_reps', 'quads', 'dumbbell', 90),
  ('global', 'Dumbbell Walking Lunge', 'Step forward into a lunge, lightly tap back knee, drive into the next step.', 'weight_reps', 'quads', 'dumbbell', 75),
  ('global', 'Bodyweight Squat', 'Feet shoulder-width apart, squat down with chest up and return to standing.', 'reps', 'quads', 'bodyweight', 60),

  -- Hamstrings & Glutes (9)
  ('global', 'Conventional Deadlift', 'Set bar over mid-foot, grip outside knees, brace lats and drive the floor away.', 'weight_reps', 'hamstrings', 'barbell', 150),
  ('global', 'Romanian Deadlift', 'Soft knees, hinge hips straight back keeping bar close to shins until hamstring stretch.', 'weight_reps', 'hamstrings', 'barbell', 120),
  ('global', 'Dumbbell Romanian Deadlift', 'Hinge at the hips with dumbbells skimming the thighs, squeeze glutes to stand.', 'weight_reps', 'hamstrings', 'dumbbell', 90),
  ('global', 'Lying Leg Curl', 'Keep hips pressed into pad, curl heels toward glutes and lower slowly.', 'weight_reps', 'hamstrings', 'machine', 60),
  ('global', 'Seated Leg Curl', 'Lock thigh pad snug, curl lower leg back and control the eccentric.', 'weight_reps', 'hamstrings', 'machine', 60),
  ('global', 'Barbell Hip Thrust', 'Upper back on bench, bar padded over hips, drive to full hip extension.', 'weight_reps', 'glutes', 'barbell', 90),
  ('global', 'Glute Bridge', 'Lie supine with knees bent, drive through heels to lift hips and squeeze glutes.', 'reps', 'glutes', 'bodyweight', 60),
  ('global', 'Cable Pull-Through', 'Face away from low pulley, hinge hips back and snap forward squeezing glutes.', 'weight_reps', 'glutes', 'cable', 75),
  ('global', 'Kettlebell Swing', 'Hinge hips back and explosively snap hips forward to float kettlebell to chest height.', 'weight_reps', 'glutes', 'kettlebell', 75),

  -- Chest (8)
  ('global', 'Barbell Bench Press', 'Retract shoulder blades, lower bar to lower chest with 45-degree elbows, press up.', 'weight_reps', 'chest', 'barbell', 120),
  ('global', 'Incline Barbell Bench Press', 'Bench at 30 degrees, lower bar to upper chest under control, press to lockout.', 'weight_reps', 'chest', 'barbell', 120),
  ('global', 'Dumbbell Bench Press', 'Lower dumbbells to chest level with wrists stacked over elbows, press up.', 'weight_reps', 'chest', 'dumbbell', 90),
  ('global', 'Incline Dumbbell Press', 'Press dumbbells on a 30-degree incline bench with full stretch at the bottom.', 'weight_reps', 'chest', 'dumbbell', 90),
  ('global', 'Machine Chest Press', 'Keep shoulders pinned back against pad, press handles forward without locking aggressively.', 'weight_reps', 'chest', 'machine', 75),
  ('global', 'Cable Chest Fly', 'Slight bend in elbows, sweep handles together in an arc at chest height.', 'weight_reps', 'chest', 'cable', 60),
  ('global', 'Pec Deck Fly', 'Bring forearms or handles together in front of chest, pause and control the return.', 'weight_reps', 'chest', 'machine', 60),
  ('global', 'Push-Up', 'Hands slightly wider than shoulders, body in a straight plank line, chest to floor.', 'reps', 'chest', 'bodyweight', 60),

  -- Back (9)
  ('global', 'Pull-Up', 'Overhand grip outside shoulders, pull chest toward bar by driving elbows down.', 'reps', 'back', 'bodyweight', 120),
  ('global', 'Chin-Up', 'Supinated shoulder-width grip, pull until chin clears the bar and lower to full hang.', 'reps', 'back', 'bodyweight', 120),
  ('global', 'Lat Pulldown', 'Slight lean back, pull bar to upper chest driving elbows down and in.', 'weight_reps', 'back', 'cable', 90),
  ('global', 'Seated Cable Row', 'Sit tall with neutral spine, pull handle to lower ribs and squeeze shoulder blades.', 'weight_reps', 'back', 'cable', 90),
  ('global', 'Barbell Bent-Over Row', 'Hinge to 45 degrees, row bar to lower sternum while keeping torso steady.', 'weight_reps', 'back', 'barbell', 90),
  ('global', 'One-Arm Dumbbell Row', 'Support on bench, row dumbbell toward hip in a smooth arc.', 'weight_reps', 'back', 'dumbbell', 75),
  ('global', 'Chest-Supported Machine Row', 'Brace chest against pad, pull handles back and pause at peak contraction.', 'weight_reps', 'back', 'machine', 75),
  ('global', 'Straight-Arm Cable Pulldown', 'Arms nearly straight, sweep bar from eye level down to thighs using lats.', 'weight_reps', 'back', 'cable', 60),
  ('global', 'Inverted Row', 'Hang beneath a bar set at waist height, keep body rigid and row chest to bar.', 'reps', 'back', 'bodyweight', 60),

  -- Shoulders (7)
  ('global', 'Overhead Barbell Press', 'Brace glutes and abs, press bar vertically from collarbone to overhead lockout.', 'weight_reps', 'shoulders', 'barbell', 120),
  ('global', 'Seated Dumbbell Shoulder Press', 'Press dumbbells overhead from ear level without arching lower back.', 'weight_reps', 'shoulders', 'dumbbell', 90),
  ('global', 'Dumbbell Lateral Raise', 'Raise dumbbells out to sides in the scapular plane to shoulder height.', 'weight_reps', 'shoulders', 'dumbbell', 60),
  ('global', 'Cable Lateral Raise', 'Sweep cable handle out to shoulder height with steady torso.', 'weight_reps', 'shoulders', 'cable', 60),
  ('global', 'Reverse Pec Deck', 'Face the machine pad and sweep arms back to target rear delts.', 'weight_reps', 'shoulders', 'machine', 60),
  ('global', 'Cable Face Pull', 'Pull rope attachment toward forehead while externally rotating shoulders.', 'weight_reps', 'shoulders', 'cable', 60),
  ('global', 'Dumbbell Rear Delt Fly', 'Hinge forward and raise dumbbells out to the sides squeezing rear delts.', 'weight_reps', 'shoulders', 'dumbbell', 60),

  -- Biceps (5)
  ('global', 'Barbell Bicep Curl', 'Keep elbows pinned at sides, curl bar up without swinging torso.', 'weight_reps', 'biceps', 'barbell', 60),
  ('global', 'Dumbbell Bicep Curl', 'Supinate wrists as you curl dumbbells up, lower under full control.', 'weight_reps', 'biceps', 'dumbbell', 60),
  ('global', 'Dumbbell Hammer Curl', 'Neutral palms-facing grip throughout the curl to target brachialis and forearms.', 'weight_reps', 'biceps', 'dumbbell', 60),
  ('global', 'Incline Dumbbell Curl', 'Sit back on incline bench with arms hanging behind torso for a deep stretch.', 'weight_reps', 'biceps', 'dumbbell', 60),
  ('global', 'Cable Bicep Curl', 'Stand tall facing low pulley and curl bar or rope with constant cable tension.', 'weight_reps', 'biceps', 'cable', 60),

  -- Triceps (5)
  ('global', 'Cable Tricep Pushdown', 'Pin elbows to ribs, extend rope or bar to full lockout.', 'weight_reps', 'triceps', 'cable', 60),
  ('global', 'Overhead Cable Tricep Extension', 'Face away from pulley, extend rope overhead from a deep tricep stretch.', 'weight_reps', 'triceps', 'cable', 60),
  ('global', 'EZ-Bar Skullcrusher', 'Lower bar toward forehead keeping upper arms angled slightly back, extend up.', 'weight_reps', 'triceps', 'barbell', 75),
  ('global', 'Close-Grip Bench Press', 'Shoulder-width grip on bar, tuck elbows close to torso and press.', 'weight_reps', 'triceps', 'barbell', 90),
  ('global', 'Parallel Bar Dip', 'Lower until shoulders are below elbows, press back to top lockout.', 'reps', 'triceps', 'bodyweight', 90),

  -- Calves (3)
  ('global', 'Standing Calf Raise', 'Full stretch at the bottom, pause for 1 second at peak contraction on toes.', 'weight_reps', 'calves', 'machine', 60),
  ('global', 'Seated Calf Raise', 'Lower heels for a deep soleus stretch and drive up onto the balls of feet.', 'weight_reps', 'calves', 'machine', 60),
  ('global', 'Single-Leg Dumbbell Calf Raise', 'Stand on a step with one foot, perform full-range calf raises.', 'weight_reps', 'calves', 'dumbbell', 60),

  -- Core & Full Body (6)
  ('global', 'Plank', 'Forearms on floor, glutes and abs braced in a straight line from head to heels.', 'time', 'core', 'bodyweight', 60),
  ('global', 'Side Plank', 'Support on one forearm and side of foot, keep hips stacked and elevated.', 'time', 'core', 'bodyweight', 60),
  ('global', 'Hanging Knee Raise', 'Hang from bar, curl pelvis up bringing knees toward chest without swinging.', 'reps', 'core', 'bodyweight', 60),
  ('global', 'Cable Crunch', 'Kneel below high pulley, flex spine to bring ribs toward hips.', 'weight_reps', 'core', 'cable', 60),
  ('global', 'Dead Bug', 'Press lower back flat into floor, extend opposite arm and leg slowly.', 'reps', 'core', 'bodyweight', 45),
  ('global', 'Farmer''s Walk', 'Walk with heavy dumbbells or kettlebells at sides, tall posture and braced core.', 'time', 'full_body', 'dumbbell', 90);
