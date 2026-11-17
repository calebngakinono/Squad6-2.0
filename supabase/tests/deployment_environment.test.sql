begin;
select plan(5);

select lives_ok($$insert into public.deployment_environment (name) values ('staging')$$, 'an operator can mark the database');
select throws_ok($$insert into public.deployment_environment (name) values ('production')$$, '23505', null, 'there is only ever one row');
select throws_ok($$update public.deployment_environment set name = 'prod'$$, '23514', null, 'only known environment names');

set local role authenticated;
select throws_ok($$select * from public.deployment_environment$$, '42501', null, 'app users cannot read it');
select throws_ok($$update public.deployment_environment set name = 'production'$$, '42501', null, 'app users cannot change it');

select * from finish();
rollback;
