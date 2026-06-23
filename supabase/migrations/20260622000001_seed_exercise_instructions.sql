-- ============================================================
-- RepLog — Seed exercise instructions for predefined exercises.
-- TKT-0036: 1–2 English execution-technique sentences per exercise.
-- Idempotent: targeted UPDATEs keyed by name + user_id IS NULL.
-- ============================================================

update exercises set instructions = 'Lie on a flat bench, grip the bar slightly wider than shoulder-width, and lower it to your mid-chest. Press explosively to full arm extension, keeping your feet flat on the floor and shoulder blades retracted throughout.' where name = 'Barbell bench press' and user_id is null;

update exercises set instructions = 'Set an incline bench to 30–45 degrees, hold a dumbbell in each hand at shoulder height with palms facing forward. Press the dumbbells upward until arms are fully extended, then lower with control to the starting position.' where name = 'Incline dumbbell press' and user_id is null;

update exercises set instructions = 'Lie on a flat bench holding a dumbbell in each hand at chest level, palms facing each other at 45 degrees. Press upward to full extension then slowly lower back to chest level with elbows tracking slightly inward.' where name = 'Flat dumbbell press' and user_id is null;

update exercises set instructions = 'Stand or sit facing a cable machine, grip a D-handle or rope at chest height, and pull the cable across your body in an arc until your hands meet at center. Squeeze the chest at full contraction and return under control.' where name = 'Cable fly' and user_id is null;

update exercises set instructions = 'Grip parallel bars with arms straight, lean slightly forward, and lower yourself by bending the elbows until your upper arms are parallel to the floor. Press back up to full extension without locking out aggressively.' where name = 'Parallel bar dips' and user_id is null;

update exercises set instructions = 'Sit at the chest press machine and adjust the seat so the handles align with mid-chest. Press the handles forward until arms are nearly straight, then return the weight under control without letting the stack rest between reps.' where name = 'Machine chest press' and user_id is null;

update exercises set instructions = 'Hang from a pull-up bar with an overhand grip slightly wider than shoulder-width. Pull your chest toward the bar by driving elbows down and back, then lower with control to a full hang.' where name = 'Pull-ups' and user_id is null;

update exercises set instructions = 'Sit at the lat pulldown machine, grip the bar wider than shoulder-width with an overhand grip. Pull the bar to your upper chest by driving elbows toward your hips, then let the bar rise with control to full arm extension.' where name = 'Lat pulldown' and user_id is null;

update exercises set instructions = 'Stand over a barbell with a hip-width stance, hinge at the hips to grip the bar just outside your legs, then row it to your lower chest while keeping your torso roughly parallel to the floor. Lower with control and avoid using momentum.' where name = 'Barbell row' and user_id is null;

update exercises set instructions = 'Place one knee and hand on a bench for support, hold a dumbbell with the opposite hand, and row it toward your hip while keeping your elbow close to your torso. Lower the weight fully before the next rep.' where name = 'Dumbbell row' and user_id is null;

update exercises set instructions = 'Sit at a cable row station, grab the handle, and row toward your lower abdomen by squeezing your shoulder blades together. Keep a tall posture and avoid rounding the lower back as you return the weight.' where name = 'Seated cable row' and user_id is null;

update exercises set instructions = 'Stand with feet hip-width apart, hinge at the hips and knees to grip the bar just outside your legs, then drive through your heels and hips to lift the bar to standing. Lower under control by hinging the hips first, then bending the knees.' where name = 'Deadlift' and user_id is null;

update exercises set instructions = 'Hold a barbell at upper-chest height with a grip just outside shoulder-width, then press it directly overhead until arms are fully extended. Lower the bar back to the starting position under control, keeping your core braced.' where name = 'Barbell overhead press' and user_id is null;

update exercises set instructions = 'Sit on a bench or stand holding a dumbbell in each hand at shoulder height, palms facing forward. Press both dumbbells directly overhead until arms are straight, then lower back to shoulder level.' where name = 'Dumbbell shoulder press' and user_id is null;

update exercises set instructions = 'Stand with a dumbbell in each hand, arms by your sides and a slight bend in the elbows. Raise your arms out to the sides until they are parallel to the floor, then lower with control. Avoid shrugging or using momentum.' where name = 'Lateral raises' and user_id is null;

update exercises set instructions = 'Stand holding a dumbbell or plate in each hand in front of your thighs, arms nearly straight. Lift both arms forward to shoulder height with palms facing down, then slowly lower back to the start.' where name = 'Front raises' and user_id is null;

update exercises set instructions = 'Hinge forward at the hips until your torso is nearly parallel to the floor, hold a light dumbbell in each hand hanging beneath you. Raise both arms out to the sides in a reverse fly motion, squeezing the rear delts at the top, then lower.' where name = 'Rear delt fly' and user_id is null;

update exercises set instructions = 'Attach a rope handle to a high cable pulley, grip one end in each hand with palms facing each other. Pull toward your forehead while externally rotating your wrists so thumbs end up behind you, then return under control.' where name = 'Face pull' and user_id is null;

update exercises set instructions = 'Stand holding a barbell with a shoulder-width supinated grip, arms fully extended. Curl the bar toward your shoulders by flexing your elbows without swinging your torso, then lower with control.' where name = 'Barbell curl' and user_id is null;

