-- EduCareer production schema audit.
-- Read-only: this script does not modify database objects or data.

-- 1. Required triggers and their connected functions.
with expected(trigger_schema, table_name, trigger_name, function_schema, function_name) as (
  values
    ('auth', 'users', 'on_auth_user_created', 'public', 'handle_new_user'),
    ('public', 'profiles', 'touch_profiles_updated_at', 'public', 'touch_updated_at'),
    ('public', 'candidates', 'touch_candidates_updated_at', 'public', 'touch_updated_at'),
    ('public', 'partner_requests', 'touch_partner_requests_updated_at', 'public', 'touch_updated_at'),
    ('public', 'programs', 'touch_programs_updated_at', 'public', 'touch_updated_at'),
    ('public', 'opportunities', 'touch_opportunities_updated_at', 'public', 'touch_updated_at'),
    ('public', 'opportunity_applications', 'touch_opportunity_applications_updated_at', 'public', 'touch_updated_at'),
    ('public', 'placements', 'touch_placements_updated_at', 'public', 'touch_updated_at')
),
actual as (
  select
    table_namespace.nspname as trigger_schema,
    table_class.relname as table_name,
    trg.tgname as trigger_name,
    function_namespace.nspname as function_schema,
    proc.proname as function_name,
    trg.tgenabled,
    pg_get_triggerdef(trg.oid) as definition
  from pg_trigger trg
  join pg_class table_class on table_class.oid = trg.tgrelid
  join pg_namespace table_namespace on table_namespace.oid = table_class.relnamespace
  join pg_proc proc on proc.oid = trg.tgfoid
  join pg_namespace function_namespace on function_namespace.oid = proc.pronamespace
  where not trg.tgisinternal
)
select
  expected.trigger_schema,
  expected.table_name,
  expected.trigger_name,
  expected.function_schema || '.' || expected.function_name as expected_function,
  case
    when actual.trigger_name is null then 'MISSING'
    when actual.function_schema <> expected.function_schema
      or actual.function_name <> expected.function_name then 'WRONG_FUNCTION'
    when actual.tgenabled = 'D' then 'DISABLED'
    else 'OK'
  end as status,
  actual.definition
from expected
left join actual using (trigger_schema, table_name, trigger_name)
order by expected.trigger_schema, expected.table_name;

-- 2. Columns used directly by account, program and opportunity workflows.
with expected(table_name, column_name) as (
  values
    ('profiles', 'id'), ('profiles', 'username'), ('profiles', 'email'),
    ('profiles', 'display_name'), ('profiles', 'phone'), ('profiles', 'role'),
    ('profiles', 'admin_role'), ('profiles', 'status'), ('profiles', 'updated_at'),
    ('candidates', 'account_id'), ('candidates', 'username'), ('candidates', 'full_name'),
    ('candidates', 'email'), ('candidates', 'phone'), ('candidates', 'province'),
    ('candidates', 'institution'), ('candidates', 'qualification'),
    ('candidates', 'teaching_area'), ('candidates', 'preferred_program'),
    ('candidates', 'motivation'), ('candidates', 'updated_at'),
    ('partner_requests', 'account_id'), ('partner_requests', 'username'),
    ('partner_requests', 'organization_name'), ('partner_requests', 'contact_person'),
    ('partner_requests', 'email'), ('partner_requests', 'phone'),
    ('partner_requests', 'organization_type'), ('partner_requests', 'support_needed'),
    ('partner_requests', 'updated_at'),
    ('programs', 'id'), ('programs', 'name'), ('programs', 'tagline'),
    ('programs', 'description'), ('programs', 'activities'), ('programs', 'status'),
    ('programs', 'updated_at'),
    ('opportunities', 'id'), ('opportunities', 'title'),
    ('opportunities', 'institution'), ('opportunities', 'location'),
    ('opportunities', 'opportunity_type'), ('opportunities', 'deadline'),
    ('opportunities', 'status'), ('opportunities', 'requirements'),
    ('opportunities', 'updated_at'),
    ('opportunity_applications', 'opportunity_id'),
    ('opportunity_applications', 'account_id'),
    ('opportunity_applications', 'status'),
    ('opportunity_applications', 'updated_at'),
    ('placements', 'candidate_id'), ('placements', 'opportunity_id'),
    ('placements', 'partner_request_id'), ('placements', 'status'),
    ('placements', 'updated_at')
)
select
  expected.table_name,
  expected.column_name,
  case when columns.column_name is null then 'MISSING' else 'OK' end as status,
  columns.data_type,
  columns.is_nullable,
  columns.column_default
from expected
left join information_schema.columns columns
  on columns.table_schema = 'public'
 and columns.table_name = expected.table_name
 and columns.column_name = expected.column_name
order by expected.table_name, expected.column_name;

-- 3. Required foreign-key connections.
with expected(source_table, source_column, target_table, target_column, delete_action) as (
  values
    ('public.profiles', 'id', 'auth.users', 'id', 'CASCADE'),
    ('public.candidates', 'account_id', 'public.profiles', 'id', 'SET NULL'),
    ('public.partner_requests', 'account_id', 'public.profiles', 'id', 'SET NULL'),
    ('public.opportunity_applications', 'opportunity_id', 'public.opportunities', 'id', 'CASCADE'),
    ('public.opportunity_applications', 'account_id', 'public.profiles', 'id', 'CASCADE'),
    ('public.placements', 'candidate_id', 'public.candidates', 'id', 'CASCADE'),
    ('public.placements', 'opportunity_id', 'public.opportunities', 'id', 'SET NULL'),
    ('public.placements', 'partner_request_id', 'public.partner_requests', 'id', 'SET NULL')
),
actual as (
  select
    fk.oid,
    source_namespace.nspname || '.' || source_relation.relname as source_table,
    source_attribute.attname as source_column,
    target_namespace.nspname || '.' || target_relation.relname as target_table,
    target_attribute.attname as target_column,
    case fk.confdeltype
      when 'c' then 'CASCADE'
      when 'n' then 'SET NULL'
      when 'r' then 'RESTRICT'
      when 'a' then 'NO ACTION'
      when 'd' then 'SET DEFAULT'
    end as delete_action
  from pg_constraint fk
  join pg_class source_relation on source_relation.oid = fk.conrelid
  join pg_namespace source_namespace on source_namespace.oid = source_relation.relnamespace
  join pg_class target_relation on target_relation.oid = fk.confrelid
  join pg_namespace target_namespace on target_namespace.oid = target_relation.relnamespace
  join pg_attribute source_attribute
    on source_attribute.attrelid = fk.conrelid
   and source_attribute.attnum = fk.conkey[1]
  join pg_attribute target_attribute
    on target_attribute.attrelid = fk.confrelid
   and target_attribute.attnum = fk.confkey[1]
  where fk.contype = 'f'
    and cardinality(fk.conkey) = 1
)
select
  expected.*,
  case
    when actual.oid is null then 'MISSING'
    when actual.delete_action <> expected.delete_action then 'WRONG_DELETE_ACTION'
    else 'OK'
  end as status,
  actual.delete_action as actual_delete_action
from expected
left join actual
  on actual.source_table = expected.source_table
 and actual.source_column = expected.source_column
 and actual.target_table = expected.target_table
 and actual.target_column = expected.target_column
order by expected.source_table, expected.source_column;
