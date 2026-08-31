/**
 * Hand-written mirror of supabase/migrations. Keep in step with the SQL:
 * if you change a migration, change this file in the same commit.
 */

export type PositionGroup = 'forward' | 'back';

export type ProgressionType =
  | 'heavy_compound'
  | 'light_compound_isolation'
  | 'bodyweight_plyo'
  | 'carry_loaded';

export type TeamRow = {
  id: string;
  name: string;
  login_code: string;
  leaderboard_enabled: boolean;
  created_at: string;
}

export type PlayerRow = {
  id: string;
  team_id: string;
  name: string;
  position_group: PositionGroup | null;
  is_admin: boolean;
  is_player: boolean;
  admin_pin_hash: string | null;
  leaderboard_opt_in: boolean;
  created_at: string;
}

export type ExerciseRow = {
  id: string;
  name: string;
  video_url: string | null;
  movement_pattern: string | null;
  progression_type: ProgressionType;
  created_at: string;
}

export type ProgramRow = {
  id: string;
  team_id: string;
  position_group: PositionGroup;
  name: string;
  start_date: string;
  end_date: string;
  is_active_override: boolean | null;
  created_at: string;
}

export type ProgramDayRow = {
  id: string;
  program_id: string;
  day_number: number;
  label: string | null;
}

export type ProgramExerciseRow = {
  id: string;
  program_day_id: string;
  exercise_id: string;
  order: number;
  target_sets: number;
  target_reps: string;
  rest_seconds: number;
  notes: string | null;
}

export type SessionRow = {
  id: string;
  player_id: string;
  program_day_id: string;
  date: string;
  completed_at: string | null;
  created_at: string;
}

export type LogRow = {
  id: string;
  session_id: string;
  program_exercise_id: string;
  set_number: number;
  reps_done: number | null;
  weight_used: number | null;
  distance_or_time: string | null;
  logged_at: string;
}

type Relationship<Column extends string, Referenced extends string> = {
  foreignKeyName: string;
  columns: [Column];
  isOneToOne: false;
  referencedRelation: Referenced;
  referencedColumns: ['id'];
};

type Table<Row, Insert = Row, Relationships extends readonly unknown[] = [], Update = Partial<Insert>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  /**
   * The foreign keys PostgREST can join on. Declaring them is what lets
   * supabase-js type an embedded select such as
   * `.select('id, logs!inner(id)')` — with an empty list every embed resolves
   * to an error type and has to be asserted by hand.
   */
  Relationships: Relationships;
};

type Defaulted<Row, K extends keyof Row> = Omit<Row, K> & Partial<Pick<Row, K>>;

export type Database = {
  public: {
    Tables: {
      teams: Table<TeamRow, Defaulted<TeamRow, 'id' | 'created_at' | 'leaderboard_enabled'>>;
      players: Table<
        PlayerRow,
        Defaulted<
          PlayerRow,
          | 'id'
          | 'created_at'
          | 'position_group'
          | 'is_admin'
          | 'is_player'
          | 'admin_pin_hash'
          | 'leaderboard_opt_in'
        >,
        [Relationship<'team_id', 'teams'>]
      >;
      exercises: Table<
        ExerciseRow,
        Defaulted<ExerciseRow, 'id' | 'created_at' | 'video_url' | 'movement_pattern'>
      >;
      programs: Table<
        ProgramRow,
        Defaulted<ProgramRow, 'id' | 'created_at' | 'is_active_override'>,
        [Relationship<'team_id', 'teams'>]
      >;
      program_days: Table<
        ProgramDayRow,
        Defaulted<ProgramDayRow, 'id' | 'label'>,
        [Relationship<'program_id', 'programs'>]
      >;
      program_exercises: Table<
        ProgramExerciseRow,
        Defaulted<ProgramExerciseRow, 'id' | 'rest_seconds' | 'notes'>,
        [Relationship<'program_day_id', 'program_days'>, Relationship<'exercise_id', 'exercises'>]
      >;
      sessions: Table<
        SessionRow,
        Defaulted<SessionRow, 'id' | 'created_at' | 'completed_at'>,
        [Relationship<'player_id', 'players'>, Relationship<'program_day_id', 'program_days'>]
      >;
      logs: Table<
        LogRow,
        Defaulted<LogRow, 'id' | 'logged_at' | 'reps_done' | 'weight_used' | 'distance_or_time'>,
        [Relationship<'session_id', 'sessions'>, Relationship<'program_exercise_id', 'program_exercises'>]
      >;
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      position_group: PositionGroup;
      progression_type: ProgressionType;
    };
    CompositeTypes: { [_ in never]: never };
  };
}