update exercises set instructions = 'Stand holding a dumbbell in each hand with arms at your sides and palms facing forward. Curl both (or alternating) dumbbells toward your shoulders while keeping your upper arms stationary, then lower fully.' where name = 'Dumbbell curl' and user_id is null;

update exercises set instructions = 'Hold a dumbbell in each hand with a neutral grip (palms facing each other) and curl both arms toward your shoulders without rotating the wrists. Lower with control. The neutral grip shifts emphasis to the brachialis and brachioradialis.' where name = 'Hammer curl' and user_id is null;

update exercises set instructions = 'Lie on a flat bench, hold a barbell or EZ-bar with an overhand grip at arms-length above your chest. Lower the bar toward your forehead by bending only at the elbows, then press back to full extension.' where name = 'Skullcrusher' and user_id is null;

update exercises set instructions = 'Attach a rope or bar to a high cable pulley, stand facing the machine, and lock your upper arms against your sides. Push the handle downward until your elbows are fully extended, then return under control without letting your upper arms drift.' where name = 'Triceps pushdown' and user_id is null;

update exercises set instructions = 'Stand under a barbell set at upper-chest height, step back with feet about shoulder-width apart and toes slightly out. Descend by breaking at the hips and knees simultaneously until your thighs are at least parallel to the floor, then drive back up to standing.' where name = 'Barbell squat' and user_id is null;

update exercises set instructions = 'Sit in the leg press machine with your feet shoulder-width apart on the platform. Unlock the safety, lower the platform toward your chest until your knees reach roughly 90 degrees, then press back to near-full extension without locking out.' where name = 'Leg press' and user_id is null;

update exercises set instructions = 'Sit in the leg extension machine with the pad resting just above your ankles. Extend your knees to full range of motion, pause briefly at the top for a quad contraction, then lower under control.' where name = 'Leg extension' and user_id is null;

update exercises set instructions = 'Stand holding dumbbells at your sides, take a long step forward and lower your rear knee toward the floor until both knees are at roughly 90 degrees. Push through your front heel to return to standing and repeat on the opposite leg.' where name = 'Lunges' and user_id is null;

update exercises set instructions = 'Position yourself in the hack squat machine with your shoulders and back against the pads and feet shoulder-width apart on the platform. Lower until your thighs are at least parallel, then drive back up without locking your knees at the top.' where name = 'Hack squat' and user_id is null;

update exercises set instructions = 'Stand holding a barbell at hip level with an overhand grip. Hinge at the hips, pushing them back while keeping your spine neutral, and lower the bar along your legs until you feel a strong hamstring stretch. Drive your hips forward to return to standing.' where name = 'Romanian deadlift' and user_id is null;

update exercises set instructions = 'Lie face up on the lying leg curl machine with the pad resting just above your heels. Curl your heels toward your glutes through the full range of motion, pause briefly at the top, then lower under control.' where name = 'Lying leg curl' and user_id is null;

update exercises set instructions = 'Sit in the seated leg curl machine, adjust the pad to rest on top of your lower legs just above the ankles. Curl your legs downward and back as far as possible, hold the peak contraction briefly, then return the weight slowly.' where name = 'Seated leg curl' and user_id is null;

update exercises set instructions = 'Sit on the floor with your upper back against a padded bench, a barbell across your hips. Drive through your heels and upper back to lift your hips until your body forms a straight line from knees to shoulders, squeeze your glutes hard at the top, then lower.' where name = 'Hip thrust' and user_id is null;

update exercises set instructions = 'Stand on a calf raise platform with the balls of your feet on the edge, heels unsupported. Rise as high as possible onto your toes, hold for a moment at peak contraction, then lower your heels below the platform for a full stretch.' where name = 'Standing calf raise' and user_id is null;

update exercises set instructions = 'Sit in the seated calf raise machine with the pads resting on your lower thighs just above the knees. Push through the balls of your feet to raise your heels as high as possible, hold briefly, then lower fully for a deep stretch.' where name = 'Seated calf raise' and user_id is null;

update exercises set instructions = 'Get into a push-up position with forearms on the floor, elbows directly under your shoulders, and your body forming a straight line from head to heels. Brace your core hard and hold the position without letting your hips sag or rise.' where name = 'Plank' and user_id is null;

update exercises set instructions = 'Kneel in front of a cable pulley with a rope attachment positioned above your head. Grab the rope, tuck your chin, and crunch your elbows toward your knees by flexing the spine, not just bending at the hips. Return under control to the start.' where name = 'Cable crunch' and user_id is null;

update exercises set instructions = 'Hang from a pull-up bar with a shoulder-width grip. Keeping your legs straight or knees slightly bent, raise them until they are at least parallel to the floor (or higher), then lower with control without swinging.' where name = 'Hanging leg raise' and user_id is null;

update exercises set instructions = 'Kneel on the floor gripping an ab wheel with both hands, arms straight. Brace your core and slowly roll the wheel forward until your hips and arms are fully extended, then pull back to the starting position using your core — not your lower back.' where name = 'Ab wheel rollout' and user_id is null;
