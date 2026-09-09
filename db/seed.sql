-- Seed: the two squads plus a starting rugby exercise library.
-- Admin accounts are NOT seeded here — their PINs are hashed by the app, so the
-- first admin for each team is created from the login screen (see SETUP.md).
-- Safe to re-run.

insert into teams (name, login_code) values
  ('Palestine', 'PAL2026'),
  ('Cyprus',    'CYP2026')
on conflict (name) do nothing;

insert into exercises (name, movement_pattern, progression_type, video_url) values
  -- Forwards: maximal strength, contact durability
  ('Back Squat',                'squat',        'heavy_compound',           'https://www.youtube.com/watch?v=ultWZbUMPL8'),
  ('Front Squat',               'squat',        'heavy_compound',           'https://www.youtube.com/watch?v=uYumuL_G_V0'),
  ('Conventional Deadlift',     'hinge',        'heavy_compound',           'https://www.youtube.com/watch?v=op9kVnSso6Q'),
  ('Romanian Deadlift',         'hinge',        'heavy_compound',           'https://www.youtube.com/watch?v=JCXUYuzwNrM'),
  ('Barbell Bench Press',       'horizontal push', 'heavy_compound',        'https://www.youtube.com/watch?v=rT7DgCr-3pg'),
  ('Weighted Pull-Up',          'vertical pull',   'heavy_compound',        'https://www.youtube.com/watch?v=eGo4IYlbE5g'),
  ('Barbell Bent-Over Row',     'horizontal pull', 'heavy_compound',        'https://www.youtube.com/watch?v=9efgcAjQe7E'),
  ('Overhead Press',            'vertical push',   'heavy_compound',        'https://www.youtube.com/watch?v=2yjwXTZQDDI'),
  ('Neck Harness Extension',    'neck',         'light_compound_isolation', null),
  ('Neck Isometric Hold',       'neck',         'bodyweight_plyo',          null),
  ('Barbell Shrug',             'trap',         'light_compound_isolation', null),
  ('Farmer''s Carry',           'carry',        'carry_loaded',             'https://www.youtube.com/watch?v=Nq3_2Ov4iiU'),
  ('Sled Push',                 'carry',        'carry_loaded',             'https://www.youtube.com/watch?v=ynJ9wRb2Cds'),
  ('Sled Drag (Backward)',      'carry',        'carry_loaded',             null),
  ('Yoke Walk',                 'carry',        'carry_loaded',             null),

  -- Backs: speed, power, repeated sprint ability
  ('Power Clean',               'olympic',      'heavy_compound',           'https://www.youtube.com/watch?v=KwYJTpQ_x0A'),
  ('Hang Power Clean',          'olympic',      'heavy_compound',           null),
  ('Push Press',                'vertical push','heavy_compound',           null),
  ('Trap Bar Jump',             'jump',         'heavy_compound',           null),
  ('Box Jump',                  'jump',         'bodyweight_plyo',          'https://www.youtube.com/watch?v=52r_Ul5k03g'),
  ('Broad Jump',                'jump',         'bodyweight_plyo',          null),
  ('Depth Jump',                'jump',         'bodyweight_plyo',          null),
  ('Bulgarian Split Squat',     'single leg',   'light_compound_isolation', 'https://www.youtube.com/watch?v=2C-uNgKwPLE'),
  ('Nordic Hamstring Curl',     'hinge',        'bodyweight_plyo',          'https://www.youtube.com/watch?v=1u-Ilm0jK3g'),
  ('Copenhagen Plank',          'adductor',     'bodyweight_plyo',          null),
  ('30m Sprint',                'sprint',       'bodyweight_plyo',          null),
  ('Flying 20m Sprint',         'sprint',       'bodyweight_plyo',          null),
  ('Resisted Sprint (Sled)',    'sprint',       'carry_loaded',             null),
  ('A-Skip',                    'sprint mechanics', 'bodyweight_plyo',      null),
  ('Lateral Bound',             'change of direction', 'bodyweight_plyo',   null),

  -- Shared: mobility, core, injury prevention
  ('Pallof Press',              'anti-rotation','light_compound_isolation', null),
  ('Hanging Leg Raise',         'core',         'bodyweight_plyo',          null),
  ('Plank',                     'core',         'bodyweight_plyo',          null),
  ('Side Plank',                'core',         'bodyweight_plyo',          null),
  ('Dead Bug',                  'core',         'bodyweight_plyo',          null),
  ('Face Pull',                 'shoulder health','light_compound_isolation', null),
  ('Dumbbell Lateral Raise',    'shoulder',     'light_compound_isolation', null),
  ('Barbell Curl',              'elbow flexion','light_compound_isolation', null),
  ('Cable Tricep Pushdown',     'elbow extension','light_compound_isolation', null),
  ('Calf Raise',                'ankle',        'light_compound_isolation', null),
  ('Hip Airplane',              'mobility',     'bodyweight_plyo',          null),
  ('90/90 Hip Switch',          'mobility',     'bodyweight_plyo',          null)
on conflict (name) do nothing;
